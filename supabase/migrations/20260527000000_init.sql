-- KavShare Supabase Initial Database Schema
-- Migration Date: 2026-05-27

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Allow public read access to profiles" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Allow users to update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. Files Table (Metadata of uploaded shares)
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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

CREATE POLICY "Allow authenticated users to upload and manage their files" 
ON public.files FOR ALL USING (auth.uid() = user_id);

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
        AND public.files.user_id = auth.uid()
    )
);
