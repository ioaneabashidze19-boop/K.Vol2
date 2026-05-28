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
