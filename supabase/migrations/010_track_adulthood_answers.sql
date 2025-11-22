-- Migration: store adulthood questionnaire answers and filter missions

CREATE TABLE IF NOT EXISTS public.adulthood_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.adulthood_questions(id) ON DELETE CASCADE,
  question_slug text NOT NULL,
  answer text NOT NULL CHECK (answer IN ('yes','in_progress','no','na')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT adulthood_answers_user_question_key UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_adulthood_answers_user_id
  ON public.adulthood_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_adulthood_answers_question_slug
  ON public.adulthood_answers(question_slug);

DROP TRIGGER IF EXISTS trg_refresh_adulthood_answers_updated_at ON public.adulthood_answers;
CREATE TRIGGER trg_refresh_adulthood_answers_updated_at
BEFORE UPDATE ON public.adulthood_answers
FOR EACH ROW
EXECUTE FUNCTION public.refresh_updated_at();

ALTER TABLE public.adulthood_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_adulthood_answers ON public.adulthood_answers;
CREATE POLICY select_own_adulthood_answers
  ON public.adulthood_answers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS insert_own_adulthood_answers ON public.adulthood_answers;
CREATE POLICY insert_own_adulthood_answers
  ON public.adulthood_answers
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS update_own_adulthood_answers ON public.adulthood_answers;
CREATE POLICY update_own_adulthood_answers
  ON public.adulthood_answers
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS delete_own_adulthood_answers ON public.adulthood_answers;
CREATE POLICY delete_own_adulthood_answers
  ON public.adulthood_answers
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

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
          AND aa.question_slug = m.slug
          AND aa.answer IN ('yes', 'na')
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.missions_public() TO authenticated;
