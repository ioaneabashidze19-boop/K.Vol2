-- KavShare Supabase Migration: enforce_cancellation_minimums SQL function
-- Migration Date: 2026-05-28

CREATE OR REPLACE FUNCTION public.enforce_cancellation_minimums(p_contract_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_start_date DATE;
    v_min_months INTEGER;
    v_status VARCHAR(50);
    v_company_id UUID;
    v_min_end_date DATE;
    v_penalty_total NUMERIC(12, 2) := 0.00;
    v_penalty_count INTEGER := 0;
    v_res JSONB;
BEGIN
    -- Fetch contract details
    SELECT c.start_date, c.minimum_term_months, c.status, e.company_id
    INTO v_start_date, v_min_months, v_status, v_company_id
    FROM public.contracts c
    JOIN public.engagements e ON e.id = c.engagement_id
    WHERE c.id = p_contract_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contract % not found.', p_contract_id;
    END IF;

    -- Calculate minimum term end date
    v_min_end_date := (v_start_date + (v_min_months || ' months')::INTERVAL)::DATE;

    -- If status is 'cancelled'
    IF v_status = 'cancelled' THEN
        
        -- 1. Identify and update all pending schedules after today but before minimum end
        -- Set status = 'penalty', update metadata
        UPDATE public.commission_schedules
        SET status = 'penalty',
            metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{note}', '"Cancellation penalty"'),
            updated_at = now()
        WHERE contract_id = p_contract_id
          AND status = 'pending'
          AND month > CURRENT_DATE
          AND month < v_min_end_date;

        -- Sum penalty amounts and count
        SELECT COALESCE(SUM(expected_amount), 0.00), COUNT(*)
        INTO v_penalty_total, v_penalty_count
        FROM public.commission_schedules
        WHERE contract_id = p_contract_id
          AND status = 'penalty'
          AND month > CURRENT_DATE
          AND month < v_min_end_date;

        -- 2. Create single penalty entry in commission_payments if penalty amount > 0
        IF v_penalty_total > 0.00 THEN
            INSERT INTO public.commission_payments (
                company_id,
                amount,
                payment_method,
                status,
                reference
            ) VALUES (
                v_company_id,
                v_penalty_total,
                'ledger_penalty',
                'pending',
                'PENALTY-' || UPPER(SUBSTRING(p_contract_id::TEXT FROM 1 FOR 8))
            );
        END IF;

        -- 3. Cancel all remaining pending schedules (after minimum end date) normally with no penalties
        UPDATE public.commission_schedules
        SET status = 'cancelled',
            updated_at = now()
        WHERE contract_id = p_contract_id
          AND status = 'pending'
          AND month >= v_min_end_date;

        -- Send alert log notification (raises PostgreSQL notice)
        RAISE NOTICE '[KavShare Platform Admin Alert] Contract % cancelled. Term Minimum Violated. Total Penalty Amount Due: $%', p_contract_id, v_penalty_total;

    END IF;

    v_res := jsonb_build_object(
        'penaltyAmount', v_penalty_total,
        'penaltyScheduleCount', v_penalty_count
    );

    RETURN v_res;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error executing enforce_cancellation_minimums: %', SQLERRM;
        RETURN jsonb_build_object('penaltyAmount', 0.00, 'penaltyScheduleCount', 0);
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION public.enforce_cancellation_minimums(UUID) IS 'Applies contract termination penalties and returns total penalty dues.';
