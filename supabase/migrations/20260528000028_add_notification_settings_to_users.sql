-- KavShare Supabase Migration: Add notification settings and read status columns
-- Migration Date: 2026-05-28

-- Add notification preference columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notification_frequency VARCHAR(50) DEFAULT 'instant' NOT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true NOT NULL;

-- Constraint check for notification frequencies
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_notification_frequency;
ALTER TABLE public.users ADD CONSTRAINT chk_notification_frequency CHECK (notification_frequency IN ('instant', 'hourly', 'daily', 'off'));

-- Add read indicators to chat_messages table
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Add notification tracking and spam throttle columns to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_email_notification_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.users.notification_frequency IS 'Email digest delivery frequency option: instant, hourly, daily, off.';
COMMENT ON COLUMN public.users.email_notifications_enabled IS 'Toggle indicating whether email notification triggers are activated.';
COMMENT ON COLUMN public.users.last_email_notification_at IS 'Timestamp tracking the last triggered email alert to throttle spamming.';
COMMENT ON COLUMN public.chat_messages.is_read IS 'Flag indicating if the message has been viewed by the recipient.';
COMMENT ON COLUMN public.chat_messages.read_at IS 'Calendar timestamp when message was marked as read.';
