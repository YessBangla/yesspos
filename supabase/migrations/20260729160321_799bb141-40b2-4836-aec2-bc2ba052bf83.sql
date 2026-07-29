ALTER TABLE public.delivery_orders ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_delivery_orders_user ON public.delivery_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_phone ON public.delivery_orders(customer_phone);

DROP POLICY IF EXISTS "Customers view own delivery orders" ON public.delivery_orders;
CREATE POLICY "Customers view own delivery orders" ON public.delivery_orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  full_name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  area text NOT NULL,
  note text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own addresses" ON public.customer_addresses;
CREATE POLICY "Users manage own addresses" ON public.customer_addresses
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_customer_addresses_updated ON public.customer_addresses;
CREATE TRIGGER trg_customer_addresses_updated BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();