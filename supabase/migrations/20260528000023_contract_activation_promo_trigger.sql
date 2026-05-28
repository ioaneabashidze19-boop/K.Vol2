-- KavShare Supabase Migration: Generate default promo code on contract activation
-- Migration Date: 2026-05-28

ALTER TABLE public.special_offers ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION public.handle_contract_activation_promo_code()
RETURNS TRIGGER AS $$
DECLARE
    v_company_id UUID;
    v_has_active BOOLEAN;
    v_code VARCHAR(50);
    v_exists BOOLEAN;
    v_attempts INTEGER := 0;
BEGIN
    IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'active') THEN
        -- Get company_id from engagement
        SELECT company_id INTO v_company_id
        FROM public.engagements
        WHERE id = NEW.engagement_id;

        IF v_company_id IS NOT NULL THEN
            -- Check if company already has an active special offer
            SELECT EXISTS (
                SELECT 1 FROM public.special_offers
                WHERE company_id = v_company_id AND active = true
            ) INTO v_has_active;

            IF NOT v_has_active THEN
                -- Loop to generate a unique code and avoid conflicts
                LOOP
                    v_attempts := v_attempts + 1;
                    v_code := 'KAVSH-' || UPPER(substring(md5(random()::text) from 1 for 4));
                    
                    SELECT EXISTS (
                        SELECT 1 FROM public.special_offers WHERE name = v_code
                    ) INTO v_exists;

                    IF NOT v_exists OR v_attempts > 10 THEN
                        EXIT;
                    END IF;
                END LOOP;

                -- Insert default promo code
                INSERT INTO public.special_offers (
                    company_id,
                    name,
                    discount_type,
                    discount_value,
                    active
                ) VALUES (
                    v_company_id,
                    v_code,
                    'percentage',
                    10.00,
                    true
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_contract_activation_promo_code ON public.contracts;
CREATE TRIGGER on_contract_activation_promo_code
    AFTER UPDATE ON public.contracts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_contract_activation_promo_code();

COMMENT ON FUNCTION public.handle_contract_activation_promo_code() IS 'Trigger function to generate a default promo code for a company upon contract activation if none is active.';
