-- Migration: Create 'news' table for storing app announcements
-- Run this in your Supabase SQL editor or as a migration file.

-- Ensure the uuid generator is available (pgcrypto or uuid-ossp)
-- If gen_random_uuid() is not available, replace with uuid_generate_v4().

CREATE TABLE IF NOT EXISTS public.news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  image_url text,
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baja')),
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Trigger to keep updated_at current on UPDATE
CREATE OR REPLACE FUNCTION public.refresh_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refresh_news_updated_at ON public.news;
CREATE TRIGGER trg_refresh_news_updated_at
BEFORE UPDATE ON public.news
FOR EACH ROW
EXECUTE PROCEDURE public.refresh_updated_at();

-- Optional: indexes to speed up queries
CREATE INDEX IF NOT EXISTS idx_news_published_at ON public.news (published_at);
CREATE INDEX IF NOT EXISTS idx_news_created_by ON public.news (created_by);
CREATE INDEX IF NOT EXISTS idx_news_expires_at ON public.news (expires_at);

-- OPTIONAL: Row-Level Security (RLS) policies examples.
-- Adjust these policies to match your profiles table and role naming.
-- These examples assume you have a `public.profiles` table with `id` (uuid) and `role` (text),
-- and that admin users have `role = 'admin'`.

-- Enable RLS
-- ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT published news
-- CREATE POLICY "select_published" ON public.news
--   FOR SELECT
--   TO authenticated
--   USING (is_published = true);

-- Allow admins to SELECT all news
-- CREATE POLICY "admins_select_all" ON public.news
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
--     )
--   );

-- Allow only admins to INSERT
-- CREATE POLICY "admins_insert" ON public.news
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (
--     (NEW.created_by = auth.uid()) AND
--     EXISTS (
--       SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
--     )
--   );

-- Allow only admins to UPDATE/DELETE
-- CREATE POLICY "admins_modify" ON public.news
--   FOR UPDATE, DELETE
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
--     )
--   );

-- Note: Uncomment and adapt the RLS policies to your project's profiles schema.
