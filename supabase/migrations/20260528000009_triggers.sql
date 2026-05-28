-- KavShare Supabase Migration: Database Triggers & Automation
-- Migration Date: 2026-05-28
-- Grouping: Platform-wide triggers, automation procedures, and notifications.

-- 0. Prerequisites: Alter tables to add rating cache, payment references, and notifications
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) DEFAULT 0.00;
ALTER TABLE public.commission_payments ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.commission_schedules(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false NOT NULL,
    link_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table & Column Comments for Notifications
COMMENT ON TABLE public.notifications IS 'Platform notifications sent to users on key business events and chat messages.';
COMMENT ON COLUMN public.notifications.id IS 'Primary key UUID of the notification.';
COMMENT ON COLUMN public.notifications.user_id IS 'Foreign key referencing the recipient user.';
COMMENT ON COLUMN public.notifications.title IS 'Summary title of the notification.';
COMMENT ON COLUMN public.notifications.content IS 'Detailed description or preview text of the event.';
COMMENT ON COLUMN public.notifications.is_read IS 'Read/unread toggle for user inbox states.';
COMMENT ON COLUMN public.notifications.link_url IS 'Internal app redirect URL for the notification target.';
COMMENT ON COLUMN public.notifications.created_at IS 'Timestamp when the notification was created.';

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to view own notifications"
ON public.notifications FOR SELECT
USING (user_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin');

CREATE POLICY "Allow users to update own notifications"
ON public.notifications FOR UPDATE
USING (user_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin')
WITH CHECK (user_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin');

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON public.notifications (is_read);


-- 1. Trigger 1: on_auth_user_created (User Profile Auto-Provisioning on users table insert)
CREATE OR REPLACE FUNCTION public.handle_public_user_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Provision seeker profile if role matches
    IF NEW.user_role = 'seeker'::public.user_role_type THEN
        INSERT INTO public.seekers (user_id, company_name)
        VALUES (NEW.id, 'My Organization')
        ON CONFLICT (user_id) DO NOTHING;
        
    -- Provision company/provider profile if role matches
    ELSIF NEW.user_role = 'provider'::public.user_role_type THEN
        INSERT INTO public.companies (owner_id, name, status)
        VALUES (NEW.id, COALESCE(NEW.first_name || ' ' || NEW.last_name, 'New Provider Company'), 'pending')
        ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error provisioning profile triggers for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_public_user_insert ON public.users;
CREATE TRIGGER on_public_user_insert
    AFTER INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_public_user_insert();

COMMENT ON FUNCTION public.handle_public_user_insert() IS 'Auto-provisions seeker or provider profile records upon user registration.';


-- 2. Trigger 2: on_contract_activated (Generates commission schedules when contract goes active)
CREATE OR REPLACE FUNCTION public.handle_contract_activation()
RETURNS TRIGGER AS $$
DECLARE
    curr_date DATE;
    end_date_limit DATE;
    months_count INTEGER := 0;
    expected_comm NUMERIC(12, 2);
BEGIN
    IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'active') THEN
        curr_date := date_trunc('month', NEW.start_date)::DATE;
        
        -- Determine end date limits
        IF NEW.end_date IS NOT NULL THEN
            end_date_limit := date_trunc('month', NEW.end_date)::DATE;
        ELSE
            end_date_limit := (curr_date + INTERVAL '12 months')::DATE;
        END IF;
        
        expected_comm := NEW.monthly_value * (NEW.commission_rate / 100.00);
        
        WHILE curr_date <= end_date_limit AND months_count < 24 LOOP
            INSERT INTO public.commission_schedules (
                contract_id,
                month,
                expected_amount,
                paid_amount,
                status
            ) VALUES (
                NEW.id,
                curr_date,
                expected_comm,
                0.00,
                'pending'
            );
            
            curr_date := (curr_date + INTERVAL '1 month')::DATE;
            months_count := months_count + 1;
        END LOOP;
    END IF;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error generating commission schedules for contract %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_contract_activated ON public.contracts;
CREATE TRIGGER on_contract_activated
    AFTER UPDATE OF status ON public.contracts
    FOR EACH ROW EXECUTE FUNCTION public.handle_contract_activation();

COMMENT ON FUNCTION public.handle_contract_activation() IS 'Fires when a contract becomes active, dynamically generating expected monthly platform commissions.';


-- 3. Trigger 3: on_contract_cancelled (Processes cancellation penalties and overrides future schedules)
CREATE OR REPLACE FUNCTION public.handle_contract_cancellation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'cancelled' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'cancelled') THEN
        -- Mark future pending schedules as penalty/cancelled
        UPDATE public.commission_schedules
        SET status = 'penalty',
            expected_amount = expected_amount * 0.50, -- 50% termination penalty
            updated_at = now()
        WHERE contract_id = NEW.id AND status = 'pending' AND month > now()::DATE;
        
        -- Cancel current/past pending schedules
        UPDATE public.commission_schedules
        SET status = 'cancelled',
            updated_at = now()
        WHERE contract_id = NEW.id AND status = 'pending' AND month <= now()::DATE;
    END IF;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error processing contract cancellation penalties for contract %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_contract_cancelled ON public.contracts;
CREATE TRIGGER on_contract_cancelled
    AFTER UPDATE OF status ON public.contracts
    FOR EACH ROW EXECUTE FUNCTION public.handle_contract_cancellation();

COMMENT ON FUNCTION public.handle_contract_cancellation() IS 'Calculates contract termination penalties and marks schedules as penalty or cancelled.';


-- 4. Trigger 4: on_review_submitted (Recalculates provider satisfaction score)
CREATE OR REPLACE FUNCTION public.recalculate_provider_satisfaction()
RETURNS TRIGGER AS $$
DECLARE
    v_company_id UUID;
    v_avg_rating NUMERIC(3, 2);
BEGIN
    SELECT company_id INTO v_company_id
    FROM public.engagements
    WHERE id = COALESCE(NEW.engagement_id, OLD.engagement_id);
    
    IF v_company_id IS NOT NULL THEN
        SELECT COALESCE(AVG(rating), 0.00)::NUMERIC(3, 2) INTO v_avg_rating
        FROM public.reviews r
        JOIN public.engagements e ON e.id = r.engagement_id
        WHERE e.company_id = v_company_id;
        
        UPDATE public.companies
        SET rating = v_avg_rating,
            updated_at = now()
        WHERE id = v_company_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error recalculating provider company rating: %', SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_review_submitted ON public.reviews;
CREATE TRIGGER on_review_submitted
    AFTER INSERT OR UPDATE OR DELETE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_provider_satisfaction();

COMMENT ON FUNCTION public.recalculate_provider_satisfaction() IS 'Aggregates star ratings on submitted testimonials to update company ratings caches.';


-- 5. Trigger 5: on_engagement_completed (Enables review submission verification logging)
CREATE OR REPLACE FUNCTION public.handle_engagement_completed()
RETURNS TRIGGER AS $$
DECLARE
    v_seeker_user_id UUID;
    v_company_name VARCHAR(255);
BEGIN
    IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed') THEN
        -- Find seeker user details
        SELECT s.user_id, c.name INTO v_seeker_user_id, v_company_name
        FROM public.engagements e
        JOIN public.seekers s ON s.id = e.seeker_id
        JOIN public.companies c ON c.id = e.company_id
        WHERE e.id = NEW.id;
        
        -- Create a notification for the seeker to write a review
        IF v_seeker_user_id IS NOT NULL THEN
            INSERT INTO public.notifications (
                user_id,
                title,
                content,
                link_url
            ) VALUES (
                v_seeker_user_id,
                'Leave a review for ' || COALESCE(v_company_name, 'your provider'),
                'Your engagement has concluded successfully. Please leave your rating and testimonial.',
                '/dashboard/seeker/contracts'
            );
        END IF;
    END IF;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error handling notification for completed engagement %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_engagement_completed ON public.engagements;
CREATE TRIGGER on_engagement_completed
    AFTER UPDATE OF status ON public.engagements
    FOR EACH ROW EXECUTE FUNCTION public.handle_engagement_completed();

COMMENT ON FUNCTION public.handle_engagement_completed() IS 'Fires on engagement close to notify seekers that review submissions are unlocked.';


-- 6. Trigger 6: on_payment_recorded (Updates commission schedule status)
CREATE OR REPLACE FUNCTION public.handle_payment_recorded()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed') THEN
        IF NEW.schedule_id IS NOT NULL THEN
            UPDATE public.commission_schedules
            SET status = 'paid',
                paid_amount = expected_amount,
                updated_at = now()
            WHERE id = NEW.schedule_id;
        END IF;
    END IF;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error updating commission schedule status on payment completed: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_recorded ON public.commission_payments;
CREATE TRIGGER on_payment_recorded
    AFTER INSERT OR UPDATE OF status ON public.commission_payments
    FOR EACH ROW EXECUTE FUNCTION public.handle_payment_recorded();

COMMENT ON FUNCTION public.handle_payment_recorded() IS 'Reconciles monthly commission schedules automatically when payout payments succeed.';


-- 7. Trigger 7: on_chat_message_sent (Updates conversation timestamp and creates notification)
CREATE OR REPLACE FUNCTION public.handle_chat_message_sent()
RETURNS TRIGGER AS $$
DECLARE
    v_seeker_user_id UUID;
    v_company_owner_id UUID;
    v_recipient_id UUID;
    v_sender_name VARCHAR(255);
BEGIN
    -- Update conversation timestamp
    UPDATE public.conversations
    SET updated_at = now()
    WHERE id = NEW.conversation_id;
    
    -- Resolve recipient details
    SELECT s.user_id, c.owner_id INTO v_seeker_user_id, v_company_owner_id
    FROM public.conversations conv
    JOIN public.seekers s ON s.id = conv.seeker_id
    JOIN public.companies c ON c.id = conv.company_id
    WHERE conv.id = NEW.conversation_id;
    
    -- Fetch sender name info
    SELECT COALESCE(first_name || ' ' || last_name, email) INTO v_sender_name
    FROM public.users
    WHERE id = NEW.sender_id;
    
    IF NEW.sender_id = v_seeker_user_id THEN
        v_recipient_id := v_company_owner_id;
    ELSE
        v_recipient_id := v_seeker_user_id;
    END IF;
    
    -- Insert new chat notification
    IF v_recipient_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            user_id,
            title,
            content,
            link_url
        ) VALUES (
            v_recipient_id,
            'New message from ' || COALESCE(v_sender_name, 'User'),
            substring(NEW.content from 1 for 100),
            '/chat/' || NEW.conversation_id
        );
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error executing chat message notification triggers: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_chat_message_sent ON public.chat_messages;
CREATE TRIGGER on_chat_message_sent
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_chat_message_sent();

COMMENT ON FUNCTION public.handle_chat_message_sent() IS 'Triggers updates to parent chat threads and fires inbox notification cards to recipients.';
