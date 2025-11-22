-- Migration: Setup images bucket for mission images
-- This creates the bucket. Storage policies must be configured via Supabase Dashboard
-- due to permission restrictions on storage.objects table.

-- Crear el bucket "images" si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true, -- Bucket público para que las URLs públicas funcionen
  5242880, -- 5MB límite de tamaño
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- NOTA IMPORTANTE: Las políticas de storage deben configurarse manualmente desde el Dashboard de Supabase
-- debido a restricciones de permisos en la tabla storage.objects.
--
-- Pasos para configurar las políticas:
-- 1. Ve a Supabase Dashboard > Storage > Policies
-- 2. Selecciona el bucket "images"
-- 3. Crea las siguientes políticas:
--
-- POLÍTICA 1: "Admins can upload images"
--   - Operation: INSERT
--   - Target roles: authenticated
--   - Policy definition:
--     bucket_id = 'images' AND
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
--     )
--
-- POLÍTICA 2: "Admins can update images"
--   - Operation: UPDATE
--   - Target roles: authenticated
--   - Policy definition:
--     bucket_id = 'images' AND
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
--     )
--
-- POLÍTICA 3: "Admins can delete images"
--   - Operation: DELETE
--   - Target roles: authenticated
--   - Policy definition:
--     bucket_id = 'images' AND
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
--     )
--
-- POLÍTICA 4: "Authenticated users can read images"
--   - Operation: SELECT
--   - Target roles: authenticated
--   - Policy definition:
--     bucket_id = 'images'
--
-- POLÍTICA 5: "Public can read images"
--   - Operation: SELECT
--   - Target roles: anon
--   - Policy definition:
--     bucket_id = 'images'

