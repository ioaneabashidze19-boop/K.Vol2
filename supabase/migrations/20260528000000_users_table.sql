-- KavShare Supabase Users Table Migration
-- Migration Date: 2026-05-28

-- 1. Create User Role Enum Type
DO $$ BEGIN
    CREATE TYPE public.user_role_type AS ENUM ('admin', 'provider', 'seeker');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    user_role public.user_role_type DEFAULT 'seeker'::public.user_role_type NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    profile_completed BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
-- Allow public read access to verify profile info (e.g. for sharing file cards)
CREATE POLICY "Allow public read access to users" 
ON public.users FOR SELECT USING (true);

-- Allow authenticated users full self-access (insert, select, update, delete) on their own record
CREATE POLICY "Allow users self-access by clerk_id" 
ON public.users FOR ALL USING (
    clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
) WITH CHECK (
    clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
);

-- 5. Auto-Update Timestamp Trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Indexes for Quick Lookup Checks
CREATE INDEX IF NOT EXISTS users_clerk_id_idx ON public.users (clerk_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);

-- 7. Update existing Files table relation to map to Users (optional cleanup)
-- First drop constraint from profiles if present
ALTER TABLE IF EXISTS public.files DROP CONSTRAINT IF EXISTS files_user_id_fkey;

-- Update files table user_id column from profiles TEXT to users clerk_id TEXT (compat) or UUID
-- To keep DB referencing robust, let's allow files user_id to match clerk_id:
ALTER TABLE IF EXISTS public.files ALTER COLUMN user_id TYPE VARCHAR(255);
ALTER TABLE IF EXISTS public.files ADD CONSTRAINT files_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(clerk_id) ON DELETE SET NULL;
