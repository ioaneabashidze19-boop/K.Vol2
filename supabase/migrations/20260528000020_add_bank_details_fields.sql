-- KavShare Supabase Migration: Add account_number and swift_code columns to company_bank_accounts
-- Migration Date: 2026-05-28

ALTER TABLE IF EXISTS public.company_bank_accounts 
    ADD COLUMN IF NOT EXISTS account_number VARCHAR(50),
    ADD COLUMN IF NOT EXISTS swift_code VARCHAR(30);

COMMENT ON COLUMN public.company_bank_accounts.account_number IS 'Masked or plain account number for local reference.';
COMMENT ON COLUMN public.company_bank_accounts.swift_code IS 'SWIFT/BIC code for the international or local clearing bank.';
