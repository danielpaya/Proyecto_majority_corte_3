-- Migration: Add prerequisite validation to accept_mission function
-- This ensures users cannot accept missions without completing required prerequisites

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
  v_required_mission_id uuid;
  v_prerequisite_completed boolean;
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

  -- Verificar prerequisitos: buscar si la misión requiere otra misión completada
  SELECT required_mission_id
    INTO v_required_mission_id
  FROM public.mission_dependencies
  WHERE mission_id = p_mission_id
  LIMIT 1;

  -- Si hay un prerequisito, verificar que esté completado
  IF v_required_mission_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_misiones
      WHERE user_id = v_user_id
        AND mission_id = v_required_mission_id
        AND status = 'completada'
    ) INTO v_prerequisite_completed;

    IF NOT v_prerequisite_completed THEN
      -- Obtener el título de la misión prerequisito para el mensaje de error
      DECLARE
        v_prerequisite_title text;
      BEGIN
        SELECT title INTO v_prerequisite_title
        FROM public.missions
        WHERE id = v_required_mission_id;

        IF v_prerequisite_title IS NOT NULL THEN
          RAISE EXCEPTION 'Debes completar primero la mision: %', v_prerequisite_title;
        ELSE
          RAISE EXCEPTION 'Debes completar la mision prerequisito antes de aceptar esta mision';
        END IF;
      END;
    END IF;
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

