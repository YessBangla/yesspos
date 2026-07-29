-- STOCK COUNTS
CREATE TABLE public.stock_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  count_date date NOT NULL DEFAULT current_date,
  note text,
  status text NOT NULL DEFAULT 'draft',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_counts TO authenticated;
GRANT ALL ON public.stock_counts TO service_role;
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_counts_branch_access" ON public.stock_counts
  FOR ALL TO authenticated USING (public.can_see_branch(branch_id)) WITH CHECK (public.can_see_branch(branch_id));
CREATE TRIGGER stock_counts_updated_at BEFORE UPDATE ON public.stock_counts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.stock_count_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id uuid NOT NULL REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  system_qty integer NOT NULL DEFAULT 0,
  counted_qty integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_count_items TO authenticated;
GRANT ALL ON public.stock_count_items TO service_role;
ALTER TABLE public.stock_count_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_count_items_access" ON public.stock_count_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stock_counts c WHERE c.id = count_id AND public.can_see_branch(c.branch_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stock_counts c WHERE c.id = count_id AND public.can_see_branch(c.branch_id)));

-- PURCHASE ORDERS
CREATE SEQUENCE IF NOT EXISTS public.purchase_order_no_seq START 1001;
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_no bigint NOT NULL DEFAULT nextval('public.purchase_order_no_seq'),
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  order_date date NOT NULL DEFAULT current_date,
  expected_date date,
  status text NOT NULL DEFAULT 'open',
  total numeric NOT NULL DEFAULT 0,
  note text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_orders_branch_access" ON public.purchase_orders
  FOR ALL TO authenticated USING (public.can_see_branch(branch_id)) WITH CHECK (public.can_see_branch(branch_id));
CREATE TRIGGER purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  received_qty integer NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_order_items_access" ON public.purchase_order_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders o WHERE o.id = order_id AND public.can_see_branch(o.branch_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders o WHERE o.id = order_id AND public.can_see_branch(o.branch_id)));

-- LOYALTY
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS loyalty_points integer NOT NULL DEFAULT 0;