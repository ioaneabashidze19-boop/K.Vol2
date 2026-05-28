-- KavShare Supabase Initial Database Schema (Clerk Auth Compatible)
-- Migration Date: 2026-05-27

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles Table (Linked to Clerk User IDs)
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY, -- Clerk User ID (e.g. user_2Nizn3...)
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'seeker' NOT NULL, -- 'provider' or 'seeker'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Allow public read access to profiles" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Allow users to update their own profile" 
ON public.profiles FOR UPDATE USING (id = current_setting('request.jwt.claims', true)::json->>'sub');

-- 3. Files Table (Metadata of uploaded shares)
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    is_encrypted BOOLEAN DEFAULT false NOT NULL,
    download_count INTEGER DEFAULT 0 NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for files
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Files Policies
CREATE POLICY "Allow public read/download by file ID" 
ON public.files FOR SELECT USING (expires_at IS NULL OR expires_at > now());

CREATE POLICY "Allow users to upload and manage their files" 
ON public.files FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- 4. Downloads Logging Table
CREATE TABLE IF NOT EXISTS public.downloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES public.files(id) ON DELETE CASCADE NOT NULL,
    ip_address_hash TEXT,
    user_agent TEXT,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for downloads
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

-- Downloads Policies
CREATE POLICY "Allow insert downloads logging to anyone" 
ON public.downloads FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow owners to view download logs of their files" 
ON public.downloads FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.files 
        WHERE public.files.id = public.downloads.file_id 
        AND public.files.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
);

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

-- 7. Update existing Files table relation to map to Users
-- Drop the RLS policy that references user_id before altering the column type
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'files'
          AND policyname = 'Allow users to upload and manage their files'
    ) THEN
        DROP POLICY "Allow users to upload and manage their files" ON public.files;
    END IF;
END $$;

-- Drop old foreign key constraint if present
ALTER TABLE IF EXISTS public.files DROP CONSTRAINT IF EXISTS files_user_id_fkey;

-- Alter column type to VARCHAR(255) to hold Clerk IDs
ALTER TABLE IF EXISTS public.files ALTER COLUMN user_id TYPE VARCHAR(255);

-- Recreate the foreign key pointing to users.clerk_id
ALTER TABLE IF EXISTS public.files ADD CONSTRAINT files_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(clerk_id) ON DELETE SET NULL;

-- Recreate the RLS policy with the updated column type
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'files' AND table_schema = 'public') THEN
        EXECUTE $policy$
            CREATE POLICY "Allow users to upload and manage their files"
            ON public.files FOR ALL
            USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
        $policy$;
    END IF;
END $$;

-- KavShare Supabase Profiles & Triggers Migration
-- Migration Date: 2026-05-28

-- 1. Create Extended User Profiles Table (pointing to auth.users for native Supabase auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    user_role public.user_role_type DEFAULT 'seeker'::public.user_role_type NOT NULL,
    company_name VARCHAR(255),
    bio TEXT,
    website TEXT,
    phone VARCHAR(50),
    profile_completed BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Define RLS Policies with Comprehensive Comments
-- Policy A: Allow public read access to active profiles so other users can see shared file details
CREATE POLICY "Allow public read access to profiles"
ON public.profiles FOR SELECT USING (true);

-- Policy B: Allow user to manage (update) their own profile data matching their active session ID
CREATE POLICY "Allow individual profile updates"
ON public.profiles FOR UPDATE USING (
    auth.uid() = id
) WITH CHECK (
    auth.uid() = id
);

-- Policy C: Allow individual profile deletion in case of account closure
CREATE POLICY "Allow individual profile deletion"
ON public.profiles FOR DELETE USING (
    auth.uid() = id
);

-- 4. Database Trigger Function to auto-provision profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        email, 
        first_name, 
        last_name, 
        avatar_url, 
        user_role, 
        profile_completed
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        COALESCE((NEW.raw_user_meta_data->>'user_role')::public.user_role_type, 'seeker'::public.user_role_type),
        false
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Bind Trigger to auth.users Table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Trigger to auto-update updated_at timestamp on updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Performance Optimization Indexes
CREATE INDEX IF NOT EXISTS profiles_user_role_idx ON public.profiles (user_role);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);

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

-- KavShare Supabase Migration: Core Profiles & Service Catalog
-- Migration Date: 2026-05-28
-- Grouping: Core profiles (companies, seekers) and service offerings catalog.

-- 1. Helper functions for RLS checks (using Security Definer to query public.users securely)
CREATE OR REPLACE FUNCTION public.get_auth_user_id()
RETURNS UUID AS $$
DECLARE
  user_id_val UUID;
BEGIN
  SELECT id INTO user_id_val FROM public.users
  WHERE clerk_id = current_setting('request.jwt.claims', true)::json->>'sub';
  RETURN user_id_val;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_auth_user_id() IS 'Retrieves the UUID of the currently authenticated Clerk user.';

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS public.user_role_type AS $$
DECLARE
  role_val public.user_role_type;
BEGIN
  SELECT user_role INTO role_val FROM public.users
  WHERE clerk_id = current_setting('request.jwt.claims', true)::json->>'sub';
  RETURN COALESCE(role_val, 'seeker'::public.user_role_type);
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'seeker'::public.user_role_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_auth_user_role() IS 'Retrieves the user role enum value of the currently authenticated Clerk user.';

-- 2. Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    founded_year INTEGER CHECK (founded_year >= 1800 AND founded_year <= extract(year from now())),
    employee_count INTEGER CHECK (employee_count >= 1),
    location VARCHAR(255),
    website VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending'::character varying NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_company_status CHECK (status IN ('pending', 'active', 'suspended'))
);

