-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.adulthood_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  block text NOT NULL,
  text text NOT NULL,
  weight integer NOT NULL DEFAULT 5,
  show_if jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT adulthood_questions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.mission_dependencies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL,
  required_mission_id uuid NOT NULL,
  CONSTRAINT mission_dependencies_pkey PRIMARY KEY (id),
  CONSTRAINT mission_dependencies_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id),
  CONSTRAINT mission_dependencies_required_mission_id_fkey FOREIGN KEY (required_mission_id) REFERENCES public.missions(id)
);
CREATE TABLE public.missions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  category text,
  difficulty integer CHECK (difficulty >= 1 AND difficulty <= 5),
  points integer NOT NULL DEFAULT 10,
  is_system boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  start_at timestamp with time zone,
  end_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT missions_pkey PRIMARY KEY (id),
  CONSTRAINT missions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  name text,
  last_name text,
  gender text CHECK (gender = ANY (ARRAY['Masculino'::text, 'Femenino'::text, 'Otro'::text])),
  birth_date date,
  role text NOT NULL DEFAULT 'USER'::text CHECK (role = ANY (ARRAY['USER'::text, 'ADMIN'::text])),
  dark_mode boolean NOT NULL DEFAULT false,
  avatar_url text,
  points integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  onboarding_complete boolean NOT NULL DEFAULT false,
  avatar_template_id text,
  avatar_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_misiones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mission_id uuid NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['pendiente'::text, 'en_curso'::text, 'completada'::text, 'cancelada'::text, 'vencida'::text])),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  points_awarded integer NOT NULL DEFAULT 0,
  feedback text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_misiones_pkey PRIMARY KEY (id),
  CONSTRAINT user_misiones_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_misiones_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id)
);}