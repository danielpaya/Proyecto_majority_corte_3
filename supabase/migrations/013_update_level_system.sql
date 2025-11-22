-- Migration: Update level calculation system to support level 100 (max level)
-- Formula: Level N requires 100 * (N-1) * N / 2 total points
-- Level 1 → 2: 100 points
-- Level 2 → 3: 200 points (total 300)
-- Level 3 → 4: 300 points (total 600)
-- ...
-- Level 99 → 100: 9900 points (total 495,000)

-- Función para calcular el nivel basado en los puntos
CREATE OR REPLACE FUNCTION public.calculate_level_from_points(p_points integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_level integer := 1;
  v_required_points integer;
  v_max_level integer := 100;
BEGIN
  -- Si tiene 0 puntos, está en nivel 1
  IF p_points <= 0 THEN
    RETURN 1;
  END IF;

  -- Calcular el nivel máximo posible
  -- Para nivel N, se necesitan: 100 * (N-1) * N / 2 puntos totales
  -- Resolvemos: p_points >= 100 * (N-1) * N / 2
  -- Simplificando: p_points >= 50 * N * (N-1)
  -- Aproximación: N ≈ sqrt(p_points / 50)
  
  -- Buscar el nivel máximo alcanzable
  -- Para nivel N, se necesitan: 100 * (N-1) * N / 2 puntos totales
  -- Para nivel N+1, se necesitan: 100 * N * (N+1) / 2 puntos totales
  -- Si p_points está entre estos dos valores, el nivel es N
  
  FOR v_level IN 1..v_max_level LOOP
    -- Puntos necesarios para alcanzar este nivel
    IF v_level = 1 THEN
      v_required_points := 0;
    ELSE
      v_required_points := 100 * (v_level - 1) * v_level / 2;
    END IF;
    
    -- Si los puntos son menores que los requeridos para el siguiente nivel, este es el nivel actual
    IF v_level < v_max_level THEN
      DECLARE
        v_next_level_points integer := 100 * v_level * (v_level + 1) / 2;
      BEGIN
        -- Si los puntos están en el rango [v_required_points, v_next_level_points), este es el nivel
        IF p_points >= v_required_points AND p_points < v_next_level_points THEN
          RETURN v_level;
        END IF;
      END;
    ELSE
      -- Si llegamos al nivel máximo, verificar si tiene suficientes puntos
      IF p_points >= v_required_points THEN
        RETURN v_max_level;
      END IF;
    END IF;
  END LOOP;

  -- Si no se encontró (no debería pasar), retornar nivel 1
  RETURN 1;
END;
$$;

-- Actualizar la función complete_mission para que también actualice el nivel
DROP FUNCTION IF EXISTS public.complete_mission(uuid);
CREATE OR REPLACE FUNCTION public.complete_mission(p_mission_id uuid)
RETURNS TABLE(user_mission_id uuid, points_awarded integer, total_points integer, new_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_role text;
  v_points integer := 0;
  v_new_points integer;
  v_current_level integer;
  v_new_level integer;
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

  -- Obtener nivel actual
  SELECT level INTO v_current_level
  FROM public.profiles
  WHERE id = v_user_id;

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

  -- Actualizar puntos y calcular nuevo nivel
  UPDATE public.profiles
  SET 
    points = points + COALESCE(points_awarded, 0),
    level = public.calculate_level_from_points(points + COALESCE(points_awarded, 0))
  WHERE id = v_user_id
  RETURNING points, level
  INTO v_new_points, v_new_level;

  total_points := v_new_points;
  new_level := v_new_level;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_mission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_level_from_points(integer) TO authenticated;

-- Función helper para obtener puntos necesarios para un nivel específico
CREATE OR REPLACE FUNCTION public.get_points_for_level(p_level integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_level <= 1 THEN
    RETURN 0;
  END IF;
  
  IF p_level > 100 THEN
    RETURN 495000; -- Puntos para nivel 100 (máximo)
  END IF;
  
  -- Puntos totales necesarios para alcanzar el nivel p_level
  RETURN 100 * (p_level - 1) * p_level / 2;
END;
$$;

-- Función helper para obtener puntos necesarios para el siguiente nivel
CREATE OR REPLACE FUNCTION public.get_points_for_next_level(p_level integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_level >= 100 THEN
    RETURN 0; -- No hay siguiente nivel después del máximo
  END IF;
  
  -- Puntos necesarios para el siguiente nivel (p_level + 1)
  RETURN 100 * p_level * (p_level + 1) / 2;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_points_for_level(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_points_for_next_level(integer) TO authenticated;

