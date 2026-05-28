-- KavShare Supabase Migration: Application Audit Logs
-- Migration Date: 2026-05-28
-- Grouping: Platform-wide security and modification audit trail (Immutable).

-- 1. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    table_name VARCHAR(100),
    record_id VARCHAR(255),
    details JSONB DEFAULT '{}'::jsonb NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table & Column Comments
COMMENT ON TABLE public.audit_logs IS 'Immutable security and activity audit log tracking data mutations and user activities.';
COMMENT ON COLUMN public.audit_logs.id IS 'Primary key UUID of the audit log entry.';
COMMENT ON COLUMN public.audit_logs.action IS 'Name of the action performed (e.g. update_profile, delete_service, create_contract).';
COMMENT ON COLUMN public.audit_logs.user_id IS 'Foreign key referencing the user who initiated the action.';
COMMENT ON COLUMN public.audit_logs.table_name IS 'Target database table affected by the action.';
COMMENT ON COLUMN public.audit_logs.record_id IS 'String representation of the key of the modified database record.';
COMMENT ON COLUMN public.audit_logs.details IS 'Structured JSON metadata containing old vs new values or request payload details.';
COMMENT ON COLUMN public.audit_logs.timestamp IS 'Timestamp when the event occurred.';

-- Enable Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow select on audit logs only for admins"
ON public.audit_logs FOR SELECT
USING (public.get_auth_user_role() = 'admin');

CREATE POLICY "Allow inserts on audit logs for authenticated users"
ON public.audit_logs FOR INSERT
WITH CHECK (user_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin');

-- Deny all update/delete actions to preserve log immutability
-- Implicitly handled as no UPDATE/DELETE policies are defined.

-- Indexes for Quick Audits
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_table_name_idx ON public.audit_logs (table_name);
CREATE INDEX IF NOT EXISTS audit_logs_timestamp_idx ON public.audit_logs (timestamp);
