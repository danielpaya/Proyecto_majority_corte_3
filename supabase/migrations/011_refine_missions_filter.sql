-- Migration: adjust missions_public filter to compare slugs case-insensitively

UPDATE public.adulthood_answers
SET question_slug = LOWER(question_slug)
WHERE question_slug IS NOT NULL
  AND question_slug <> LOWER(question_slug);

DROP FUNCTION IF EXISTS public.missions_public();
CREATE OR REPLACE FUNCTION public.missions_public()
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  description text,
  category text,
  difficulty integer,
  points integer,
  is_system boolean,
  active boolean,
  start_at timestamptz,
  end_at timestamptz,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  location_lat double precision,
  location_lng double precision,
  location_label text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.slug,
    m.title,
    m.description,
    m.category,
    m.difficulty,
    m.points,
    m.is_system,
    m.active,
    m.start_at,
    m.end_at,
    m.created_by,
    m.created_at,
    m.updated_at,
    m.location_lat,
    m.location_lng,
    m.location_label
  FROM public.missions m
  WHERE m.active = true
    AND (m.start_at IS NULL OR m.start_at <= timezone('utc', now()))
    AND (m.end_at IS NULL OR m.end_at >= timezone('utc', now()))
    AND (
      m.created_by IS NOT NULL
      OR auth.uid() IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.adulthood_answers aa
        WHERE aa.user_id = auth.uid()
          AND LOWER(aa.question_slug) = LOWER(m.slug)
          AND aa.answer IN ('yes', 'na')
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.missions_public() TO authenticated;
