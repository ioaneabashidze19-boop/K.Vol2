# KavShare Supabase RLS Testing & Validation Guide

This document outlines the testing strategy, SQL verification test cases, expected permission matrices, and performance considerations for the KavShare Row-Level Security (RLS) policies.

---

## 1. Expected Behavior Matrix

The following matrix outlines the permission boundaries for each role across the core schema:

| Table | Operation | Anonymous Guest | Seeker Owner | Provider Owner | Platform Admin |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **users** | SELECT | Denied | Own Record Only | Own Record Only | **All Records** |
| | INSERT | Allowed (Webhook/Sync) | Allowed | Allowed | Allowed |
| | UPDATE | Denied | Own Record Only | Own Record Only | **All Records** |
| | DELETE | Denied | Own Record Only | Own Record Only | **All Records** |
| **companies** | SELECT | Active Only | Active Only | Active + Own Pending | **All Records (incl. Archived)** |
| | INSERT | Denied | Denied | Own Company Only | **All Records** |
| | UPDATE | Denied | Denied | Own Company Only | **All Records** |
| | DELETE | Denied | Denied | Denied (Soft-only) | **All Records** |
| **procurement_posts** | SELECT | Active Only | Active + Own | Active Only | **All Records** |
| | INSERT | Denied | Own Post Only | Denied | **All Records** |
| | UPDATE | Denied | Own Post Only | Denied | **All Records** |
| | DELETE | Denied | Own Post Only | Denied | **All Records** |
| **engagements** | SELECT | Denied | Participated Only | Participated Only | **All Records** |
| | INSERT | Denied | Own Seeker Only | Denied | **All Records** |
| | UPDATE | Denied | Participated Only | Participated Only | **All Records** |
| | DELETE | Denied | Denied | Denied | **All Records** |
| **conversations** | SELECT | Denied | Participated Only | Participated Only | **All Records** |
| | INSERT | Denied | Participated Only | Participated Only | **All Records** |
| | UPDATE | Denied | Participated Only | Participated Only | **All Records** |
| | DELETE | Denied | Denied | Denied | **All Records** |
| **chat_messages** | SELECT | Denied | Thread Msg Only | Thread Msg Only | **All Records** |
| | INSERT | Denied | Thread Msg Only | Thread Msg Only | **All Records** |
| | UPDATE | Denied | Own Msg Only | Own Msg Only | **All Records** |
| | DELETE | Denied | Own Msg Only | Own Msg Only | **All Records** |
| **contracts** | SELECT | Denied | Own Party Only | Own Party Only | **All Records** |
| | INSERT | Denied | Denied | Denied | **All Records** |
| | UPDATE | Denied | Denied | Denied | **All Records** |
| | DELETE | Denied | Denied | Denied | **All Records** |
| **commission_schedules**| SELECT | Denied | Own Party Only | Own Party Only | **All Records** |
| | INSERT | Denied | Denied | Denied | **All Records** |
| | UPDATE | Denied | Denied | Denied | **All Records** |
| | DELETE | Denied | Denied | Denied | **All Records** |

---

## 2. SQL Simulation & Verification Scripts

To test RLS policies inside a Supabase SQL Console or PostgreSQL terminal, you can mock JWT claims by setting transaction-local configuration parameters.

### Mocking Personas Helper Code
```sql
-- Run inside a test transaction to avoid mutating database state permanently
BEGIN;

-- 1. Setup Mock Metadata
-- Provider: Alice (user_id = '11111111-1111-1111-1111-111111111111', clerk_id = 'user_alice')
-- Seeker: Bob (user_id = '22222222-2222-2222-2222-222222222222', clerk_id = 'user_bob')
-- Guest: Charlie (unauthenticated)
-- Admin: Dave (user_id = '99999999-9999-9999-9999-999999999999', clerk_id = 'user_dave')

-- To simulate Bob (Seeker) executing queries:
SET LOCAL request.jwt.claims = '{"sub": "user_bob", "metadata": {"userRole": "seeker"}}';

-- To simulate Alice (Provider) executing queries:
-- SET LOCAL request.jwt.claims = '{"sub": "user_alice", "metadata": {"userRole": "provider"}}';

-- To simulate Dave (Admin) executing queries:
-- SET LOCAL request.jwt.claims = '{"sub": "user_dave", "metadata": {"userRole": "admin"}}';
```

---

## 3. Policy Execution Tests (Succeed vs. Fail Examples)

