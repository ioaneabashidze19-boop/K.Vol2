-- KavShare Supabase Migration: Core Database Functions
-- Migration Date: 2026-05-28
-- Grouping: Advanced matching algorithms, scheduler engines, rating calculations, and cleanup tasks.

-- 1. match_providers_for_request(p_request_id UUID, p_limit INTEGER)
-- Implements a weighted scoring matchmaking algorithm evaluating:
-- - Tech stack overlap (50% weight)
-- - Starting price budget suitability (30% weight)
-- - Provider satisfaction rating (20% weight)

CREATE OR REPLACE FUNCTION public.match_providers_for_request(
    p_request_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    company_id UUID,
    company_name VARCHAR(255),
    score NUMERIC(5, 2),
    explanations TEXT[]
) AS $$
DECLARE
    v_required_tools VARCHAR(100)[];
    v_budget NUMERIC(12, 2);
BEGIN
    -- 1. Fetch details of the procurement post
    SELECT required_tools, budget INTO v_required_tools, v_budget
    FROM public.procurement_posts
    WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Procurement post % not found.', p_request_id;
    END IF;

    -- 2. Return matching company table
    RETURN QUERY
    WITH company_stats AS (
        SELECT 
            c.id AS c_id,
            c.name AS c_name,
            c.rating AS c_rating,
            -- Calculate tools match
            COALESCE(
              (
                SELECT COUNT(DISTINCT matching_tool)
                FROM unnest(v_required_tools) AS matching_tool
                JOIN (
                  SELECT DISTINCT unnest(s.tech_stack) AS provider_tool
                  FROM public.services s
                  WHERE s.company_id = c.id
                ) pt ON pt.provider_tool ILIKE matching_tool
              ), 0
            ) AS matched_tools_count,
            -- Calculate starting price
            COALESCE(
              (
                SELECT MIN(s.starting_price)
                FROM public.services s
                WHERE s.company_id = c.id
              ), 0.00
            ) AS min_starting_price
        FROM public.companies c
        WHERE c.status = 'active'
    ),
    company_scores AS (
        SELECT
            c_id,
            c_name,
            -- Tech Stack Score (0 to 50 points)
            CASE 
                WHEN array_length(v_required_tools, 1) IS NULL OR array_length(v_required_tools, 1) = 0 THEN 50.00
                ELSE ((matched_tools_count::NUMERIC / array_length(v_required_tools, 1)::NUMERIC) * 50.00)::NUMERIC(5, 2)
            END AS tech_score,
            -- Budget Score (0 to 30 points)
            CASE 
                WHEN min_starting_price = 0.00 THEN 15.00 -- Neutral
                WHEN min_starting_price <= v_budget THEN 30.00 -- Full budget match
                WHEN min_starting_price > v_budget * 2 THEN 0.00 -- Too expensive
                ELSE (30.00 - (((min_starting_price - v_budget) / v_budget) * 30.00))::NUMERIC(5, 2)
            END AS budget_score,
            -- Satisfaction Rating Score (0 to 20 points)
            (c_rating * 4.00)::NUMERIC(5, 2) AS rating_score,
            -- Array of text explanations
            ARRAY[
                'Tech Stack Match: ' || matched_tools_count || ' of ' || COALESCE(array_length(v_required_tools, 1), 0) || ' tools matched.',
                'Budget Fit: starting price is $' || min_starting_price || ' vs. post budget of $' || v_budget || '.',
                'Provider Rating: ' || c_rating || ' stars.'
            ] AS item_explanations
        FROM company_stats
    )
    SELECT
        c_id,
        c_name,
        (tech_score + budget_score + rating_score)::NUMERIC(5, 2) AS final_score,
        item_explanations
    FROM company_scores
    ORDER BY final_score DESC, c_rating DESC
    LIMIT p_limit;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error executing match_providers_for_request: %', SQLERRM;
        RETURN;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.match_providers_for_request(UUID, INTEGER) IS 'Weighted scoring matchmaking engine returning ranked provider listings and evaluation metadata.';


