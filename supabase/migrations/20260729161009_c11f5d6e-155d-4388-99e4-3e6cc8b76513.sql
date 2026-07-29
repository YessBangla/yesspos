
-- DELIVERY ZONES
CREATE TABLE public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  name_en text NOT NULL,
  name_bn text NOT NULL,
  delivery_fee numeric NOT NULL DEFAULT 0,
  free_delivery_above numeric,
  min_order numeric NOT NULL DEFAULT 0,
  eta_minutes integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;
GRANT ALL ON public.delivery_zones TO service_role;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones public read active" ON public.delivery_zones FOR SELECT TO anon USING (is_active);
CREATE POLICY "zones staff read" ON public.delivery_zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "zones manage" ON public.delivery_zones FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER trg_zones_updated BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RIDERS
CREATE TABLE public.delivery_riders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id uuid,
  name text NOT NULL,
  phone text NOT NULL,
  vehicle text NOT NULL DEFAULT 'bike',
  nid text,
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_riders TO authenticated;
GRANT ALL ON public.delivery_riders TO service_role;
ALTER TABLE public.delivery_riders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "riders staff read" ON public.delivery_riders FOR SELECT TO authenticated USING (true);
CREATE POLICY "riders manage" ON public.delivery_riders FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER trg_riders_updated BEFORE UPDATE ON public.delivery_riders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROMOTIONS / BANNERS
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text,
  link_url text,
  kind text NOT NULL DEFAULT 'banner',
  placement text NOT NULL DEFAULT 'hero',
  bg_color text,
  sort_order integer NOT NULL DEFAULT 0,
  starts_on date,
  ends_on date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promotions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promos public read active" ON public.promotions FOR SELECT TO anon USING (is_active);
CREATE POLICY "promos staff read" ON public.promotions FOR SELECT TO authenticated USING (true);
CREATE POLICY "promos manage" ON public.promotions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER trg_promos_updated BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRODUCT REVIEWS
CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid,
  customer_name text NOT NULL,
  rating integer NOT NULL DEFAULT 5,
  comment text,
  is_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews public read approved" ON public.product_reviews FOR SELECT TO anon USING (is_approved);
CREATE POLICY "reviews auth read" ON public.product_reviews FOR SELECT TO authenticated
  USING (is_approved OR user_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "reviews own insert" ON public.product_reviews FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "reviews own update" ON public.product_reviews FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "reviews admin manage" ON public.product_reviews FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- DELIVERY ORDER LINKS
ALTER TABLE public.delivery_orders
  ADD COLUMN IF NOT EXISTS rider_id uuid REFERENCES public.delivery_riders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_delivery_orders_rider ON public.delivery_orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.product_reviews(product_id);

-- SEED
INSERT INTO public.delivery_zones (name_en, name_bn, delivery_fee, free_delivery_above, min_order, eta_minutes, sort_order) VALUES
  ('Dhanmondi','ধানমন্ডি',29,500,100,60,1),
  ('Mirpur','মিরপুর',39,700,150,90,2),
  ('Uttara','উত্তরা',39,700,150,90,3),
  ('Gulshan','গুলশান',29,500,100,60,4),
  ('Mohammadpur','মোহাম্মদপুর',29,500,100,75,5),
  ('Bashundhara R/A','বসুন্ধরা আ/এ',49,900,200,120,6);

INSERT INTO public.delivery_riders (name, phone, vehicle) VALUES
  ('রফিকুল ইসলাম','01710000001','bike'),
  ('সাব্বির হোসেন','01710000002','bike'),
  ('জুয়েল রানা','01710000003','cycle');

INSERT INTO public.promotions (title, subtitle, kind, placement, bg_color, sort_order) VALUES
  ('ফ্রি ডেলিভারি ৫০০৳+ অর্ডারে','ঢাকা শহরের ভিতরে যেকোনো অর্ডারে','banner','hero','#0f766e',1),
  ('তাজা সবজি ২০% ছাড়','প্রতিদিন সকাল ৮টা থেকে','banner','hero','#b45309',2),
  ('নতুন গ্রাহকদের জন্য ১০০৳ ছাড়','প্রথম অর্ডারে কোড NEW100','campaign','strip','#1d4ed8',3);
