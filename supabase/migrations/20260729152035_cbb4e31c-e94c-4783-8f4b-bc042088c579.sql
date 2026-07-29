UPDATE public.products SET image_url = '/products/egg.jpg' WHERE name_en ILIKE '%egg%' AND name_en NOT ILIKE '%noodle%';
UPDATE public.products SET image_url = '/products/bread.jpg' WHERE name_en ILIKE '%bread%' OR name_en ILIKE '%bun%';
UPDATE public.products SET image_url = '/products/soap.jpg' WHERE name_en ILIKE '%soap%' OR name_en ILIKE '%hand wash%';
UPDATE public.products SET image_url = '/products/shampoo.jpg' WHERE name_en ILIKE '%shampoo%' OR name_en ILIKE '%lotion%';
UPDATE public.products SET image_url = '/products/toothpaste.jpg' WHERE name_en ILIKE '%tooth%';
UPDATE public.products SET image_url = '/products/tissue.jpg' WHERE name_en ILIKE '%tissue%';
UPDATE public.products SET image_url = '/products/chips.jpg' WHERE name_en ILIKE '%chips%' OR name_en ILIKE '%cracker%' OR name_en ILIKE '%chanachur%';
UPDATE public.products SET image_url = '/products/chocolate.jpg' WHERE name_en ILIKE '%chocolate%' OR name_en ILIKE '%kitkat%';
UPDATE public.products SET image_url = '/products/noodles.jpg' WHERE name_en ILIKE '%noodle%' OR name_en ILIKE '%pasta%';
UPDATE public.products SET image_url = '/products/cola.jpg' WHERE name_en ILIKE '%cola%' OR name_en ILIKE '%pepsi%' OR name_en ILIKE '%sprite%' OR name_en ILIKE '%mojo%' OR name_en ILIKE '%speed%';
UPDATE public.products SET image_url = '/products/water.jpg' WHERE name_en ILIKE '%water%';
UPDATE public.products SET image_url = '/products/diaper.jpg' WHERE name_en ILIKE '%diaper%' OR name_en ILIKE '%wipes%';
UPDATE public.products SET image_url = '/products/detergent.jpg' WHERE name_en ILIKE '%detergent%' OR name_en ILIKE '%washing powder%';
UPDATE public.products SET image_url = '/products/dishwash.jpg' WHERE name_en ILIKE '%dishwash%' OR name_en ILIKE '%floor cleaner%';
UPDATE public.products SET image_url = '/products/coffee.jpg' WHERE name_en ILIKE '%nescafe%' OR name_en ILIKE '%coffee%';
UPDATE public.products SET image_url = '/products/yogurt.jpg' WHERE name_en ILIKE '%yogurt%';
UPDATE public.products SET image_url = '/products/butter.jpg' WHERE name_en ILIKE '%butter%' OR name_en ILIKE '%cheese%';
UPDATE public.products SET image_url = '/products/honey.jpg' WHERE name_en ILIKE '%honey%';
UPDATE public.products SET image_url = '/products/onion.jpg' WHERE name_en ILIKE '%onion%';
UPDATE public.products SET image_url = '/products/potato.jpg' WHERE name_en ILIKE 'potato 1kg';
UPDATE public.products SET image_url = '/products/tomato.jpg' WHERE name_en ILIKE '%tomato%';
UPDATE public.products SET image_url = '/products/banana.jpg' WHERE name_en ILIKE '%banana%';
UPDATE public.products SET image_url = '/products/milk.jpg' WHERE name_en ILIKE '%milk%' AND name_en NOT ILIKE '%bread%';

CREATE INDEX IF NOT EXISTS idx_products_active_name ON public.products (is_active, name_en);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_branch ON public.product_stock (branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON public.sales (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items (sale_id);

CREATE TABLE IF NOT EXISTS public.delivery_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no bigserial NOT NULL,
  branch_id uuid REFERENCES public.branches(id),
  contact_id uuid REFERENCES public.contacts(id),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  address text NOT NULL,
  area text,
  note text,
  slot text,
  payment_method text NOT NULL DEFAULT 'cod',
  subtotal numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  sale_id uuid REFERENCES public.sales(id),
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  name_snapshot text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_orders TO authenticated;
GRANT SELECT, INSERT ON public.delivery_orders TO anon;
GRANT ALL ON public.delivery_orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_order_items TO authenticated;
GRANT SELECT, INSERT ON public.delivery_order_items TO anon;
GRANT ALL ON public.delivery_order_items TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.delivery_orders_order_no_seq TO anon, authenticated, service_role;

ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can place delivery order" ON public.delivery_orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anyone can add order items" ON public.delivery_order_items
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "staff read delivery orders" ON public.delivery_orders
  FOR SELECT TO authenticated USING (public.can_see_branch(branch_id));
CREATE POLICY "staff update delivery orders" ON public.delivery_orders
  FOR UPDATE TO authenticated USING (public.can_see_branch(branch_id));
CREATE POLICY "staff delete delivery orders" ON public.delivery_orders
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "staff read order items" ON public.delivery_order_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff update order items" ON public.delivery_order_items
  FOR UPDATE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON public.delivery_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_order_items_order ON public.delivery_order_items (order_id);

CREATE TRIGGER trg_delivery_orders_updated
  BEFORE UPDATE ON public.delivery_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "public can browse products" ON public.products;
CREATE POLICY "public can browse products" ON public.products
  FOR SELECT TO anon USING (is_active = true);
GRANT SELECT ON public.products TO anon;
DROP POLICY IF EXISTS "public can browse categories" ON public.categories;
CREATE POLICY "public can browse categories" ON public.categories
  FOR SELECT TO anon USING (true);
GRANT SELECT ON public.categories TO anon;

CREATE OR REPLACE FUNCTION public.track_delivery_order(_order_no bigint, _phone text)
RETURNS TABLE(order_no bigint, status text, total numeric, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.order_no, d.status, d.total, d.created_at
  FROM public.delivery_orders d
  WHERE d.order_no = _order_no AND d.customer_phone = trim(_phone)
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.track_delivery_order(bigint, text) TO anon, authenticated;