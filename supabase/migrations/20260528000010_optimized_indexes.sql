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