-- Table & Column Comments
COMMENT ON TABLE public.companies IS 'Table representing registered provider companies on KavShare.';
COMMENT ON COLUMN public.companies.id IS 'Primary key UUID of the company.';
COMMENT ON COLUMN public.companies.owner_id IS 'Foreign key referencing the user owner of this company.';
COMMENT ON COLUMN public.companies.name IS 'Legal and display name of the company.';
COMMENT ON COLUMN public.companies.description IS 'Detailed biography and overview text of the company.';
COMMENT ON COLUMN public.companies.logo_url IS 'CDN link or storage path to the company''s logo image.';
COMMENT ON COLUMN public.companies.banner_url IS 'CDN link or storage path to the company''s banner image.';
COMMENT ON COLUMN public.companies.founded_year IS 'The calendar year the company was founded.';
COMMENT ON COLUMN public.companies.employee_count IS 'The approximate number of employees working at the company.';
COMMENT ON COLUMN public.companies.location IS 'Geographic location or address of the company headquarters.';
COMMENT ON COLUMN public.companies.website IS 'Main homepage URL of the company.';
COMMENT ON COLUMN public.companies.status IS 'Verification status of the company (pending, active, suspended).';
COMMENT ON COLUMN public.companies.created_at IS 'Timestamp when the company record was initialized.';
COMMENT ON COLUMN public.companies.updated_at IS 'Timestamp when the company record was last updated.';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public select on active companies" 
ON public.companies FOR SELECT 
USING (status = 'active' OR owner_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin');

CREATE POLICY "Allow owners to insert companies" 
ON public.companies FOR INSERT 
WITH CHECK (owner_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin');

CREATE POLICY "Allow owners to update their own companies" 
ON public.companies FOR UPDATE 
USING (owner_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin')
WITH CHECK (owner_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin');

CREATE POLICY "Allow owners to delete their own companies" 
ON public.companies FOR DELETE 
USING (owner_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin');

-- Indexes
CREATE INDEX IF NOT EXISTS companies_owner_id_idx ON public.companies (owner_id);
CREATE INDEX IF NOT EXISTS companies_status_idx ON public.companies (status);


-- 3. Services Table
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    category VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    delivery_format VARCHAR(100) CHECK (delivery_format IN ('fixed-price', 'hourly', 'subscription', 'custom')),
    tech_stack VARCHAR(100)[] DEFAULT '{}'::VARCHAR(100)[] NOT NULL,
    starting_price NUMERIC(12, 2) CHECK (starting_price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table & Column Comments
COMMENT ON TABLE public.services IS 'Table detailing the services offered by companies.';
COMMENT ON COLUMN public.services.id IS 'Primary key UUID of the service offering.';
COMMENT ON COLUMN public.services.company_id IS 'Foreign key referencing the company providing the service.';
COMMENT ON COLUMN public.services.category IS 'Marketplace category under which this service falls.';
COMMENT ON COLUMN public.services.name IS 'Name or title of the service offering.';
COMMENT ON COLUMN public.services.description IS 'Detailed description of the service deliverables and terms.';
COMMENT ON COLUMN public.services.delivery_format IS 'Pricing and delivery structure (fixed-price, hourly, subscription, custom).';
COMMENT ON COLUMN public.services.tech_stack IS 'Array of technologies, languages, or tools utilized in the service.';
COMMENT ON COLUMN public.services.starting_price IS 'The minimum/starting price for the service offering.';
COMMENT ON COLUMN public.services.created_at IS 'Timestamp when the service was added.';
COMMENT ON COLUMN public.services.updated_at IS 'Timestamp when the service details were last modified.';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public select on services of active companies" 
ON public.services FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.companies 
        WHERE public.companies.id = public.services.company_id 
        AND (public.companies.status = 'active' OR public.companies.owner_id = public.get_auth_user_id())
    ) OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Allow company owners to manage services" 
ON public.services FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.companies 
        WHERE public.companies.id = public.services.company_id 
        AND public.companies.owner_id = public.get_auth_user_id()
    ) OR public.get_auth_user_role() = 'admin'
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.companies 
        WHERE public.companies.id = public.services.company_id 
        AND public.companies.owner_id = public.get_auth_user_id()
    ) OR public.get_auth_user_role() = 'admin'
);

-- Indexes
CREATE INDEX IF NOT EXISTS services_company_id_idx ON public.services (company_id);
CREATE INDEX IF NOT EXISTS services_category_idx ON public.services (category);


-- 4. Seekers Table
CREATE TABLE IF NOT EXISTS public.seekers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    company_name VARCHAR(255),
    company_size VARCHAR(50),
    industry VARCHAR(100),
    budget_range VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table & Column Comments
COMMENT ON TABLE public.seekers IS 'Table representing client/seeker profiles on KavShare.';
COMMENT ON COLUMN public.seekers.id IS 'Primary key UUID of the seeker profile.';
COMMENT ON COLUMN public.seekers.user_id IS 'Foreign key referencing the associated user account.';
COMMENT ON COLUMN public.seekers.company_name IS 'Name of the seeker''s organization or business.';
COMMENT ON COLUMN public.seekers.company_size IS 'Range indicator of the organization size (e.g. 1-10, 11-50, etc.).';
COMMENT ON COLUMN public.seekers.industry IS 'Primary industry sector in which the seeker operates.';
COMMENT ON COLUMN public.seekers.budget_range IS 'Default budget target range for projects.';
COMMENT ON COLUMN public.seekers.created_at IS 'Timestamp when the seeker profile was created.';
COMMENT ON COLUMN public.seekers.updated_at IS 'Timestamp when the seeker profile was last updated.';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_seekers_updated_at BEFORE UPDATE ON public.seekers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.seekers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow users to view own seeker profile" 
ON public.seekers FOR SELECT 
USING (user_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin');

CREATE POLICY "Allow users to manage own seeker profile" 
ON public.seekers FOR ALL 
USING (user_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin')
WITH CHECK (user_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin');

-- Indexes
CREATE INDEX IF NOT EXISTS seekers_user_id_idx ON public.seekers (user_id);

-- KavShare Supabase Migration: Procurements, Engagements & Reviews
-- Migration Date: 2026-05-28
-- Grouping: Procurement posts, business engagements, and company reviews.

-- 1. Procurement Posts Table
CREATE TABLE IF NOT EXISTS public.procurement_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seeker_id UUID REFERENCES public.seekers(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    budget NUMERIC(12, 2) CHECK (budget >= 0),
    urgency VARCHAR(50) DEFAULT 'medium'::character varying NOT NULL,
    required_tools VARCHAR(100)[] DEFAULT '{}'::VARCHAR(100)[] NOT NULL,
    status VARCHAR(50) DEFAULT 'active'::character varying NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_post_urgency CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT chk_post_status CHECK (status IN ('active', 'filled', 'expired', 'cancelled'))
);

-- Table & Column Comments
COMMENT ON TABLE public.procurement_posts IS 'Table storing service requests published by client seekers.';
COMMENT ON COLUMN public.procurement_posts.id IS 'Primary key UUID of the procurement post.';
COMMENT ON COLUMN public.procurement_posts.seeker_id IS 'Foreign key referencing the seeker who published this post.';
COMMENT ON COLUMN public.procurement_posts.title IS 'Summary title of the procurement request.';
COMMENT ON COLUMN public.procurement_posts.description IS 'Detailed scope of work, expectations, and requirements.';
COMMENT ON COLUMN public.procurement_posts.budget IS 'The allocated budget for this procurement request.';
COMMENT ON COLUMN public.procurement_posts.urgency IS 'Level of urgency for fulfillment (low, medium, high, critical).';
COMMENT ON COLUMN public.procurement_posts.required_tools IS 'Array of software tools or skills requested by the seeker.';
COMMENT ON COLUMN public.procurement_posts.status IS 'Lifecycle state of the post (active, filled, expired, cancelled).';
COMMENT ON COLUMN public.procurement_posts.expires_at IS 'Optional cutoff time when the post stops accepting matches.';
COMMENT ON COLUMN public.procurement_posts.created_at IS 'Timestamp when the post was published.';
COMMENT ON COLUMN public.procurement_posts.updated_at IS 'Timestamp when the post was last modified.';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_procurement_posts_updated_at BEFORE UPDATE ON public.procurement_posts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.procurement_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public select on active procurement posts" 
ON public.procurement_posts FOR SELECT 
USING (status = 'active' OR seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id()) OR public.get_auth_user_role() = 'admin');

CREATE POLICY "Allow seekers to manage own procurement posts" 
ON public.procurement_posts FOR ALL 
USING (seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id()) OR public.get_auth_user_role() = 'admin')
WITH CHECK (seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id()) OR public.get_auth_user_role() = 'admin');

-- Indexes
CREATE INDEX IF NOT EXISTS procurement_posts_seeker_id_idx ON public.procurement_posts (seeker_id);
CREATE INDEX IF NOT EXISTS procurement_posts_status_idx ON public.procurement_posts (status);


-- 2. Engagements Table
CREATE TABLE IF NOT EXISTS public.engagements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seeker_id UUID REFERENCES public.seekers(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    procurement_post_id UUID REFERENCES public.procurement_posts(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending'::character varying NOT NULL,
    engagement_type VARCHAR(50) CHECK (engagement_type IN ('fixed-price', 'hourly', 'subscription', 'retained')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_engagement_status CHECK (status IN ('pending', 'active', 'completed', 'cancelled'))
);

-- Table & Column Comments
COMMENT ON TABLE public.engagements IS 'Table tracking business contracts and active work relationships between seekers and companies.';
COMMENT ON COLUMN public.engagements.id IS 'Primary key UUID of the engagement.';
COMMENT ON COLUMN public.engagements.seeker_id IS 'Foreign key referencing the client seeker.';
COMMENT ON COLUMN public.engagements.company_id IS 'Foreign key referencing the provider company.';
COMMENT ON COLUMN public.engagements.procurement_post_id IS 'Foreign key referencing the originating procurement post if any.';
COMMENT ON COLUMN public.engagements.status IS 'Operational status of the engagement (pending, active, completed, cancelled).';
COMMENT ON COLUMN public.engagements.engagement_type IS 'Contracting model type (fixed-price, hourly, subscription, retained).';
COMMENT ON COLUMN public.engagements.created_at IS 'Timestamp when the engagement record was created.';
COMMENT ON COLUMN public.engagements.updated_at IS 'Timestamp when the engagement record was last modified.';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_engagements_updated_at BEFORE UPDATE ON public.engagements
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow participants to select engagements"
ON public.engagements FOR SELECT
USING (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Allow participants to insert engagements"
ON public.engagements FOR INSERT
WITH CHECK (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Allow participants to update engagements"
ON public.engagements FOR UPDATE
USING (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
)
WITH CHECK (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Allow admins to delete engagements"
ON public.engagements FOR DELETE
USING (public.get_auth_user_role() = 'admin');

-- Indexes
CREATE INDEX IF NOT EXISTS engagements_seeker_id_idx ON public.engagements (seeker_id);
CREATE INDEX IF NOT EXISTS engagements_company_id_idx ON public.engagements (company_id);
CREATE INDEX IF NOT EXISTS engagements_status_idx ON public.engagements (status);


-- 3. Reviews Table
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    engagement_id UUID REFERENCES public.engagements(id) ON DELETE CASCADE UNIQUE NOT NULL,
    reviewer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table & Column Comments
COMMENT ON TABLE public.reviews IS 'Table holding ratings and testimonials submitted upon engagement completion.';
COMMENT ON COLUMN public.reviews.id IS 'Primary key UUID of the review.';
COMMENT ON COLUMN public.reviews.engagement_id IS 'Foreign key referencing the associated engagement (one review per engagement).';
COMMENT ON COLUMN public.reviews.reviewer_id IS 'Foreign key referencing the user leaving the review.';
COMMENT ON COLUMN public.reviews.rating IS 'Numeric rating between 1 and 5 stars.';
COMMENT ON COLUMN public.reviews.comment IS 'Text explanation of rating and testimonial.';
COMMENT ON COLUMN public.reviews.created_at IS 'Timestamp when the review was submitted.';
COMMENT ON COLUMN public.reviews.updated_at IS 'Timestamp when the review was last updated.';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public select on reviews" 
ON public.reviews FOR SELECT 
USING (true);

CREATE POLICY "Allow participants to insert review" 
ON public.reviews FOR INSERT 
WITH CHECK (
  reviewer_id = public.get_auth_user_id() 
  AND EXISTS (
    SELECT 1 FROM public.engagements 
    WHERE public.engagements.id = engagement_id 
    AND public.engagements.status = 'completed'
    AND (
      public.engagements.seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
      OR public.engagements.company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
    )
  )
);

CREATE POLICY "Allow author to manage review" 
ON public.reviews FOR ALL 
USING (reviewer_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin')
WITH CHECK (reviewer_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin');

-- Indexes
CREATE INDEX IF NOT EXISTS reviews_engagement_id_idx ON public.reviews (engagement_id);
CREATE INDEX IF NOT EXISTS reviews_rating_idx ON public.reviews (rating);

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

-- KavShare Supabase Migration: Chat System
-- Migration Date: 2026-05-28
-- Grouping: Direct messaging, conversations, and chat message history.

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seeker_id UUID REFERENCES public.seekers(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (seeker_id, company_id)
);

-- Table & Column Comments
COMMENT ON TABLE public.conversations IS 'Table tracking unique direct chat channels between clients/seekers and provider companies.';
COMMENT ON COLUMN public.conversations.id IS 'Primary key UUID of the conversation.';
COMMENT ON COLUMN public.conversations.seeker_id IS 'Foreign key referencing the seeker participant.';
COMMENT ON COLUMN public.conversations.company_id IS 'Foreign key referencing the company participant.';
COMMENT ON COLUMN public.conversations.created_at IS 'Timestamp when the conversation thread was initialized.';
COMMENT ON COLUMN public.conversations.updated_at IS 'Timestamp when the last message was sent in this conversation.';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow participants to view conversations"
ON public.conversations FOR SELECT
USING (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Allow participants to insert conversations"
ON public.conversations FOR INSERT
WITH CHECK (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Allow participants/admins to update conversations"
ON public.conversations FOR UPDATE
USING (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
)
WITH CHECK (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Allow admins to delete conversations"
ON public.conversations FOR DELETE
USING (public.get_auth_user_role() = 'admin');

-- Indexes
CREATE INDEX IF NOT EXISTS conversations_seeker_id_idx ON public.conversations (seeker_id);
CREATE INDEX IF NOT EXISTS conversations_company_id_idx ON public.conversations (company_id);
CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON public.conversations (updated_at);


-- 2. Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table & Column Comments
COMMENT ON TABLE public.chat_messages IS 'Table containing chronological messages sent inside direct conversations.';
COMMENT ON COLUMN public.chat_messages.id IS 'Primary key UUID of the message.';
COMMENT ON COLUMN public.chat_messages.conversation_id IS 'Foreign key referencing the conversation thread.';
COMMENT ON COLUMN public.chat_messages.sender_id IS 'Foreign key referencing the user sending the message.';
COMMENT ON COLUMN public.chat_messages.content IS 'Text content of the message.';
COMMENT ON COLUMN public.chat_messages.created_at IS 'Timestamp when the message was sent.';
COMMENT ON COLUMN public.chat_messages.updated_at IS 'Timestamp when the message was last updated (e.g. edited).';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow conversation participants to select messages"
ON public.chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE public.conversations.id = public.chat_messages.conversation_id
    AND (
      public.conversations.seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
      OR public.conversations.company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
    )
  ) OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Allow conversation participants to insert messages"
ON public.chat_messages FOR INSERT
WITH CHECK (
  sender_id = public.get_auth_user_id()
  AND EXISTS (
    SELECT 1 FROM public.conversations
    WHERE public.conversations.id = conversation_id
    AND (
      public.conversations.seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
      OR public.conversations.company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
    )
  ) OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Allow sender to update own message"
ON public.chat_messages FOR UPDATE
USING (sender_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin')
WITH CHECK (sender_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin');

CREATE POLICY "Allow sender/admin to delete own message"
ON public.chat_messages FOR DELETE
USING (sender_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin');

-- Indexes
CREATE INDEX IF NOT EXISTS chat_messages_conversation_id_idx ON public.chat_messages (conversation_id);
CREATE INDEX IF NOT EXISTS chat_messages_sender_id_idx ON public.chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON public.chat_messages (created_at);

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

-- KavShare Supabase Migration: Optimized Performance Indexes
-- Migration Date: 2026-05-28
-- Grouping: Advanced GIN arrays, composite search indexes, and matchmaking telemetry optimization.

-- 1. GIN Indexes for Array Searching (Matchmaking Telemetry)
-- GIN (Generalized Inverted Index) indexes are required to index array items individually,
-- allowing extremely fast execution of containment (@>) and overlap (&&) operators during matching.

CREATE INDEX IF NOT EXISTS services_tech_stack_gin_idx 
ON public.services USING GIN (tech_stack);

COMMENT ON INDEX public.services_tech_stack_gin_idx IS 'GIN index to accelerate array containment queries evaluating provider tech stacks against post requirements.';

CREATE INDEX IF NOT EXISTS procurement_posts_required_tools_gin_idx 
ON public.procurement_posts USING GIN (required_tools);

COMMENT ON INDEX public.procurement_posts_required_tools_gin_idx IS 'GIN index to accelerate queries looking up client postings by requested software tools.';


-- 2. Composite Indexes for Search & Filter Operations
-- Composite indexes cover queries that apply filter conditions on multiple columns simultaneously,
-- avoiding separate index scans and bitmaps.

CREATE INDEX IF NOT EXISTS services_category_price_idx 
ON public.services (category, starting_price);

COMMENT ON INDEX public.services_category_price_idx IS 'Composite index to speed up directory catalog searches filtering by category and sorting by starting price.';

CREATE INDEX IF NOT EXISTS companies_status_rating_idx 
ON public.companies (status, rating DESC);

COMMENT ON INDEX public.companies_status_rating_idx IS 'Composite index to optimize queries loading top-rated active providers on the directory page.';

CREATE INDEX IF NOT EXISTS procurement_posts_status_urgency_idx 
ON public.procurement_posts (status, urgency);

COMMENT ON INDEX public.procurement_posts_status_urgency_idx IS 'Composite index to optimize the public procurement directory filtering by active status and urgency tier.';


-- 3. Composite Indexes for Messaging & Notifications
-- Accelerates retrieving recent chat messages and reading unread notification stacks.

CREATE INDEX IF NOT EXISTS chat_messages_conversation_time_idx 
ON public.chat_messages (conversation_id, created_at DESC);

COMMENT ON INDEX public.chat_messages_conversation_time_idx IS 'Composite index to optimize loading chat message history chronologically inside active message rooms.';

CREATE INDEX IF NOT EXISTS notifications_user_read_idx 
ON public.notifications (user_id, is_read);

COMMENT ON INDEX public.notifications_user_read_idx IS 'Composite index to accelerate loading unread notification counts for authenticated users.';


-- 4. Composite Indexes for Financial Ledgers & Attribution
-- Accelerates contract reports, payouts schedules, and referral telemetry.

CREATE INDEX IF NOT EXISTS commission_schedules_contract_status_month_idx 
ON public.commission_schedules (contract_id, status, month);

COMMENT ON INDEX public.commission_schedules_contract_status_month_idx IS 'Composite index to speed up contract ledger evaluations checking monthly payments status.';

CREATE INDEX IF NOT EXISTS click_events_session_timestamp_idx 
ON public.click_events (session_id, timestamp DESC);

COMMENT ON INDEX public.click_events_session_timestamp_idx IS 'Composite index to speed up loading and tracking session click events chronologically.';

-- KavShare Supabase Migration: Comprehensive RLS Policies
-- Migration Date: 2026-05-28
-- Grouping: Multi-role security validation, soft delete protection, and chat authorization RLS constraints.

-- 1. Users Table RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to users" ON public.users;
DROP POLICY IF EXISTS "Allow users self-access by clerk_id" ON public.users;
DROP POLICY IF EXISTS "Allow users to read own record or admins read all" ON public.users;
DROP POLICY IF EXISTS "Allow users to update own record or admins update all" ON public.users;
DROP POLICY IF EXISTS "Allow users or webhooks to insert user records" ON public.users;
DROP POLICY IF EXISTS "Allow users/admins to delete own record" ON public.users;

CREATE POLICY "Users can read own record, admins read all"
ON public.users FOR SELECT
USING (
  clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Users can update own record, admins update all"
ON public.users FOR UPDATE
USING (
  clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
  OR public.get_auth_user_role() = 'admin'
)
WITH CHECK (
  clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Webhook sync insertion access"
ON public.users FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete own record, admins delete all"
ON public.users FOR DELETE
USING (
  clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
  OR public.get_auth_user_role() = 'admin'
);


-- 2. Companies Table RLS Policies (With Soft Delete Protection)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select on active companies" ON public.companies;
DROP POLICY IF EXISTS "Allow owners to insert companies" ON public.companies;
DROP POLICY IF EXISTS "Allow owners to update their own companies" ON public.companies;
DROP POLICY IF EXISTS "Allow owners to delete their own companies" ON public.companies;
DROP POLICY IF EXISTS "Select companies policy" ON public.companies;
DROP POLICY IF EXISTS "Insert companies policy" ON public.companies;
DROP POLICY IF EXISTS "Update companies policy" ON public.companies;
DROP POLICY IF EXISTS "Delete companies policy" ON public.companies;

CREATE POLICY "Select companies policy"
ON public.companies FOR SELECT
USING (
  (status = 'active' AND status != 'archived')
  OR (owner_id = public.get_auth_user_id() AND status != 'archived')
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Insert companies policy"
ON public.companies FOR INSERT
WITH CHECK (
  owner_id = public.get_auth_user_id()
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Update companies policy"
ON public.companies FOR UPDATE
USING (
  (owner_id = public.get_auth_user_id() AND status != 'archived')
  OR public.get_auth_user_role() = 'admin'
)
WITH CHECK (
  (owner_id = public.get_auth_user_id() AND status != 'archived')
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Delete companies policy"
ON public.companies FOR DELETE
USING (
  public.get_auth_user_role() = 'admin'
);


-- 3. Procurement Posts Table RLS Policies
ALTER TABLE public.procurement_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select on active procurement posts" ON public.procurement_posts;
DROP POLICY IF EXISTS "Allow seekers to manage own procurement posts" ON public.procurement_posts;
DROP POLICY IF EXISTS "Select procurement posts policy" ON public.procurement_posts;
DROP POLICY IF EXISTS "Insert procurement posts policy" ON public.procurement_posts;
DROP POLICY IF EXISTS "Update procurement posts policy" ON public.procurement_posts;
DROP POLICY IF EXISTS "Delete procurement posts policy" ON public.procurement_posts;

CREATE POLICY "Select procurement posts policy"
ON public.procurement_posts FOR SELECT
USING (
  status = 'active'
  OR seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Insert procurement posts policy"
ON public.procurement_posts FOR INSERT
WITH CHECK (
  (seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id()) 
   AND public.get_auth_user_role() = 'seeker'::public.user_role_type)
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Update procurement posts policy"
ON public.procurement_posts FOR UPDATE
USING (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
)
WITH CHECK (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Delete procurement posts policy"
ON public.procurement_posts FOR DELETE
USING (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
);


-- 4. Engagements Table RLS Policies
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow participants to select engagements" ON public.engagements;
DROP POLICY IF EXISTS "Allow participants to insert engagements" ON public.engagements;
DROP POLICY IF EXISTS "Allow participants to update engagements" ON public.engagements;
DROP POLICY IF EXISTS "Allow admins to delete engagements" ON public.engagements;
DROP POLICY IF EXISTS "Select engagements policy" ON public.engagements;
DROP POLICY IF EXISTS "Insert engagements policy" ON public.engagements;
DROP POLICY IF EXISTS "Update engagements policy" ON public.engagements;
DROP POLICY IF EXISTS "Delete engagements policy" ON public.engagements;

CREATE POLICY "Select engagements policy"
ON public.engagements FOR SELECT
USING (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Insert engagements policy"
ON public.engagements FOR INSERT
WITH CHECK (
  (seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id()) 
   AND public.get_auth_user_role() = 'seeker'::public.user_role_type)
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Update engagements policy"
ON public.engagements FOR UPDATE
USING (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
)
WITH CHECK (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Delete engagements policy"
ON public.engagements FOR DELETE
USING (
  public.get_auth_user_role() = 'admin'
);


-- 5. Conversations & Messages RLS Policies
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow participants to view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow participants to insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow participants/admins to update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow admins to delete conversations" ON public.conversations;
DROP POLICY IF EXISTS "Select conversations policy" ON public.conversations;
DROP POLICY IF EXISTS "Insert conversations policy" ON public.conversations;
DROP POLICY IF EXISTS "Update conversations policy" ON public.conversations;
DROP POLICY IF EXISTS "Delete conversations policy" ON public.conversations;

CREATE POLICY "Select conversations policy"
ON public.conversations FOR SELECT
USING (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Insert conversations policy"
ON public.conversations FOR INSERT
WITH CHECK (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Update conversations policy"
ON public.conversations FOR UPDATE
USING (
  seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
  OR company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
  OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Delete conversations policy"
ON public.conversations FOR DELETE
USING (
  public.get_auth_user_role() = 'admin'
);


ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow conversation participants to select messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow conversation participants to insert messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow sender to update own message" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow sender/admin to delete own message" ON public.chat_messages;
DROP POLICY IF EXISTS "Select chat messages policy" ON public.chat_messages;
DROP POLICY IF EXISTS "Insert chat messages policy" ON public.chat_messages;
DROP POLICY IF EXISTS "Update chat messages policy" ON public.chat_messages;
DROP POLICY IF EXISTS "Delete chat messages policy" ON public.chat_messages;

CREATE POLICY "Select chat messages policy"
ON public.chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND (
      c.seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
      OR c.company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
    )
  ) OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Insert chat messages policy"
ON public.chat_messages FOR INSERT
WITH CHECK (
  sender_id = public.get_auth_user_id()
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND (
      c.seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
      OR c.company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
    )
  ) OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Update chat messages policy"
ON public.chat_messages FOR UPDATE
USING (
  sender_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin'
)
WITH CHECK (
  sender_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Delete chat messages policy"
ON public.chat_messages FOR DELETE
USING (
  sender_id = public.get_auth_user_id() OR public.get_auth_user_role() = 'admin'
);


-- 6. Contracts & Schedules RLS Policies
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow participants to select contracts" ON public.contracts;
DROP POLICY IF EXISTS "Allow participants to manage contracts" ON public.contracts;

CREATE POLICY "Select contracts policy"
ON public.contracts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.engagements e
    WHERE e.id = engagement_id
    AND (
      e.seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
      OR e.company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
    )
  ) OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "Admin full manage access on contracts"
ON public.contracts FOR ALL
USING (public.get_auth_user_role() = 'admin')
WITH CHECK (public.get_auth_user_role() = 'admin');


ALTER TABLE public.commission_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow providers to select own schedules" ON public.commission_schedules;
DROP POLICY IF EXISTS "Allow admins to manage schedules" ON public.commission_schedules;

CREATE POLICY "Select commission schedules policy"
ON public.commission_schedules FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts co
    JOIN public.engagements e ON e.id = co.engagement_id
    WHERE co.id = contract_id
    AND (
      e.seeker_id IN (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id())
      OR e.company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
    )
  ) OR public.get_auth_user_role() = 'admin'
);

CREATE POLICY "System schedules management access for admin only"
ON public.commission_schedules FOR ALL
USING (public.get_auth_user_role() = 'admin')
WITH CHECK (public.get_auth_user_role() = 'admin');

-- KavShare Supabase Migration: Core Database Functions
-- Migration Date: 2026-05-28
-- Grouping: Advanced matching algorithms, scheduler engines, rating calculations, and cleanup tasks.

-- 1. match_providers_for_request(p_request_id UUID, p_limit INTEGER)
-- Implements a weighted scoring matchmaking algorithm evaluating:
-- - Tech stack overlap (50% weight)
-- - Starting price budget suitability (30% weight)
-- - Provider satisfaction rating (20% weight)

CREATE OR REPLACE FUNCTION public.match_providers_for_request(
    p_request_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    company_id UUID,
    company_name VARCHAR(255),
    score NUMERIC(5, 2),
    explanations TEXT[]
) AS $$
DECLARE
    v_required_tools VARCHAR(100)[];
    v_budget NUMERIC(12, 2);
BEGIN
    -- 1. Fetch details of the procurement post
    SELECT required_tools, budget INTO v_required_tools, v_budget
    FROM public.procurement_posts
    WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Procurement post % not found.', p_request_id;
    END IF;

    -- 2. Return matching company table
    RETURN QUERY
    WITH company_stats AS (
        SELECT 
            c.id AS c_id,
            c.name AS c_name,
            c.rating AS c_rating,
            -- Calculate tools match
            COALESCE(
              (
                SELECT COUNT(DISTINCT matching_tool)
                FROM unnest(v_required_tools) AS matching_tool
                JOIN (
                  SELECT DISTINCT unnest(s.tech_stack) AS provider_tool
                  FROM public.services s
                  WHERE s.company_id = c.id
                ) pt ON pt.provider_tool ILIKE matching_tool
              ), 0
            ) AS matched_tools_count,
            -- Calculate starting price
            COALESCE(
              (
                SELECT MIN(s.starting_price)
                FROM public.services s
                WHERE s.company_id = c.id
              ), 0.00
            ) AS min_starting_price
        FROM public.companies c
        WHERE c.status = 'active'
    ),
    company_scores AS (
        SELECT
            c_id,
            c_name,
            -- Tech Stack Score (0 to 50 points)
            CASE 
                WHEN array_length(v_required_tools, 1) IS NULL OR array_length(v_required_tools, 1) = 0 THEN 50.00
                ELSE ((matched_tools_count::NUMERIC / array_length(v_required_tools, 1)::NUMERIC) * 50.00)::NUMERIC(5, 2)
            END AS tech_score,
            -- Budget Score (0 to 30 points)
            CASE 
                WHEN min_starting_price = 0.00 THEN 15.00 -- Neutral
                WHEN min_starting_price <= v_budget THEN 30.00 -- Full budget match
                WHEN min_starting_price > v_budget * 2 THEN 0.00 -- Too expensive
                ELSE (30.00 - (((min_starting_price - v_budget) / v_budget) * 30.00))::NUMERIC(5, 2)
            END AS budget_score,
            -- Satisfaction Rating Score (0 to 20 points)
            (c_rating * 4.00)::NUMERIC(5, 2) AS rating_score,
            -- Array of text explanations
            ARRAY[
                'Tech Stack Match: ' || matched_tools_count || ' of ' || COALESCE(array_length(v_required_tools, 1), 0) || ' tools matched.',
                'Budget Fit: starting price is $' || min_starting_price || ' vs. post budget of $' || v_budget || '.',
                'Provider Rating: ' || c_rating || ' stars.'
            ] AS item_explanations
        FROM company_stats
    )
    SELECT
        c_id,
        c_name,
        (tech_score + budget_score + rating_score)::NUMERIC(5, 2) AS final_score,
        item_explanations
    FROM company_scores
    ORDER BY final_score DESC, c_rating DESC
    LIMIT p_limit;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error executing match_providers_for_request: %', SQLERRM;
        RETURN;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.match_providers_for_request(UUID, INTEGER) IS 'Weighted scoring matchmaking engine returning ranked provider listings and evaluation metadata.';


-- 2. generate_commission_schedules(p_contract_id UUID)
-- Generates expected monthly schedules over a contract duration terms.
CREATE OR REPLACE FUNCTION public.generate_commission_schedules(p_contract_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_monthly_value NUMERIC(12, 2);
    v_rate NUMERIC(5, 2);
    v_curr DATE;
    v_limit DATE;
    v_inserted INTEGER := 0;
    v_comm NUMERIC(12, 2);
BEGIN
    -- Load contract configuration
    SELECT start_date, end_date, monthly_value, commission_rate
    INTO v_start_date, v_end_date, v_monthly_value, v_rate
    FROM public.contracts
    WHERE id = p_contract_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contract % not found.', p_contract_id;
    END IF;
    
    v_curr := date_trunc('month', v_start_date)::DATE;
    
    IF v_end_date IS NOT NULL THEN
        v_limit := date_trunc('month', v_end_date)::DATE;
    ELSE
        v_limit := (v_curr + INTERVAL '12 months')::DATE;
    END IF;
    
    v_comm := v_monthly_value * (v_rate / 100.00);
    
    WHILE v_curr <= v_limit AND v_inserted < 24 LOOP
        INSERT INTO public.commission_schedules (
            contract_id,
            month,
            expected_amount,
            paid_amount,
            status
        ) VALUES (
            p_contract_id,
            v_curr,
            v_comm,
            0.00,
            'pending'
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


-- 3. enforce_cancellation_minimums(p_contract_id UUID)
-- Evaluates contract cancellations, flags penalties, and reports final dues.
CREATE OR REPLACE FUNCTION public.enforce_cancellation_minimums(p_contract_id UUID)
RETURNS NUMERIC(12, 2) AS $$
DECLARE
    v_penalty_total NUMERIC(12, 2) := 0.00;
BEGIN
    -- Update future pending schedules to penalty status and apply a 50% cancellation fee
    UPDATE public.commission_schedules
    SET status = 'penalty',
        expected_amount = expected_amount * 0.50,
        updated_at = now()
    WHERE contract_id = p_contract_id 
      AND status = 'pending' 
      AND month > now()::DATE;
      
    -- Sum up current active penalty dues
    SELECT COALESCE(SUM(expected_amount), 0.00) INTO v_penalty_total
    FROM public.commission_schedules
    WHERE contract_id = p_contract_id AND status = 'penalty';
    
    -- Mark current/past pending schedules as cancelled
    UPDATE public.commission_schedules
    SET status = 'cancelled',
        updated_at = now()
    WHERE contract_id = p_contract_id AND status = 'pending';
    
    -- Update contract status
    UPDATE public.contracts
    SET status = 'cancelled',
        updated_at = now()
    WHERE id = p_contract_id;
    
    RETURN v_penalty_total;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error executing enforce_cancellation_minimums: %', SQLERRM;
        RETURN 0.00;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION public.enforce_cancellation_minimums(UUID) IS 'Applies contract termination penalties and returns total penalty dues.';


-- 4. calculate_provider_satisfaction(p_company_id UUID)
-- Calculates the verified average rating of reviews.
CREATE OR REPLACE FUNCTION public.calculate_provider_satisfaction(p_company_id UUID)
RETURNS NUMERIC(5, 2) AS $$
DECLARE
    v_avg NUMERIC(5, 2) := 0.00;
    v_percentage NUMERIC(5, 2) := 0.00;
BEGIN
    SELECT COALESCE(AVG(r.rating), 0.00)::NUMERIC(5, 2) INTO v_avg
    FROM public.reviews r
    JOIN public.engagements e ON e.id = r.engagement_id
    WHERE e.company_id = p_company_id;
    
    -- Convert 5-star rating scale to percentage (e.g. 4.5 stars = 90.00%)
    v_percentage := (v_avg / 5.00) * 100.00;
    
    RETURN v_percentage;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error executing calculate_provider_satisfaction: %', SQLERRM;
        RETURN 0.00;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_provider_satisfaction(UUID) IS 'Averages verified reviews for a company and translates the result into satisfaction percentages.';


-- 5. auto_archive_expired_posts()
-- Archives expired active posts (intended for daily cron jobs).
CREATE OR REPLACE FUNCTION public.auto_archive_expired_posts()
RETURNS INTEGER AS $$
DECLARE
    v_rows INTEGER := 0;
BEGIN
    UPDATE public.procurement_posts
    SET status = 'expired',
        updated_at = now()
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now();
      
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error executing auto_archive_expired_posts: %', SQLERRM;
        RETURN 0;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION public.auto_archive_expired_posts() IS 'Automatically scans for and expires active posts that have passed their expiration timestamps.';

-- KavShare Supabase Migration: Advanced Matchmaking Engine
-- Migration Date: 2026-05-28
-- Grouping: SQL scoring functions, triggers, and compatibility profile schemas.

-- 1. Schema Extensions for Companies & Procurement Posts
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS target_industries VARCHAR(100)[] DEFAULT '{}'::VARCHAR(100)[] NOT NULL,
ADD COLUMN IF NOT EXISTS target_sizes VARCHAR(50)[] DEFAULT '{}'::VARCHAR(50)[] NOT NULL,
ADD COLUMN IF NOT EXISTS target_budget NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
ADD COLUMN IF NOT EXISTS preferred_frameworks VARCHAR(100)[] DEFAULT '{}'::VARCHAR(100)[] NOT NULL;

ALTER TABLE public.procurement_posts
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
ADD COLUMN IF NOT EXISTS company_size VARCHAR(50),
ADD COLUMN IF NOT EXISTS compliance VARCHAR(100)[] DEFAULT '{}'::VARCHAR(100)[] NOT NULL,
ADD COLUMN IF NOT EXISTS pm_style VARCHAR(100),
ADD COLUMN IF NOT EXISTS budget_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS require_nda BOOLEAN DEFAULT false NOT NULL;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS companies_matching_idx ON public.companies USING gin (target_industries, target_sizes);
CREATE INDEX IF NOT EXISTS procurement_posts_matching_idx ON public.procurement_posts (category, industry, status);

-- 2. Matchmaking Algorithm scoring engine function
CREATE OR REPLACE FUNCTION public.match_providers_for_request(
    p_request_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    company_id UUID,
    company_name VARCHAR(255),
    total_score NUMERIC(5, 2),
    category_fit_score NUMERIC(5, 2),
    industry_relevance_score NUMERIC(5, 2),
    client_size_fit_score NUMERIC(5, 2),
    price_fit_score NUMERIC(5, 2),
    performance_score NUMERIC(5, 2),
    reliability_workflow_score NUMERIC(5, 2),
    match_explanations TEXT[]
) AS $$
DECLARE
    v_category VARCHAR(100);
    v_industry VARCHAR(100);
    v_company_size VARCHAR(50);
    v_budget NUMERIC(12, 2);
    v_required_tools VARCHAR(100)[];
    v_pm_style VARCHAR(100);
BEGIN
    -- 1. Fetch procurement request parameters
    SELECT category, industry, company_size, budget, required_tools, pm_style
    INTO v_category, v_industry, v_company_size, v_budget, v_required_tools, v_pm_style
    FROM public.procurement_posts
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Procurement request % not found', p_request_id;
    END IF;

    -- 2. Evaluate and score active providers
    RETURN QUERY
    WITH provider_eval AS (
        SELECT 
            c.id AS p_id,
            c.name AS p_name,
            c.rating AS p_rating,
            c.target_industries AS p_target_industries,
            c.target_sizes AS p_target_sizes,
            c.preferred_frameworks AS p_preferred_frameworks,
            
            -- Evaluate service category fit (max 20 points for direct category match)
            COALESCE(
                CASE WHEN EXISTS (
                    SELECT 1 FROM public.services s
                    WHERE s.company_id = c.id AND s.category ILIKE v_category
                ) THEN 20.00 ELSE 0.00 END, 0.00
            ) AS cat_match_points,

            -- Evaluate tool/tech overlap (2 points per tool, max 10 points)
            COALESCE(
                (
                    SELECT LEAST(COUNT(DISTINCT req_tool) * 2.00, 10.00)
                    FROM unnest(v_required_tools) AS req_tool
                    JOIN (
                        SELECT DISTINCT unnest(s.tech_stack) AS prov_tool
                        FROM public.services s
                        WHERE s.company_id = c.id
                    ) pt ON pt.prov_tool ILIKE req_tool
                ), 0.00
            ) AS tool_match_points,

            -- Calculate average provider service price
            COALESCE(
                (
                    SELECT AVG(s.starting_price)
                    FROM public.services s
                    WHERE s.company_id = c.id
                ), 0.00
            ) AS avg_service_price,

            -- Platform completion rate metrics (reliability)
            COALESCE(
                (
                    SELECT (COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 10.00
                    FROM public.engagements
                    WHERE company_id = c.id AND status IN ('completed', 'cancelled')
                ), 10.00
            ) AS completion_rate_points
        FROM public.companies c
        WHERE c.status = 'active'
    ),
    scored_providers AS (
        SELECT
            pe.p_id,
            pe.p_name,
            
            -- Service Category Fit total (max 30)
            (pe.cat_match_points + pe.tool_match_points)::NUMERIC(5, 2) AS cat_fit,

            -- Industry Relevance (max 15)
            CASE 
                WHEN pe.p_target_industries @> ARRAY[v_industry] THEN 15.00
                WHEN EXISTS (
                    SELECT 1 FROM unnest(pe.p_target_industries) ind
                    WHERE ind ILIKE '%' || v_industry || '%' OR v_industry ILIKE '%' || ind || '%'
                ) THEN 5.00
                ELSE 0.00
            END::NUMERIC(5, 2) AS ind_relevance,

            -- Client Size Fit (max 10)
            -- Brackets ordered: 1: '1-10', 2: '11-50', 3: '51-200', 4: '200+'
            CASE 
                WHEN pe.p_target_sizes @> ARRAY[v_company_size] THEN 10.00
                WHEN EXISTS (
                    SELECT 1 FROM unnest(pe.p_target_sizes) sz
                    WHERE 
                        (v_company_size = '1-10' AND sz = '11-50') OR
                        (v_company_size = '11-50' AND sz IN ('1-10', '51-200')) OR
                        (v_company_size = '51-200' AND sz IN ('11-50', '200+')) OR
                        (v_company_size = '200+' AND sz = '51-200')
                ) THEN 5.00
                ELSE 0.00
            END::NUMERIC(5, 2) AS client_size_fit,

            -- Price Fit (max 15)
            CASE 
                WHEN pe.avg_service_price <= v_budget THEN 15.00
                WHEN pe.avg_service_price <= v_budget * 1.20 THEN 7.00
                ELSE 0.00
            END::NUMERIC(5, 2) AS price_fit,

            -- Performance score (max 15)
            CASE 
                WHEN pe.p_rating IS NULL OR pe.p_rating = 0.00 THEN 10.00
                ELSE (pe.p_rating * 3.00)::NUMERIC(5, 2)
            END::NUMERIC(5, 2) AS perf_score,

            -- Reliability & Workflow (max 15)
            -- 5 points for pm style match, 10 points for completion rate
            (
                CASE WHEN pe.p_preferred_frameworks @> ARRAY[v_pm_style] THEN 5.00 ELSE 0.00 END + pe.completion_rate_points
            )::NUMERIC(5, 2) AS rel_workflow
        FROM provider_eval pe
    )
    SELECT
        sp.p_id,
        sp.p_name,
        (sp.cat_fit + sp.ind_relevance + sp.client_size_fit + sp.price_fit + sp.perf_score + sp.rel_workflow)::NUMERIC(5, 2) AS tot_score,
        sp.cat_fit,
        sp.ind_relevance,
        sp.client_size_fit,
        sp.price_fit,
        sp.perf_score,
        sp.rel_workflow,
        -- Generate explanation array
        array_remove(
            ARRAY[
                CASE WHEN sp.cat_fit >= 20.00 THEN 'Strong match for your required service category' END,
                CASE WHEN sp.price_fit >= 15.00 THEN 'Fits perfectly within your stated budget' END,
                CASE WHEN sp.ind_relevance >= 15.00 THEN 'Proven experience in your industry' END,
                CASE WHEN sp.client_size_fit >= 10.00 THEN 'Specializes in companies of your size' END,
                CASE WHEN sp.perf_score >= 12.00 THEN 'Top-tier client satisfaction rating' END
            ],
            NULL
        ) AS explanations
    FROM scored_providers sp
    ORDER BY tot_score DESC
    LIMIT p_limit;

END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.match_providers_for_request(UUID, INTEGER) IS 'PostgreSQL advanced matchmaking engine returning provider matches and structured relevance evaluations.';

-- KavShare Supabase Migration: Contract Signature & Cancellation fields
-- Migration Date: 2026-05-28

ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS signed_by_seeker TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS signed_by_provider TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS commission_structure VARCHAR(50) DEFAULT 'percentage' NOT NULL,
ADD COLUMN IF NOT EXISTS minimum_term_months INTEGER DEFAULT 12 NOT NULL;

-- Column Comments
COMMENT ON COLUMN public.contracts.signed_by_seeker IS 'Timestamp when the seeker signed the contract agreement.';
COMMENT ON COLUMN public.contracts.signed_by_provider IS 'Timestamp when the provider signed the contract agreement.';
COMMENT ON COLUMN public.contracts.cancellation_reason IS 'Reason recorded when the contract status was set to cancelled.';
COMMENT ON COLUMN public.contracts.commission_structure IS 'Structure mode of platform commissions (percentage, flat, hybrid).';
COMMENT ON COLUMN public.contracts.minimum_term_months IS 'Minimum binding contract duration in months before cancellation penalty bails.';

ALTER TABLE public.commission_schedules 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb NOT NULL;

COMMENT ON COLUMN public.commission_schedules.metadata IS 'Audit log and renewal configuration metadata.';

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

-- KavShare Supabase Migration: Wise transfer tables
-- Migration Date: 2026-05-28

-- 1. Company bank accounts (Georgian IBAN store)
CREATE TABLE IF NOT EXISTS public.company_bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
    account_holder_name VARCHAR(200) NOT NULL,
    iban VARCHAR(34) NOT NULL,         -- normalised, no spaces, uppercase
    bank_name VARCHAR(100),
    currency VARCHAR(10) DEFAULT 'GEL' NOT NULL,
    country VARCHAR(2) DEFAULT 'GE' NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    wise_recipient_id BIGINT,          -- cached Wise account ID to avoid re-creation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.company_bank_accounts IS 'Georgian IBAN payout accounts linked to provider companies.';
COMMENT ON COLUMN public.company_bank_accounts.wise_recipient_id IS 'Cached Wise recipient account ID to avoid duplicate creation.';

CREATE TRIGGER update_company_bank_accounts_updated_at
    BEFORE UPDATE ON public.company_bank_accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.company_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers can manage their own bank accounts"
    ON public.company_bank_accounts FOR ALL
    USING (company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id()))
    WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id()));

CREATE POLICY "Admins can manage all bank accounts"
    ON public.company_bank_accounts FOR ALL
    USING (public.get_auth_user_role() = 'admin')
    WITH CHECK (public.get_auth_user_role() = 'admin');

CREATE INDEX IF NOT EXISTS company_bank_accounts_company_id_idx ON public.company_bank_accounts (company_id);


-- 2. Wise transfers ledger
CREATE TABLE IF NOT EXISTS public.wise_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID REFERENCES public.commission_schedules(id) ON DELETE SET NULL UNIQUE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    transfer_id BIGINT NOT NULL,         -- Wise numeric transfer ID
    quote_id VARCHAR(100),
    source_currency VARCHAR(10) NOT NULL,
    target_currency VARCHAR(10) NOT NULL,
    source_amount NUMERIC(12, 2) NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL,
    rate NUMERIC(12, 6),
    status VARCHAR(100) DEFAULT 'processing' NOT NULL,
    reference VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.wise_transfers IS 'Wise API transfer records for provider commission payouts.';
COMMENT ON COLUMN public.wise_transfers.transfer_id IS 'Numeric transfer ID returned by the Wise API.';
COMMENT ON COLUMN public.wise_transfers.status IS 'Latest Wise transfer status (outgoing_payment_sent, funds_refunded, etc).';

CREATE TRIGGER update_wise_transfers_updated_at
    BEFORE UPDATE ON public.wise_transfers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.wise_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers can view their own transfers"
    ON public.wise_transfers FOR SELECT
    USING (company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
           OR public.get_auth_user_role() = 'admin');

CREATE POLICY "Admins can manage all transfers"
    ON public.wise_transfers FOR ALL
    USING (public.get_auth_user_role() = 'admin')
    WITH CHECK (public.get_auth_user_role() = 'admin');

CREATE INDEX IF NOT EXISTS wise_transfers_schedule_id_idx ON public.wise_transfers (schedule_id);
CREATE INDEX IF NOT EXISTS wise_transfers_company_id_idx ON public.wise_transfers (company_id);
CREATE INDEX IF NOT EXISTS wise_transfers_transfer_id_idx ON public.wise_transfers (transfer_id);
