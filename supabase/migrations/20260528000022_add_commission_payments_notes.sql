-- KavShare Supabase Migration: Add admin_notes and metadata JSONB to commission_payments
-- Migration Date: 2026-05-28

ALTER TABLE IF EXISTS public.commission_payments
    ADD COLUMN IF NOT EXISTS admin_notes TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.commission_payments.admin_notes IS 'Notes recorded by admin for manual or special payout validations.';
COMMENT ON COLUMN public.commission_payments.metadata IS 'Custom attributes, manual overrides, and transaction metadata.';
