-- KavShare Supabase Migration: Contracts & Commissions
-- Migration Date: 2026-05-28
-- Grouping: Special offers, contracts, monthly schedules, and actual payments.

-- 1. Special Offers Table
CREATE TABLE IF NOT EXISTS public.special_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    discount_type VARCHAR(50) DEFAULT 'percentage'::character varying NOT NULL,
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value >= 0),
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_discount_type CHECK (discount_type IN ('percentage', 'fixed-amount', 'free-trial'))
);

-- Table & Column Comments
COMMENT ON TABLE public.special_offers IS 'Table mapping promotional discounts and codes created by providers.';
COMMENT ON COLUMN public.special_offers.id IS 'Primary key UUID of the special offer.';
COMMENT ON COLUMN public.special_offers.company_id IS 'Foreign key referencing the company publishing the offer. Null means platform-wide.';
COMMENT ON COLUMN public.special_offers.name IS 'Name or identifier of the promotional code/discount.';
COMMENT ON COLUMN public.special_offers.discount_type IS 'Discount calculation mode (percentage, fixed-amount, free-trial).';
COMMENT ON COLUMN public.special_offers.discount_value IS 'Value indicator (e.g. 15.00 for 15% or $15 fixed discount).';
COMMENT ON COLUMN public.special_offers.active IS 'Toggle defining whether the promo code is currently redeemable.';
COMMENT ON COLUMN public.special_offers.created_at IS 'Timestamp when the offer was created.';
COMMENT ON COLUMN public.special_offers.updated_at IS 'Timestamp when the offer was last modified.';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_special_offers_updated_at BEFORE UPDATE ON public.special_offers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.special_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public select on active special offers" 
ON public.special_offers FOR SELECT 
USING (active = true OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id()) OR public.get_auth_user_role() = 'admin');

CREATE POLICY "Allow providers to manage own special offers" 
ON public.special_offers FOR ALL 
USING (company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id()) OR public.get_auth_user_role() = 'admin')
WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id()) OR public.get_auth_user_role() = 'admin');

-- Indexes
CREATE INDEX IF NOT EXISTS special_offers_company_id_idx ON public.special_offers (company_id);
CREATE INDEX IF NOT EXISTS special_offers_active_idx ON public.special_offers (active);


-- 2. Contracts Table
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    engagement_id UUID REFERENCES public.engagements(id) ON DELETE CASCADE NOT NULL,
    special_offer_id UUID REFERENCES public.special_offers(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'draft'::character varying NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    monthly_value NUMERIC(12, 2) NOT NULL CHECK (monthly_value >= 0),
    commission_rate NUMERIC(5, 2) DEFAULT 0.00 NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_contract_status CHECK (status IN ('draft', 'pending_signatures', 'active', 'completed', 'cancelled'))
);

-- Table & Column Comments
COMMENT ON TABLE public.contracts IS 'Table representing contract billing terms bound to active business engagements.';
COMMENT ON COLUMN public.contracts.id IS 'Primary key UUID of the contract.';
COMMENT ON COLUMN public.contracts.engagement_id IS 'Foreign key referencing the parent business engagement.';
COMMENT ON COLUMN public.contracts.special_offer_id IS 'Foreign key referencing the discount offer applied if any.';
COMMENT ON COLUMN public.contracts.status IS 'Lifecycle state of the contract (draft, pending_signatures, active, completed, cancelled).';
COMMENT ON COLUMN public.contracts.start_date IS 'Calendar date when billing period commences.';
COMMENT ON COLUMN public.contracts.end_date IS 'Optional calendar date when billing period concludes.';
COMMENT ON COLUMN public.contracts.monthly_value IS 'Reoccurring monthly value or project amount payable.';
COMMENT ON COLUMN public.contracts.commission_rate IS 'Percentage commission rate due to the platform (0.00 to 100.00).';
COMMENT ON COLUMN public.contracts.created_at IS 'Timestamp when the contract draft was initialized.';
COMMENT ON COLUMN public.contracts.updated_at IS 'Timestamp when the contract record was last modified.';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow participants to select contracts"
ON public.contracts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.engagements
    WHERE public.engagements.id = public.contracts.engagement_id
    AND (
      public.engagements.seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
      OR public.engagements.company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
    )
  ) OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Allow participants to manage contracts"
ON public.contracts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.engagements
    WHERE public.engagements.id = public.contracts.engagement_id
    AND (
      public.engagements.seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
      OR public.engagements.company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
    )
  ) OR public.get_auth_user_role() = 'admin'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.engagements
    WHERE public.engagements.id = public.contracts.engagement_id
    AND (
      public.engagements.seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
      OR public.engagements.company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
    )
  ) OR public.get_auth_user_role() = 'admin'
);

