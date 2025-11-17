-- Migration: mission workflow helpers
-- Crea constraint, funciones y permisos para aceptar/completar misiones respaldado por la base de datos.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_misiones_user_mission_key'
  ) THEN
    ALTER TABLE public.user_misiones
      ADD CONSTRAINT user_misiones_user_mission_key UNIQUE (user_id, mission_id);
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.accept_mission(uuid);
CREATE OR REPLACE FUNCTION public.accept_mission(p_mission_id uuid)
RETURNS TABLE(user_mission_id uuid, mission_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_role text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere una sesion activa para aceptar misiones';
  END IF;

  SELECT role
    INTO v_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_role IS DISTINCT FROM 'USER' THEN
    RAISE EXCEPTION 'Solo usuarios finales pueden aceptar misiones';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.missions m
    WHERE m.id = p_mission_id
      AND m.active = true
      AND (m.start_at IS NULL OR m.start_at <= v_now)
      AND (m.end_at IS NULL OR m.end_at >= v_now)
  ) THEN
    RAISE EXCEPTION 'La mision no esta disponible en este momento';
  END IF;

  WITH upsert AS (
    INSERT INTO public.user_misiones (
      user_id, mission_id, status, started_at, completed_at,
      points_awarded, feedback, created_at, updated_at
    )
    VALUES (v_user_id, p_mission_id, 'en_curso', v_now, NULL, 0, NULL, v_now, v_now)
    ON CONFLICT (user_id, mission_id)
    DO UPDATE
      SET status = 'en_curso',
          started_at = COALESCE(public.user_misiones.started_at, v_now),
          completed_at = NULL,
          points_awarded = 0,
          updated_at = v_now
      WHERE public.user_misiones.status IN ('pendiente', 'en_curso', 'vencida', 'cancelada')
    RETURNING id, status
  )
  SELECT id, status
    INTO user_mission_id, mission_status
  FROM upsert;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ya tomaste o completaste esta mision';
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_mission(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.complete_mission(uuid);
CREATE OR REPLACE FUNCTION public.complete_mission(p_mission_id uuid)
RETURNS TABLE(user_mission_id uuid, points_awarded integer, total_points integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_role text;
  v_points integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere una sesion activa para completar misiones';
  END IF;

  SELECT role
    INTO v_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_role IS DISTINCT FROM 'USER' THEN
    RAISE EXCEPTION 'Solo usuarios finales pueden completar misiones';
  END IF;

  SELECT points
    INTO v_points
  FROM public.missions
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La mision indicada no existe';
  END IF;

  UPDATE public.user_misiones um
  SET status = 'completada',
      completed_at = v_now,
      points_awarded = COALESCE(v_points, 0),
      updated_at = v_now
  WHERE um.user_id = v_user_id
    AND um.mission_id = p_mission_id
    AND um.status IN ('en_curso', 'pendiente')
  RETURNING
    um.id,
    um.points_awarded
  INTO user_mission_id, points_awarded;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes esta mision activa';
  END IF;

  UPDATE public.profiles
  SET points = points + COALESCE(points_awarded, 0)
  WHERE id = v_user_id
  RETURNING points
  INTO total_points;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_mission(uuid) TO authenticated;
