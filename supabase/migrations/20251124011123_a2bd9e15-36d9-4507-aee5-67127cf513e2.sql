-- =====================================================
-- PHASE 3: MULTI-TENANT WHATSAPP + ADMIN SYSTEM
-- =====================================================

-- 1. Create user roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Create user_roles table for role-based access control
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Create whatsapp_instances table for per-restaurant WhatsApp connections
CREATE TABLE public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL UNIQUE,
  instance_name TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'waiting_qr')),
  qr_code TEXT,
  qr_code_base64 TEXT,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on whatsapp_instances
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_instances
CREATE POLICY "Users can view their restaurant WhatsApp instance"
  ON public.whatsapp_instances
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_instances.restaurant_id
        AND user_has_restaurant_access(restaurants.id)
    )
  );

CREATE POLICY "Users can update their restaurant WhatsApp instance"
  ON public.whatsapp_instances
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_instances.restaurant_id
        AND user_has_restaurant_access(restaurants.id)
    )
  );

CREATE POLICY "Users can insert their restaurant WhatsApp instance"
  ON public.whatsapp_instances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_instances.restaurant_id
        AND user_has_restaurant_access(restaurants.id)
    )
  );

CREATE POLICY "Admins can view all WhatsApp instances"
  ON public.whatsapp_instances
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage all WhatsApp instances"
  ON public.whatsapp_instances
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 6. Create system_logs table for admin panel
CREATE TABLE public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  log_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on system_logs
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all system logs"
  ON public.system_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert system logs"
  ON public.system_logs
  FOR INSERT
  WITH CHECK (true);

-- 7. Add trigger for whatsapp_instances updated_at
CREATE TRIGGER update_whatsapp_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Create indexes for performance
CREATE INDEX idx_whatsapp_instances_restaurant_id ON public.whatsapp_instances(restaurant_id);
CREATE INDEX idx_whatsapp_instances_instance_name ON public.whatsapp_instances(instance_name);
CREATE INDEX idx_whatsapp_instances_status ON public.whatsapp_instances(status);
CREATE INDEX idx_system_logs_restaurant_id ON public.system_logs(restaurant_id);
CREATE INDEX idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- 9. Create helper function to get restaurant by instance name
CREATE OR REPLACE FUNCTION public.get_restaurant_by_instance(instance_name TEXT)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id
  FROM public.whatsapp_instances
  WHERE whatsapp_instances.instance_name = get_restaurant_by_instance.instance_name
  LIMIT 1
$$;