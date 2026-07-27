CREATE TABLE public.purchase_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  user_id uuid,
  total numeric NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_returns TO authenticated;
GRANT ALL ON public.purchase_returns TO service_role;
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_returns_all_auth ON public.purchase_returns FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.purchase_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_return_items TO authenticated;
GRANT ALL ON public.purchase_return_items TO service_role;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_return_items_all_auth ON public.purchase_return_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.decrement_stock_on_purchase_return()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER purchase_return_items_stock_out AFTER INSERT ON public.purchase_return_items
  FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_purchase_return();