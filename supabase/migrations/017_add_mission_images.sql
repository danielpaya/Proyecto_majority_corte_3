-- Migration: Add image_url field to missions table for storing mission images
-- Images will be stored in Supabase Storage bucket "images"

-- Agregar columna image_url si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'missions'
      AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.missions
      ADD COLUMN image_url text;
  END IF;
END
$$;

-- Comentario para documentación
COMMENT ON COLUMN public.missions.image_url IS 
  'URL de la imagen de la misión almacenada en Supabase Storage bucket "images". Puede ser una URL pública o un path relativo al bucket.';

