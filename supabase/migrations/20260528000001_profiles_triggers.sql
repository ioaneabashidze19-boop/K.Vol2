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
