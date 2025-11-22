-- Migration: Add wallet balance, subscription plans, and user subscriptions

-- 1. Agregar campo wallet_balance a profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS wallet_balance numeric(10, 2) NOT NULL DEFAULT 0.00;

-- 2. Crear tabla de planes de suscripción
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  price_cop numeric(10, 2) NOT NULL,
  duration_days integer NOT NULL,
  features jsonb DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- 3. Crear tabla de suscripciones de usuarios
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT user_subscriptions_user_plan_unique UNIQUE (user_id, plan_id, status)
);

-- 4. Crear tabla de transacciones de cartera
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit', 'payment', 'refund')),
  amount numeric(10, 2) NOT NULL,
  description text,
  reference_id uuid, -- Para referenciar suscripciones u otras transacciones
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(active);

-- Triggers para updated_at
DROP TRIGGER IF EXISTS trg_refresh_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER trg_refresh_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.refresh_updated_at();

DROP TRIGGER IF EXISTS trg_refresh_user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER trg_refresh_user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.refresh_updated_at();

-- RLS Policies
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Policies para subscription_plans (todos pueden ver planes activos)
DROP POLICY IF EXISTS select_active_subscription_plans ON public.subscription_plans;
CREATE POLICY select_active_subscription_plans
  ON public.subscription_plans
  FOR SELECT
  TO authenticated
  USING (active = true);

-- Policies para user_subscriptions (usuarios solo ven sus propias suscripciones)
DROP POLICY IF EXISTS select_own_subscriptions ON public.user_subscriptions;
CREATE POLICY select_own_subscriptions
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS insert_own_subscriptions ON public.user_subscriptions;
CREATE POLICY insert_own_subscriptions
  ON public.user_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS update_own_subscriptions ON public.user_subscriptions;
CREATE POLICY update_own_subscriptions
  ON public.user_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policies para wallet_transactions (usuarios solo ven sus propias transacciones)
DROP POLICY IF EXISTS select_own_wallet_transactions ON public.wallet_transactions;
CREATE POLICY select_own_wallet_transactions
  ON public.wallet_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS insert_own_wallet_transactions ON public.wallet_transactions;
CREATE POLICY insert_own_wallet_transactions
  ON public.wallet_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Función para agregar dinero a la cartera (simulado)
CREATE OR REPLACE FUNCTION public.add_wallet_balance(
  p_user_id uuid,
  p_amount numeric(10, 2),
  p_description text DEFAULT 'Depósito simulado'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Actualizar balance del perfil
  UPDATE public.profiles
  SET wallet_balance = wallet_balance + p_amount
  WHERE id = p_user_id;

  -- Registrar transacción
  INSERT INTO public.wallet_transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'deposit', p_amount, p_description);
END;
$$;

-- Función para procesar pago de suscripción (simulado)
CREATE OR REPLACE FUNCTION public.process_subscription_payment(
  p_user_id uuid,
  p_plan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_price numeric(10, 2);
  v_current_balance numeric(10, 2);
  v_expires_at timestamptz;
  v_duration_days integer;
  v_subscription_id uuid;
BEGIN
  -- Obtener información del plan
  SELECT price_cop, duration_days INTO v_plan_price, v_duration_days
  FROM public.subscription_plans
  WHERE id = p_plan_id AND active = true;

  IF v_plan_price IS NULL THEN
    RAISE EXCEPTION 'Plan no encontrado o inactivo';
  END IF;

  -- Obtener balance actual
  SELECT wallet_balance INTO v_current_balance
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Verificar si tiene suficiente balance
  IF v_current_balance < v_plan_price THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Saldo insuficiente',
      'required', v_plan_price,
      'current', v_current_balance
    );
  END IF;

  -- Calcular fecha de expiración
  v_expires_at := timezone('utc', now()) + (v_duration_days || ' days')::interval;

  -- Descontar del balance
  UPDATE public.profiles
  SET wallet_balance = wallet_balance - v_plan_price
  WHERE id = p_user_id;

  -- Registrar transacción de pago
  INSERT INTO public.wallet_transactions (user_id, type, amount, description, reference_id)
  VALUES (p_user_id, 'payment', v_plan_price, 'Pago de suscripción', p_plan_id)
  RETURNING id INTO v_subscription_id;

  -- Crear o actualizar suscripción
  INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at)
  VALUES (p_user_id, p_plan_id, 'active', v_expires_at)
  ON CONFLICT (user_id, plan_id, status) 
  DO UPDATE SET
    expires_at = v_expires_at,
    started_at = timezone('utc', now()),
    updated_at = timezone('utc', now());

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pago procesado exitosamente',
    'new_balance', v_current_balance - v_plan_price,
    'expires_at', v_expires_at
  );
END;
$$;

-- Insertar planes por defecto
INSERT INTO public.subscription_plans (name, slug, description, price_cop, duration_days, features) VALUES
  ('Gratis', 'free', 'Plan básico gratuito con funcionalidades limitadas', 0.00, 0, '["Acceso básico", "Chat limitado"]'::jsonb),
  ('Semanal', 'weekly', 'Plan semanal con acceso completo', 15000.00, 7, '["Acceso completo", "Chat ilimitado", "Soporte prioritario"]'::jsonb),
  ('Mensual', 'monthly', 'Plan mensual con acceso completo y beneficios adicionales', 50000.00, 30, '["Acceso completo", "Chat ilimitado", "Soporte prioritario", "Funciones premium"]'::jsonb),
  ('Anual', 'annual', 'Plan anual con el mejor valor y todos los beneficios', 450000.00, 365, '["Acceso completo", "Chat ilimitado", "Soporte prioritario", "Funciones premium", "Descuentos exclusivos"]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Permisos
GRANT EXECUTE ON FUNCTION public.add_wallet_balance(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_subscription_payment(uuid, uuid) TO authenticated;

