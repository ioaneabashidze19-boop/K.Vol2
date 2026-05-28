-- KavShare Supabase Migration: Add Wise columns to commission_payments
-- Migration Date: 2026-05-28

ALTER TABLE IF EXISTS public.commission_payments
    ADD COLUMN IF NOT EXISTS wise_transfer_id BIGINT,
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 6),
    ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12, 2);

COMMENT ON COLUMN public.commission_payments.wise_transfer_id IS 'Wise payout transfer ID associated with this payment.';
COMMENT ON COLUMN public.commission_payments.exchange_rate IS 'Exchange rate conversion factor applied by Wise.';
COMMENT ON COLUMN public.commission_payments.fee_amount IS 'Service/transaction fee charged by Wise.';
