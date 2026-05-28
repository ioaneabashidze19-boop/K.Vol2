-- KavShare Supabase Migration: Add satisfaction_score column to companies table
-- Migration Date: 2026-05-28

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS satisfaction_score NUMERIC(3, 2) DEFAULT 0.00;

COMMENT ON COLUMN public.companies.satisfaction_score IS 'Recalculated rolling satisfaction score metric averaged from verified customer reviews.';
