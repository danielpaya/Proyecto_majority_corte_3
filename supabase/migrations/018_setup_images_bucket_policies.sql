-- Migration: Setup storage policies for images bucket
-- This allows authenticated users to upload images, and everyone to read them
-- NOTE: If you get permission errors, configure these policies manually from Supabase Dashboard

-- Eliminar políticas existentes si existen (para hacer la migración idempotente)
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read images" ON storage.objects;
DROP POLICY IF EXISTS "Public can read images" ON storage.objects;

-- ============================================
-- POLÍTICA 1: Authenticated users can upload images
-- ============================================
-- Permite a todos los usuarios autenticados subir imágenes
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images');

-- ============================================
-- POLÍTICA 2: Authenticated users can update images
-- ============================================
-- Permite a todos los usuarios autenticados actualizar imágenes
CREATE POLICY "Authenticated users can update images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'images');

-- ============================================
-- POLÍTICA 3: Authenticated users can delete images
-- ============================================
-- Permite a todos los usuarios autenticados eliminar imágenes
CREATE POLICY "Authenticated users can delete images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'images');

-- ============================================
-- POLÍTICA 4: Authenticated users can read images
-- ============================================
-- Permite a todos los usuarios autenticados leer imágenes
CREATE POLICY "Authenticated users can read images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'images');

-- ============================================
-- POLÍTICA 5: Public can read images
-- ============================================
-- Permite a usuarios anónimos leer imágenes (bucket público)
CREATE POLICY "Public can read images"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'images');

