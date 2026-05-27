-- KavShare Supabase Admin Audit Logs Migration
-- Migration Date: 2026-05-28

-- 1. Create Admin Audit Logs Table (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    target_type VARCHAR(100),
    target_id VARCHAR(255),
    details JSONB DEFAULT '{}'::jsonb NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Only authenticated admin accounts can query audit logs
CREATE POLICY "Allow admin read access to audit logs" 
ON public.admin_audit_logs FOR SELECT USING (
    (current_setting('request.jwt.claims', true)::json->'metadata'->>'userRole') = 'admin'
);

-- Deny all update/delete actions to preserve log immutability
-- Internal DB writes via backend service role are allowed by default

-- 4. Speed Optimization Indexes
CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_id_idx ON public.admin_audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_action_idx ON public.admin_audit_logs (action);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON public.admin_audit_logs (created_at);
