-- KavShare Supabase — Initial Setup
-- Migration Date: 2026-05-27
--
-- This is the very first migration. It only enables the UUID extension.
-- All tables are created in subsequent numbered migrations.

-- Enable UUID extension (required by all other migrations)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
