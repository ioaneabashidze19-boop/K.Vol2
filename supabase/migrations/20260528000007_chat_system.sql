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