-- Indexes
CREATE INDEX IF NOT EXISTS contracts_engagement_id_idx ON public.contracts (engagement_id);
CREATE INDEX IF NOT EXISTS contracts_status_idx ON public.contracts (status);


-- 3. Commission Schedules Table
CREATE TABLE IF NOT EXISTS public.commission_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
    month DATE NOT NULL,
    expected_amount NUMERIC(12, 2) NOT NULL CHECK (expected_amount >= 0),
    paid_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (paid_amount >= 0),
    status VARCHAR(50) DEFAULT 'pending'::character varying NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_schedule_status CHECK (status IN ('pending', 'processing', 'paid', 'overdue', 'penalty', 'cancelled'))
);

-- Table & Column Comments
COMMENT ON TABLE public.commission_schedules IS 'Table tracking pending and processed monthly platform commissions.';
COMMENT ON COLUMN public.commission_schedules.id IS 'Primary key UUID of the commission schedule entry.';
COMMENT ON COLUMN public.commission_schedules.contract_id IS 'Foreign key referencing the parent contract.';
COMMENT ON COLUMN public.commission_schedules.month IS 'First day of the calendar month this schedule targets.';
COMMENT ON COLUMN public.commission_schedules.expected_amount IS 'The expected commission value payable to the platform.';
COMMENT ON COLUMN public.commission_schedules.paid_amount IS 'The actual paid commission amount.';
COMMENT ON COLUMN public.commission_schedules.status IS 'Billing status (pending, processing, paid, overdue, penalty, cancelled).';
COMMENT ON COLUMN public.commission_schedules.created_at IS 'Timestamp when the schedule row was created.';
COMMENT ON COLUMN public.commission_schedules.updated_at IS 'Timestamp when the schedule row was last modified.';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_commission_schedules_updated_at BEFORE UPDATE ON public.commission_schedules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.commission_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow providers to select own schedules"
ON public.commission_schedules FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts
    JOIN public.engagements ON public.engagements.id = public.contracts.engagement_id
    WHERE public.contracts.id = public.commission_schedules.contract_id
    AND public.engagements.company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  ) OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Allow admins to manage schedules"
ON public.commission_schedules FOR ALL
USING (public.get_auth_user_role() = 'admin')
WITH CHECK (public.get_auth_user_role() = 'admin');

-- Indexes
CREATE INDEX IF NOT EXISTS commission_schedules_contract_id_idx ON public.commission_schedules (contract_id);
CREATE INDEX IF NOT EXISTS commission_schedules_status_idx ON public.commission_schedules (status);
CREATE INDEX IF NOT EXISTS commission_schedules_month_idx ON public.commission_schedules (month);


-- 4. Commission Payments Table
CREATE TABLE IF NOT EXISTS public.commission_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    payment_method VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending'::character varying NOT NULL,
    reference VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_payment_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded'))
);

-- Table & Column Comments
COMMENT ON TABLE public.commission_payments IS 'Financial ledger recording payout payments completed from providers to the platform.';
COMMENT ON COLUMN public.commission_payments.id IS 'Primary key UUID of the payment ledger entry.';
COMMENT ON COLUMN public.commission_payments.company_id IS 'Foreign key referencing the provider company paying the commission.';
COMMENT ON COLUMN public.commission_payments.amount IS 'Total payment amount processed.';
COMMENT ON COLUMN public.commission_payments.payment_method IS 'Payment service used (e.g. Stripe, bank-transfer, card).';
COMMENT ON COLUMN public.commission_payments.status IS 'Payment gateway status (pending, processing, completed, failed, refunded).';
COMMENT ON COLUMN public.commission_payments.reference IS 'External processor reference ID or invoice number (e.g., Stripe Payout ID).';
COMMENT ON COLUMN public.commission_payments.paid_at IS 'Timestamp when the payment was confirmed successful.';
COMMENT ON COLUMN public.commission_payments.created_at IS 'Timestamp when payment session was registered.';
COMMENT ON COLUMN public.commission_payments.updated_at IS 'Timestamp when payment state was last synced.';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_commission_payments_updated_at BEFORE UPDATE ON public.commission_payments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow providers to select own payments"
ON public.commission_payments FOR SELECT
USING (
  company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Allow admins to manage payments"
ON public.commission_payments FOR ALL
USING (public.get_auth_user_role() = 'admin')
WITH CHECK (public.get_auth_user_role() = 'admin');

-- Indexes
CREATE INDEX IF NOT EXISTS commission_payments_company_id_idx ON public.commission_payments (company_id);
CREATE INDEX IF NOT EXISTS commission_payments_status_idx ON public.commission_payments (status);
CREATE INDEX IF NOT EXISTS commission_payments_reference_idx ON public.commission_payments (reference);
