-- KavShare Supabase Migration: Advanced Matchmaking Engine
-- Migration Date: 2026-05-28
-- Grouping: SQL scoring functions, triggers, and compatibility profile schemas.

-- 1. Schema Extensions for Companies & Procurement Posts
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS target_industries VARCHAR(100)[] DEFAULT '{}'::VARCHAR(100)[] NOT NULL,
ADD COLUMN IF NOT EXISTS target_sizes VARCHAR(50)[] DEFAULT '{}'::VARCHAR(50)[] NOT NULL,
ADD COLUMN IF NOT EXISTS target_budget NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
ADD COLUMN IF NOT EXISTS preferred_frameworks VARCHAR(100)[] DEFAULT '{}'::VARCHAR(100)[] NOT NULL;

ALTER TABLE public.procurement_posts
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
ADD COLUMN IF NOT EXISTS company_size VARCHAR(50),
ADD COLUMN IF NOT EXISTS compliance VARCHAR(100)[] DEFAULT '{}'::VARCHAR(100)[] NOT NULL,
ADD COLUMN IF NOT EXISTS pm_style VARCHAR(100),
ADD COLUMN IF NOT EXISTS budget_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS require_nda BOOLEAN DEFAULT false NOT NULL;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS companies_matching_idx ON public.companies USING gin (target_industries, target_sizes);
CREATE INDEX IF NOT EXISTS procurement_posts_matching_idx ON public.procurement_posts (category, industry, status);

-- 2. Matchmaking Algorithm scoring engine function
CREATE OR REPLACE FUNCTION public.match_providers_for_request(
    p_request_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    company_id UUID,
    company_name VARCHAR(255),
    total_score NUMERIC(5, 2),
    category_fit_score NUMERIC(5, 2),
    industry_relevance_score NUMERIC(5, 2),
    client_size_fit_score NUMERIC(5, 2),
    price_fit_score NUMERIC(5, 2),
    performance_score NUMERIC(5, 2),
    reliability_workflow_score NUMERIC(5, 2),
    match_explanations TEXT[]
) AS $$
DECLARE
    v_category VARCHAR(100);
    v_industry VARCHAR(100);
    v_company_size VARCHAR(50);
    v_budget NUMERIC(12, 2);
    v_required_tools VARCHAR(100)[];
    v_pm_style VARCHAR(100);
