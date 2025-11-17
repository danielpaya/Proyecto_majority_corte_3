-- Migration: ensure news table has priority handling and creation timestamp
-- Run inside the Supabase SQL editor or add to your migration history.

ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media'
    CHECK (priority IN ('alta', 'media', 'baja'));

ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());

ALTER TABLE public.news
  ALTER COLUMN created_at SET DEFAULT timezone('utc', now());

UPDATE public.news
SET created_at = COALESCE(created_at, published_at, timezone('utc', now()))
WHERE created_at IS NULL;

ALTER TABLE public.news
  ALTER COLUMN created_at SET NOT NULL;

COMMENT ON COLUMN public.news.priority IS 'Prioridad de la noticia (alta, media, baja)';
COMMENT ON COLUMN public.news.created_at IS 'Fecha de creacion de la noticia (UTC)';
