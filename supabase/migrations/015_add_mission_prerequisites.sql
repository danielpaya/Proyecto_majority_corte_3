-- Migration: Add support for mission prerequisites
-- This migration ensures the mission_dependencies table exists and has proper indexes

-- Asegurar que la tabla mission_dependencies existe (ya debería existir según 000_create_incial_tables.sql)
-- Pero agregamos índices para mejorar el rendimiento de las consultas

-- Índice para buscar dependencias de una misión
CREATE INDEX IF NOT EXISTS idx_mission_dependencies_mission_id 
ON public.mission_dependencies(mission_id);

-- Índice para buscar qué misiones requieren una misión específica
CREATE INDEX IF NOT EXISTS idx_mission_dependencies_required_mission_id 
ON public.mission_dependencies(required_mission_id);

-- Índice único compuesto para evitar dependencias duplicadas
CREATE UNIQUE INDEX IF NOT EXISTS idx_mission_dependencies_unique 
ON public.mission_dependencies(mission_id, required_mission_id);

-- Comentarios para documentación
COMMENT ON TABLE public.mission_dependencies IS 
  'Tabla que almacena las dependencias entre misiones. Si una misión requiere completar otra misión primero, se registra aquí.';

COMMENT ON COLUMN public.mission_dependencies.mission_id IS 
  'ID de la misión que requiere el prerequisito';

COMMENT ON COLUMN public.mission_dependencies.required_mission_id IS 
  'ID de la misión que debe completarse primero (prerequisito)';