BEGIN
    -- 1. Fetch procurement request parameters
    SELECT category, industry, company_size, budget, required_tools, pm_style
    INTO v_category, v_industry, v_company_size, v_budget, v_required_tools, v_pm_style
    FROM public.procurement_posts
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Procurement request % not found', p_request_id;
    END IF;

    -- 2. Evaluate and score active providers
    RETURN QUERY
    WITH provider_eval AS (
        SELECT 
            c.id AS p_id,
            c.name AS p_name,
            c.rating AS p_rating,
            c.target_industries AS p_target_industries,
            c.target_sizes AS p_target_sizes,
            c.preferred_frameworks AS p_preferred_frameworks,
            
            -- Evaluate service category fit (max 20 points for direct category match)
            COALESCE(
                CASE WHEN EXISTS (
                    SELECT 1 FROM public.services s
                    WHERE s.company_id = c.id AND s.category ILIKE v_category
                ) THEN 20.00 ELSE 0.00 END, 0.00
            ) AS cat_match_points,

            -- Evaluate tool/tech overlap (2 points per tool, max 10 points)
            COALESCE(
                (
                    SELECT LEAST(COUNT(DISTINCT req_tool) * 2.00, 10.00)
                    FROM unnest(v_required_tools) AS req_tool
                    JOIN (
                        SELECT DISTINCT unnest(s.tech_stack) AS prov_tool
                        FROM public.services s
                        WHERE s.company_id = c.id
                    ) pt ON pt.prov_tool ILIKE req_tool
                ), 0.00
            ) AS tool_match_points,

            -- Calculate average provider service price
            COALESCE(
                (
                    SELECT AVG(s.starting_price)
                    FROM public.services s
                    WHERE s.company_id = c.id
                ), 0.00
            ) AS avg_service_price,

            -- Platform completion rate metrics (reliability)
            COALESCE(
                (
                    SELECT (COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 10.00
                    FROM public.engagements
                    WHERE company_id = c.id AND status IN ('completed', 'cancelled')
                ), 10.00
            ) AS completion_rate_points
        FROM public.companies c
        WHERE c.status = 'active'
    ),
    scored_providers AS (
        SELECT
            pe.p_id,
            pe.p_name,
            
            -- Service Category Fit total (max 30)
            (pe.cat_match_points + pe.tool_match_points)::NUMERIC(5, 2) AS cat_fit,

            -- Industry Relevance (max 15)
            CASE 
                WHEN pe.p_target_industries @> ARRAY[v_industry] THEN 15.00
                WHEN EXISTS (
                    SELECT 1 FROM unnest(pe.p_target_industries) ind
                    WHERE ind ILIKE '%' || v_industry || '%' OR v_industry ILIKE '%' || ind || '%'
                ) THEN 5.00
                ELSE 0.00
            END::NUMERIC(5, 2) AS ind_relevance,

            -- Client Size Fit (max 10)
            -- Brackets ordered: 1: '1-10', 2: '11-50', 3: '51-200', 4: '200+'
            CASE 
                WHEN pe.p_target_sizes @> ARRAY[v_company_size] THEN 10.00
                WHEN EXISTS (
                    SELECT 1 FROM unnest(pe.p_target_sizes) sz
                    WHERE 
                        (v_company_size = '1-10' AND sz = '11-50') OR
                        (v_company_size = '11-50' AND sz IN ('1-10', '51-200')) OR
                        (v_company_size = '51-200' AND sz IN ('11-50', '200+')) OR
                        (v_company_size = '200+' AND sz = '51-200')
                ) THEN 5.00
                ELSE 0.00
            END::NUMERIC(5, 2) AS client_size_fit,

            -- Price Fit (max 15)
            CASE 
                WHEN pe.avg_service_price <= v_budget THEN 15.00
                WHEN pe.avg_service_price <= v_budget * 1.20 THEN 7.00
                ELSE 0.00
            END::NUMERIC(5, 2) AS price_fit,

            -- Performance score (max 15)
            CASE 
                WHEN pe.p_rating IS NULL OR pe.p_rating = 0.00 THEN 10.00
                ELSE (pe.p_rating * 3.00)::NUMERIC(5, 2)
            END::NUMERIC(5, 2) AS perf_score,

            -- Reliability & Workflow (max 15)
            -- 5 points for pm style match, 10 points for completion rate
            (
                CASE WHEN pe.p_preferred_frameworks @> ARRAY[v_pm_style] THEN 5.00 ELSE 0.00 END + pe.completion_rate_points
            )::NUMERIC(5, 2) AS rel_workflow
        FROM provider_eval pe
    )
    SELECT
        sp.p_id,
        sp.p_name,
        (sp.cat_fit + sp.ind_relevance + sp.client_size_fit + sp.price_fit + sp.perf_score + sp.rel_workflow)::NUMERIC(5, 2) AS tot_score,
        sp.cat_fit,
        sp.ind_relevance,
        sp.client_size_fit,
        sp.price_fit,
        sp.perf_score,
        sp.rel_workflow,
        -- Generate explanation array
        array_remove(
            ARRAY[
                CASE WHEN sp.cat_fit >= 20.00 THEN 'Strong match for your required service category' END,
                CASE WHEN sp.price_fit >= 15.00 THEN 'Fits perfectly within your stated budget' END,
                CASE WHEN sp.ind_relevance >= 15.00 THEN 'Proven experience in your industry' END,
                CASE WHEN sp.client_size_fit >= 10.00 THEN 'Specializes in companies of your size' END,
                CASE WHEN sp.perf_score >= 12.00 THEN 'Top-tier client satisfaction rating' END
            ],
            NULL
        ) AS explanations
    FROM scored_providers sp
    ORDER BY tot_score DESC
    LIMIT p_limit;

END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.match_providers_for_request(UUID, INTEGER) IS 'PostgreSQL advanced matchmaking engine returning provider matches and structured relevance evaluations.';
