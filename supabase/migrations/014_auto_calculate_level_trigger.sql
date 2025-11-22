-- Migration: Add trigger to automatically recalculate level when points change
-- This ensures that the level is always in sync with the points, even when
-- points are updated directly in the database

-- Función trigger que recalcula el nivel antes de actualizar o insertar
CREATE OR REPLACE FUNCTION public.auto_calculate_level()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Recalcular el nivel basado en los puntos
  -- Si los puntos son NULL, usar 0
  IF NEW.points IS NOT NULL THEN
    NEW.level := public.calculate_level_from_points(NEW.points);
  ELSE
    NEW.level := 1; -- Nivel por defecto si no hay puntos
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear el trigger antes de UPDATE en la tabla profiles
-- Solo se ejecuta cuando los puntos cambian
DROP TRIGGER IF EXISTS trigger_auto_calculate_level ON public.profiles;
CREATE TRIGGER trigger_auto_calculate_level
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.points IS DISTINCT FROM OLD.points OR NEW.level IS NULL)
  EXECUTE FUNCTION public.auto_calculate_level();

-- También crear un trigger para INSERT para asegurar que el nivel se calcule desde el inicio
DROP TRIGGER IF EXISTS trigger_auto_calculate_level_insert ON public.profiles;
CREATE TRIGGER trigger_auto_calculate_level_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_calculate_level();

-- Comentario explicativo
COMMENT ON FUNCTION public.auto_calculate_level() IS 
  'Trigger function that automatically recalculates the user level based on points whenever points are updated in the profiles table.';

-- Función de mantenimiento para recalcular todos los niveles
-- Útil si hay datos inconsistentes o si se necesita sincronizar todos los niveles
CREATE OR REPLACE FUNCTION public.recalculate_all_levels()
RETURNS TABLE(updated_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.profiles
  SET level = public.calculate_level_from_points(COALESCE(points, 0))
  WHERE level IS DISTINCT FROM public.calculate_level_from_points(COALESCE(points, 0));
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_all_levels() TO authenticated;

COMMENT ON FUNCTION public.recalculate_all_levels() IS 
  'Maintenance function to recalculate all user levels based on their current points. Useful for fixing data inconsistencies.';

