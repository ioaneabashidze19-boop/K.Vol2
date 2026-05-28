-- KavShare Supabase Migration: Session Attribution & Clicks
-- Migration Date: 2026-05-28
-- Grouping: Marketing referral session attribution and click event telemetry.

-- 1. Session Attribution Table
CREATE TABLE IF NOT EXISTS public.session_attribution (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(255) UNIQUE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table & Column Comments
COMMENT ON TABLE public.session_attribution IS 'Table tracking unique affiliate, reseller, or promotional click sessions.';
COMMENT ON COLUMN public.session_attribution.id IS 'Primary key UUID of the session attribution entry.';
COMMENT ON COLUMN public.session_attribution.token IS 'Unique referral code, hash, or UTM token tracked in cookies/query strings.';
COMMENT ON COLUMN public.session_attribution.company_id IS 'Foreign key referencing the provider company credited for this session.';
COMMENT ON COLUMN public.session_attribution.expires_at IS 'Expiration date when the attribution cookie or session expires.';
COMMENT ON COLUMN public.session_attribution.created_at IS 'Timestamp when the attribution token was generated.';
COMMENT ON COLUMN public.session_attribution.updated_at IS 'Timestamp when the token details were last modified.';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_session_attribution_updated_at BEFORE UPDATE ON public.session_attribution
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.session_attribution ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public select on active session attribution"
ON public.session_attribution FOR SELECT
USING (expires_at > now() OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id()) OR public.get_auth_user_role() = 'admin');

CREATE POLICY "Allow company owners to manage session tokens"
ON public.session_attribution FOR ALL
USING (company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id()) OR public.get_auth_user_role() = 'admin')
WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id()) OR public.get_auth_user_role() = 'admin');

-- Indexes
CREATE INDEX IF NOT EXISTS session_attribution_token_idx ON public.session_attribution (token);
CREATE INDEX IF NOT EXISTS session_attribution_company_id_idx ON public.session_attribution (company_id);


-- 2. Click Events Table
CREATE TABLE IF NOT EXISTS public.click_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.session_attribution(id) ON DELETE CASCADE NOT NULL,
    click_type VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table & Column Comments
COMMENT ON TABLE public.click_events IS 'Table tracking specific visitor interactions associated with a referral session.';
COMMENT ON COLUMN public.click_events.id IS 'Primary key UUID of the click event.';
COMMENT ON COLUMN public.click_events.session_id IS 'Foreign key referencing the parent session attribution.';
COMMENT ON COLUMN public.click_events.click_type IS 'Category of interaction (e.g. view_profile, click_website, request_service).';
COMMENT ON COLUMN public.click_events.ip_address IS 'IP address of the interacting client (for abuse prevention).';
COMMENT ON COLUMN public.click_events.user_agent IS 'Browser user agent string of the interacting client.';
COMMENT ON COLUMN public.click_events.timestamp IS 'Timestamp when the event occurred.';

-- Enable Row Level Security (RLS)
ALTER TABLE public.click_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow anyone to record click events"
ON public.click_events FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow owners to view click events"
ON public.click_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.session_attribution
    WHERE public.session_attribution.id = public.click_events.session_id
    AND public.session_attribution.company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  ) OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Allow admins to modify/delete click events"
ON public.click_events FOR ALL
USING (public.get_auth_user_role() = 'admin')
WITH CHECK (public.get_auth_user_role() = 'admin');

-- Indexes
CREATE INDEX IF NOT EXISTS click_events_session_id_idx ON public.click_events (session_id);
CREATE INDEX IF NOT EXISTS click_events_click_type_idx ON public.click_events (click_type);
CREATE INDEX IF NOT EXISTS click_events_timestamp_idx ON public.click_events (timestamp);
