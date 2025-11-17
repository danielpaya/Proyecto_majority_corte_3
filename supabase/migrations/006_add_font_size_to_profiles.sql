-- Agregar preferencia de tamaño de fuente al perfil de usuario
-- Esta migración asume que la tabla public.profiles ya existe

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS font_size text NOT NULL DEFAULT 'medium'
  CHECK (font_size = ANY (ARRAY['small'::text, 'medium'::text, 'large'::text]));
