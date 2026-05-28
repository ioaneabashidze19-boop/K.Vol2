-- KavShare Supabase Migration: Add anonymous indicator to reviews table
-- Migration Date: 2026-05-28

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS anonymous BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb NOT NULL;

COMMENT ON COLUMN public.reviews.anonymous IS 'Flag indicating whether this review should be displayed anonymously on public profiles.';
