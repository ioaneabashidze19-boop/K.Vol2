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
