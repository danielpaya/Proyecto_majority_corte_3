-- Migration: create routes table
-- Guarda rutas calculadas por la app

CREATE TABLE public.routes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  origin_lat double precision NOT NULL,
  origin_lng double precision NOT NULL,
  dest_lat double precision NOT NULL,
  dest_lng double precision NOT NULL,
  distance_m integer NOT NULL DEFAULT 0,
  path jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT routes_pkey PRIMARY KEY (id),
  CONSTRAINT routes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_routes_user_id ON public.routes(user_id);
CREATE INDEX IF NOT EXISTS idx_routes_created_at ON public.routes(created_at);
