-- KavShare Supabase Migration: Create leads table and extend session_attribution
-- Migration Date: 2026-05-28

ALTER TABLE IF EXISTS public.session_attribution
    ADD COLUMN IF NOT EXISTS code_used VARCHAR(100),
    ADD COLUMN IF NOT EXISTS last_click TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.session_attribution(id) ON DELETE SET NULL,
    seeker_id UUID REFERENCES public.seekers(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'registered' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anyone to create leads" 
ON public.leads FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow company owners and admins to select leads" 
ON public.leads FOR SELECT 
USING (company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id()) OR public.get_auth_user_role() = 'admin');

CREATE POLICY "Allow admins to manage leads" 
ON public.leads FOR ALL 
USING (public.get_auth_user_role() = 'admin')
WITH CHECK (public.get_auth_user_role() = 'admin');

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS leads_session_id_idx ON public.leads (session_id);
CREATE INDEX IF NOT EXISTS leads_seeker_id_idx ON public.leads (seeker_id);
CREATE INDEX IF NOT EXISTS leads_company_id_idx ON public.leads (company_id);
