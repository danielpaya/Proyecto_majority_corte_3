-- Migration: add optional location metadata to missions
-- Agrega columnas para guardar coordenadas y una etiqueta legible de la misión.

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision,
  ADD COLUMN IF NOT EXISTS location_label text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'missions_location_lat_check'
  ) THEN
    ALTER TABLE public.missions
      ADD CONSTRAINT missions_location_lat_check
      CHECK (location_lat IS NULL OR (location_lat >= -90 AND location_lat <= 90));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'missions_location_lng_check'
  ) THEN
    ALTER TABLE public.missions
      ADD CONSTRAINT missions_location_lng_check
      CHECK (location_lng IS NULL OR (location_lng >= -180 AND location_lng <= 180));
  END IF;
END
$$;

COMMENT ON COLUMN public.missions.location_lat IS 'Latitud (WGS84) del punto sugerido para iniciar la misión.';
COMMENT ON COLUMN public.missions.location_lng IS 'Longitud (WGS84) del punto sugerido para iniciar la misión.';
COMMENT ON COLUMN public.missions.location_label IS 'Descripción corta de la ubicación de una misión.';
