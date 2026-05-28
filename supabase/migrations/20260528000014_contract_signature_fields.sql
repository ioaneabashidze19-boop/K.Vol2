-- KavShare Supabase Migration: Contract Signature & Cancellation fields
-- Migration Date: 2026-05-28

ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS signed_by_seeker TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS signed_by_provider TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS commission_structure VARCHAR(50) DEFAULT 'percentage' NOT NULL,
ADD COLUMN IF NOT EXISTS minimum_term_months INTEGER DEFAULT 12 NOT NULL;

-- Column Comments
COMMENT ON COLUMN public.contracts.signed_by_seeker IS 'Timestamp when the seeker signed the contract agreement.';
COMMENT ON COLUMN public.contracts.signed_by_provider IS 'Timestamp when the provider signed the contract agreement.';
COMMENT ON COLUMN public.contracts.cancellation_reason IS 'Reason recorded when the contract status was set to cancelled.';
COMMENT ON COLUMN public.contracts.commission_structure IS 'Structure mode of platform commissions (percentage, flat, hybrid).';
COMMENT ON COLUMN public.contracts.minimum_term_months IS 'Minimum binding contract duration in months before cancellation penalty bails.';

ALTER TABLE public.commission_schedules 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb NOT NULL;

COMMENT ON COLUMN public.commission_schedules.metadata IS 'Audit log and renewal configuration metadata.';
