-- KavShare Supabase Migration: Wise transfer tables
-- Migration Date: 2026-05-28

-- 1. Company bank accounts (Georgian IBAN store)
CREATE TABLE IF NOT EXISTS public.company_bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
    account_holder_name VARCHAR(200) NOT NULL,
    iban VARCHAR(34) NOT NULL,         -- normalised, no spaces, uppercase
    bank_name VARCHAR(100),
    currency VARCHAR(10) DEFAULT 'GEL' NOT NULL,
    country VARCHAR(2) DEFAULT 'GE' NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    wise_recipient_id BIGINT,          -- cached Wise account ID to avoid re-creation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.company_bank_accounts IS 'Georgian IBAN payout accounts linked to provider companies.';
COMMENT ON COLUMN public.company_bank_accounts.wise_recipient_id IS 'Cached Wise recipient account ID to avoid duplicate creation.';

CREATE TRIGGER update_company_bank_accounts_updated_at
    BEFORE UPDATE ON public.company_bank_accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.company_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers can manage their own bank accounts"
    ON public.company_bank_accounts FOR ALL
    USING (company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id()))
    WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id()));

CREATE POLICY "Admins can manage all bank accounts"
    ON public.company_bank_accounts FOR ALL
    USING (public.get_auth_user_role() = 'admin')
    WITH CHECK (public.get_auth_user_role() = 'admin');

CREATE INDEX IF NOT EXISTS company_bank_accounts_company_id_idx ON public.company_bank_accounts (company_id);


-- 2. Wise transfers ledger
CREATE TABLE IF NOT EXISTS public.wise_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID REFERENCES public.commission_schedules(id) ON DELETE SET NULL UNIQUE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    transfer_id BIGINT NOT NULL,         -- Wise numeric transfer ID
    quote_id VARCHAR(100),
    source_currency VARCHAR(10) NOT NULL,
    target_currency VARCHAR(10) NOT NULL,
    source_amount NUMERIC(12, 2) NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL,
    rate NUMERIC(12, 6),
    status VARCHAR(100) DEFAULT 'processing' NOT NULL,
    reference VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.wise_transfers IS 'Wise API transfer records for provider commission payouts.';
COMMENT ON COLUMN public.wise_transfers.transfer_id IS 'Numeric transfer ID returned by the Wise API.';
COMMENT ON COLUMN public.wise_transfers.status IS 'Latest Wise transfer status (outgoing_payment_sent, funds_refunded, etc).';

CREATE TRIGGER update_wise_transfers_updated_at
    BEFORE UPDATE ON public.wise_transfers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.wise_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers can view their own transfers"
    ON public.wise_transfers FOR SELECT
    USING (company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
           OR public.get_auth_user_role() = 'admin');

CREATE POLICY "Admins can manage all transfers"
    ON public.wise_transfers FOR ALL
    USING (public.get_auth_user_role() = 'admin')
    WITH CHECK (public.get_auth_user_role() = 'admin');

CREATE INDEX IF NOT EXISTS wise_transfers_schedule_id_idx ON public.wise_transfers (schedule_id);
CREATE INDEX IF NOT EXISTS wise_transfers_company_id_idx ON public.wise_transfers (company_id);
CREATE INDEX IF NOT EXISTS wise_transfers_transfer_id_idx ON public.wise_transfers (transfer_id);
