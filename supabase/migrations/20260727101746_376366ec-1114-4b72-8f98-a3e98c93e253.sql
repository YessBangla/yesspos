CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'percent',
  value numeric NOT NULL DEFAULT 0,
  min_amount numeric NOT NULL DEFAULT 0,
  max_discount numeric,
  is_active boolean NOT NULL DEFAULT true,
  expires_on date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupons_all_auth" ON public.coupons FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.coupons (code, type, value, min_amount, max_discount) VALUES
  ('SAVE10', 'percent', 10, 500, 200),
  ('FLAT50', 'fixed', 50, 300, NULL),
  ('EID20', 'percent', 20, 1000, 500);

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS coupon_code text;