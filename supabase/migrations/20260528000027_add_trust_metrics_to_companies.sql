-- KavShare Supabase Migration: Add trust metrics columns to companies table
-- Migration Date: 2026-05-28

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS completion_rate NUMERIC(5, 2) DEFAULT 100.00;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS avg_response_time_hours NUMERIC(5, 2) DEFAULT 24.00;

COMMENT ON COLUMN public.companies.completion_rate IS 'Project completion rate percentage calculated for the company provider (0.00 to 100.00).';
COMMENT ON COLUMN public.companies.avg_response_time_hours IS 'Average proposal response time measured in hours.';
