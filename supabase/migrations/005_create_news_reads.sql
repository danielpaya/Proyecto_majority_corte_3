-- Migration: create table to track noticias leidas por usuario
-- Run this script inside Supabase SQL editor or via your migration runner.

CREATE TABLE IF NOT EXISTS public.news_reads (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  news_id uuid NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, news_id)
);

CREATE INDEX IF NOT EXISTS idx_news_reads_user ON public.news_reads (user_id);
CREATE INDEX IF NOT EXISTS idx_news_reads_news ON public.news_reads (news_id);

COMMENT ON TABLE public.news_reads IS 'Marca noticias leidas por cada usuario.';
