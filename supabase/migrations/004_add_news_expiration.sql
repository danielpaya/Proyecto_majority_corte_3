-- Migration: add expires_at column and helper for auto-caducidad
-- Run inside Supabase SQL editor or add through your migration system.

ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_news_expires_at ON public.news (expires_at);

CREATE OR REPLACE FUNCTION public.expire_published_news()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.news
  SET is_published = false,
      published_at = NULL,
      updated_at = timezone('utc', now())
  WHERE is_published = true
    AND expires_at IS NOT NULL
    AND expires_at <= timezone('utc', now());
END;
$$;

COMMENT ON FUNCTION public.expire_published_news() IS 'Despublica noticias cuya fecha expires_at ya paso.';

-- Opcional: programa esta funcion con la extension pg_cron (disponible en Supabase)
-- SELECT cron.schedule('expire-news-every-10-minutes', '*/10 * * * *', $$SELECT public.expire_published_news();$$);
