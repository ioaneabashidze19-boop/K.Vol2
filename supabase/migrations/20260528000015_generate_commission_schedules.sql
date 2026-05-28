-- KavShare Supabase Migration: generate_commission_schedules SQL function
-- Migration Date: 2026-05-28

CREATE OR REPLACE FUNCTION public.generate_commission_schedules(p_contract_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_monthly_value NUMERIC(12, 2);
    v_rate NUMERIC(5, 2);
    v_structure VARCHAR(50);
    v_special_offer_id UUID;
    
    v_discount_type VARCHAR(50);
    v_discount_value NUMERIC(10, 2);
    
    v_curr DATE;
    v_limit DATE;
    v_inserted INTEGER := 0;
    v_net_monthly_value NUMERIC(12, 2);
    v_comm NUMERIC(12, 2);
    v_meta JSONB := '{}'::jsonb;
BEGIN
    -- Load contract configuration
    SELECT start_date, end_date, monthly_value, commission_rate, commission_structure, special_offer_id
    INTO v_start_date, v_end_date, v_monthly_value, v_rate, v_structure, v_special_offer_id
    FROM public.contracts
    WHERE id = p_contract_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contract % not found.', p_contract_id;
    END IF;
    
    -- Load special offer if present
    IF v_special_offer_id IS NOT NULL THEN
        SELECT discount_type, discount_value
        INTO v_discount_type, v_discount_value
        FROM public.special_offers
        WHERE id = v_special_offer_id AND active = true;
    END IF;
    
    -- Calculate discounted base value
    v_net_monthly_value := v_monthly_value;
    IF v_discount_type IS NOT NULL THEN
        IF v_discount_type = 'percentage' THEN
            v_net_monthly_value := v_monthly_value * (1.00 - (v_discount_value / 100.00));
        ELSIF v_discount_type = 'fixed-amount' THEN
            v_net_monthly_value := v_monthly_value - v_discount_value;
        ELSIF v_discount_type = 'free-trial' THEN
            v_net_monthly_value := 0.00;
        END IF;
        
        IF v_net_monthly_value < 0.00 THEN
            v_net_monthly_value := 0.00;
        END IF;
    END IF;

    -- Calculate expected commission amount based on structure
    IF v_structure = 'percentage' THEN
        v_comm := v_net_monthly_value * (v_rate / 100.00);
    ELSIF v_structure = 'flat' THEN
        v_comm := v_rate;
    ELSIF v_structure = 'hybrid' THEN
        v_comm := (v_net_monthly_value * (v_rate / 100.00)) + 50.00; -- hybrid adds $50 flat platform fee
    ELSE
        -- Default fallback to percentage
        v_comm := v_net_monthly_value * (v_rate / 100.00);
    END IF;
    
    v_curr := date_trunc('month', v_start_date)::DATE;
    
    IF v_end_date IS NOT NULL THEN
        v_limit := date_trunc('month', v_end_date)::DATE;
    ELSE
        -- For ongoing contracts (no end date): generate 24 months ahead and add note in metadata
        v_limit := (v_curr + INTERVAL '24 months')::DATE;
        v_meta := jsonb_build_object(
          'renewal_type', 'ongoing_auto_renew',
          'note', 'Automated 24-month rolling forecast term schedule.'
        );
    END IF;
    
    WHILE v_curr <= v_limit AND v_inserted < 24 LOOP
        INSERT INTO public.commission_schedules (
            contract_id,
            month,
            expected_amount,
            paid_amount,
            status,
            metadata
        ) VALUES (
            p_contract_id,
            v_curr,
            v_comm,
            0.00,
            'pending',
            v_meta
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