-- 2. generate_commission_schedules(p_contract_id UUID)
-- Generates expected monthly schedules over a contract duration terms.
CREATE OR REPLACE FUNCTION public.generate_commission_schedules(p_contract_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_monthly_value NUMERIC(12, 2);
    v_rate NUMERIC(5, 2);
    v_curr DATE;
    v_limit DATE;
    v_inserted INTEGER := 0;
    v_comm NUMERIC(12, 2);
BEGIN
    -- Load contract configuration
    SELECT start_date, end_date, monthly_value, commission_rate
    INTO v_start_date, v_end_date, v_monthly_value, v_rate
    FROM public.contracts
    WHERE id = p_contract_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contract % not found.', p_contract_id;
    END IF;
    
    v_curr := date_trunc('month', v_start_date)::DATE;
    
    IF v_end_date IS NOT NULL THEN
        v_limit := date_trunc('month', v_end_date)::DATE;
    ELSE
        v_limit := (v_curr + INTERVAL '12 months')::DATE;
    END IF;
    
    v_comm := v_monthly_value * (v_rate / 100.00);
    
    WHILE v_curr <= v_limit AND v_inserted < 24 LOOP
        INSERT INTO public.commission_schedules (
            contract_id,
            month,
            expected_amount,
            paid_amount,
            status
        ) VALUES (
            p_contract_id,
            v_curr,
            v_comm,
            0.00,
            'pending'
        )
        ON CONFLICT DO NOTHING;
        
        v_curr := (v_curr + INTERVAL '1 month')::DATE;
        v_inserted := v_inserted + 1;
    END LOOP;
    
    RETURN v_inserted;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error executing generate_commission_schedules: %', SQLERRM;
        RETURN 0;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION public.generate_commission_schedules(UUID) IS 'Dynamically provisions a series of monthly billing schedules for a specific contract.';


-- 3. enforce_cancellation_minimums(p_contract_id UUID)
-- Evaluates contract cancellations, flags penalties, and reports final dues.
CREATE OR REPLACE FUNCTION public.enforce_cancellation_minimums(p_contract_id UUID)
RETURNS NUMERIC(12, 2) AS $$
DECLARE
    v_penalty_total NUMERIC(12, 2) := 0.00;
BEGIN
    -- Update future pending schedules to penalty status and apply a 50% cancellation fee
    UPDATE public.commission_schedules
    SET status = 'penalty',
        expected_amount = expected_amount * 0.50,
        updated_at = now()
    WHERE contract_id = p_contract_id 
      AND status = 'pending' 
      AND month > now()::DATE;
      
    -- Sum up current active penalty dues
    SELECT COALESCE(SUM(expected_amount), 0.00) INTO v_penalty_total
    FROM public.commission_schedules
    WHERE contract_id = p_contract_id AND status = 'penalty';
    
    -- Mark current/past pending schedules as cancelled
    UPDATE public.commission_schedules
    SET status = 'cancelled',
        updated_at = now()
    WHERE contract_id = p_contract_id AND status = 'pending';
    
    -- Update contract status
    UPDATE public.contracts
    SET status = 'cancelled',
        updated_at = now()
    WHERE id = p_contract_id;
    
    RETURN v_penalty_total;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error executing enforce_cancellation_minimums: %', SQLERRM;
        RETURN 0.00;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION public.enforce_cancellation_minimums(UUID) IS 'Applies contract termination penalties and returns total penalty dues.';


-- 4. calculate_provider_satisfaction(p_company_id UUID)
-- Calculates the verified average rating of reviews.
CREATE OR REPLACE FUNCTION public.calculate_provider_satisfaction(p_company_id UUID)
RETURNS NUMERIC(5, 2) AS $$
DECLARE
    v_avg NUMERIC(5, 2) := 0.00;
    v_percentage NUMERIC(5, 2) := 0.00;
BEGIN
    SELECT COALESCE(AVG(r.rating), 0.00)::NUMERIC(5, 2) INTO v_avg
    FROM public.reviews r
    JOIN public.engagements e ON e.id = r.engagement_id
    WHERE e.company_id = p_company_id;
    
    -- Convert 5-star rating scale to percentage (e.g. 4.5 stars = 90.00%)
    v_percentage := (v_avg / 5.00) * 100.00;
    
    RETURN v_percentage;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error executing calculate_provider_satisfaction: %', SQLERRM;
        RETURN 0.00;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_provider_satisfaction(UUID) IS 'Averages verified reviews for a company and translates the result into satisfaction percentages.';


-- 5. auto_archive_expired_posts()
-- Archives expired active posts (intended for daily cron jobs).
CREATE OR REPLACE FUNCTION public.auto_archive_expired_posts()
RETURNS INTEGER AS $$
DECLARE
    v_rows INTEGER := 0;
BEGIN
    UPDATE public.procurement_posts
    SET status = 'expired',
        updated_at = now()
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now();
      
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error executing auto_archive_expired_posts: %', SQLERRM;
        RETURN 0;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION public.auto_archive_expired_posts() IS 'Automatically scans for and expires active posts that have passed their expiration timestamps.';
