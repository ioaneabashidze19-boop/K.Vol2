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