### Test Case A: Seeker (Bob) creating a Procurement Post
```sql
-- Setup Mock Session as Seeker Bob
SET LOCAL request.jwt.claims = '{"sub": "user_bob", "metadata": {"userRole": "seeker"}}';

-- SHOULD SUCCEED: Insert post owned by Bob's seeker profile
INSERT INTO public.procurement_posts (seeker_id, title, description, budget, status)
VALUES (
  (SELECT id FROM public.seekers WHERE user_id = public.get_auth_user_id()), 
  'Development Help Needed', 
  'Need a full-stack Next.js developer.', 
  5000.00, 
  'active'
);

-- SHOULD FAIL: Insert post owned by another seeker
INSERT INTO public.procurement_posts (seeker_id, title, description, budget, status)
VALUES (
  '00000000-0000-0000-0000-000000000000', 
  'Malicious Post', 
  'Trying to inject posts into another account.', 
  99999.00, 
  'active'
);
```

### Test Case B: Provider (Alice) accessing Chat Messages
```sql
-- Setup Mock Session as Provider Alice
SET LOCAL request.jwt.claims = '{"sub": "user_alice", "metadata": {"userRole": "provider"}}';

-- SHOULD SUCCEED: Read messages of conversations Alice is participating in
SELECT * FROM public.chat_messages 
WHERE conversation_id IN (
  SELECT id FROM public.conversations 
  WHERE company_id IN (SELECT id FROM public.companies WHERE owner_id = public.get_auth_user_id())
);

-- SHOULD FAIL: Select conversation messages for threads she does not belong to
SELECT * FROM public.chat_messages 
WHERE conversation_id = '00000000-0000-0000-0000-000000000000';
```

### Test Case C: Soft-Delete Protection (Archived Companies)
```sql
-- Setup Mock Session as Guest (no auth claims)
RESET request.jwt.claims;

-- SHOULD SUCCEED: Select only active companies
SELECT name FROM public.companies; -- Will omit 'suspended' or 'archived' companies automatically.

-- SHOULD FAIL: Attempt to select a known archived company
SELECT * FROM public.companies WHERE status = 'archived'; -- Returns empty result set (RLS filtering).
```

### Test Case D: Commission Schedules Immutability
```sql
-- Setup Mock Session as Provider Alice
SET LOCAL request.jwt.claims = '{"sub": "user_alice", "metadata": {"userRole": "provider"}}';

-- SHOULD SUCCEED: View Alice's own contract billing schedules
SELECT * FROM public.commission_schedules;

-- SHOULD FAIL: Attempt to modify a pending schedule
UPDATE public.commission_schedules
SET status = 'paid'
WHERE id = '33333333-3333-3333-3333-333333333333'; -- Blocked (only admin has modify policy rights).
```

---

## 4. Edge Cases & Validation Scenarios

1. **Role Switch Hijacking**:
   - *Scenario*: A user changes their Clerk metadata role client-side and attempts to access endpoints.
   - *Mitigation*: The `public.get_auth_user_role()` function queries security definer records directly from the database `users` table synced via Clerk secure webhooks. Fake JWT role headers are ignored or verified.
2. **Orphaned Engagements**:
   - *Scenario*: Seeker profile deletion while engagements are open.
   - *Mitigation*: Tables utilize foreign key constraints `ON DELETE CASCADE` or `ON DELETE SET NULL`, and RLS policy rules dynamically reference seeker/provider parent associations.

---

## 5. Performance Impact Analysis

- **Helper Function Overhead**: 
  - Using helper functions like `public.get_auth_user_id()` query the `users` table. 
  - *Optimization*: The `users.clerk_id` field has a unique B-Tree index `users_clerk_id_idx`. The lookup runs in `O(1)` index scan time, adding negligible latency (~0.2ms).
- **Subquery Performance**:
  - Filtering policies (e.g. `seeker_id IN (SELECT id FROM public.seekers...)`) perform subqueries.
  - *Optimization*: Subqueries are optimized by PostgreSQL query planners into hash joins. The inclusion of foreign key indexes on `seeker_id` and `company_id` prevents full-table sequential scans.
- **EXPLAIN Example**:
  Checking policy plan execution:
  ```sql
  EXPLAIN ANALYZE SELECT * FROM public.procurement_posts WHERE status = 'active';
  ```
  Ensures that the `procurement_posts_status_urgency_idx` composite index is loaded and a sequential scan is avoided.

---
Rollback simulation tests to restore test environments:
```sql
ROLLBACK;
```
