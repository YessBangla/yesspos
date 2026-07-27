-- 1. BRANCHES
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  address text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY branches_read ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY branches_admin_write ON public.branches FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER branches_updated_at BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.branches (name, code, address) VALUES ('Main Branch', 'MAIN', NULL);

-- 2. PROFILE -> BRANCH
ALTER TABLE public.profiles ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
UPDATE public.profiles SET branch_id = (SELECT id FROM public.branches WHERE code = 'MAIN');

CREATE OR REPLACE FUNCTION public.my_branch_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_see_branch(_branch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _branch_id IS NULL
     OR public.is_admin(auth.uid())
     OR _branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid());
$$;

-- allow admins to set a user's branch
CREATE POLICY profiles_admin_update ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, branch_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    (SELECT id FROM public.branches WHERE code = 'MAIN')
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cashier')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. BRANCH COLUMNS ON TRANSACTIONAL TABLES
ALTER TABLE public.sales             ADD COLUMN branch_id uuid REFERENCES public.branches(id) DEFAULT public.my_branch_id();
ALTER TABLE public.purchases         ADD COLUMN branch_id uuid REFERENCES public.branches(id) DEFAULT public.my_branch_id();
ALTER TABLE public.sale_returns      ADD COLUMN branch_id uuid REFERENCES public.branches(id) DEFAULT public.my_branch_id();
ALTER TABLE public.purchase_returns  ADD COLUMN branch_id uuid REFERENCES public.branches(id) DEFAULT public.my_branch_id();
ALTER TABLE public.expenses          ADD COLUMN branch_id uuid REFERENCES public.branches(id) DEFAULT public.my_branch_id();
ALTER TABLE public.payments          ADD COLUMN branch_id uuid REFERENCES public.branches(id) DEFAULT public.my_branch_id();
ALTER TABLE public.stock_adjustments ADD COLUMN branch_id uuid REFERENCES public.branches(id) DEFAULT public.my_branch_id();
ALTER TABLE public.accounts          ADD COLUMN branch_id uuid REFERENCES public.branches(id) DEFAULT public.my_branch_id();
ALTER TABLE public.account_transactions ADD COLUMN branch_id uuid REFERENCES public.branches(id) DEFAULT public.my_branch_id();
ALTER TABLE public.journal_entries   ADD COLUMN branch_id uuid REFERENCES public.branches(id) DEFAULT public.my_branch_id();

UPDATE public.sales             SET branch_id = (SELECT id FROM public.branches WHERE code='MAIN') WHERE branch_id IS NULL;
UPDATE public.purchases         SET branch_id = (SELECT id FROM public.branches WHERE code='MAIN') WHERE branch_id IS NULL;
UPDATE public.sale_returns      SET branch_id = (SELECT id FROM public.branches WHERE code='MAIN') WHERE branch_id IS NULL;
UPDATE public.purchase_returns  SET branch_id = (SELECT id FROM public.branches WHERE code='MAIN') WHERE branch_id IS NULL;
UPDATE public.expenses          SET branch_id = (SELECT id FROM public.branches WHERE code='MAIN') WHERE branch_id IS NULL;
UPDATE public.payments          SET branch_id = (SELECT id FROM public.branches WHERE code='MAIN') WHERE branch_id IS NULL;
UPDATE public.stock_adjustments SET branch_id = (SELECT id FROM public.branches WHERE code='MAIN') WHERE branch_id IS NULL;
UPDATE public.accounts          SET branch_id = (SELECT id FROM public.branches WHERE code='MAIN') WHERE branch_id IS NULL;
UPDATE public.account_transactions SET branch_id = (SELECT id FROM public.branches WHERE code='MAIN') WHERE branch_id IS NULL;
UPDATE public.journal_entries   SET branch_id = (SELECT id FROM public.branches WHERE code='MAIN') WHERE branch_id IS NULL;

-- 4. BRANCH-SCOPED READ POLICIES
DROP POLICY IF EXISTS sales_read_auth ON public.sales;
CREATE POLICY sales_read_auth ON public.sales FOR SELECT TO authenticated USING (public.can_see_branch(branch_id));

DROP POLICY IF EXISTS purchases_all_auth ON public.purchases;
CREATE POLICY purchases_all_auth ON public.purchases FOR ALL TO authenticated
  USING (public.can_see_branch(branch_id)) WITH CHECK (public.can_see_branch(branch_id));

DROP POLICY IF EXISTS sale_returns_all_auth ON public.sale_returns;
CREATE POLICY sale_returns_all_auth ON public.sale_returns FOR ALL TO authenticated
  USING (public.can_see_branch(branch_id)) WITH CHECK (public.can_see_branch(branch_id));

DROP POLICY IF EXISTS purchase_returns_all_auth ON public.purchase_returns;
CREATE POLICY purchase_returns_all_auth ON public.purchase_returns FOR ALL TO authenticated
  USING (public.can_see_branch(branch_id)) WITH CHECK (public.can_see_branch(branch_id));

DROP POLICY IF EXISTS expenses_all_auth ON public.expenses;
CREATE POLICY expenses_all_auth ON public.expenses FOR ALL TO authenticated
  USING (public.can_see_branch(branch_id)) WITH CHECK (public.can_see_branch(branch_id));

DROP POLICY IF EXISTS payments_all_auth ON public.payments;
CREATE POLICY payments_all_auth ON public.payments FOR ALL TO authenticated
  USING (public.can_see_branch(branch_id)) WITH CHECK (public.can_see_branch(branch_id));

DROP POLICY IF EXISTS stock_adjustments_all_auth ON public.stock_adjustments;
CREATE POLICY stock_adjustments_all_auth ON public.stock_adjustments FOR ALL TO authenticated
  USING (public.can_see_branch(branch_id)) WITH CHECK (public.can_see_branch(branch_id));

DROP POLICY IF EXISTS accounts_all_auth ON public.accounts;
CREATE POLICY accounts_all_auth ON public.accounts FOR ALL TO authenticated
  USING (public.can_see_branch(branch_id)) WITH CHECK (public.can_see_branch(branch_id));

DROP POLICY IF EXISTS account_transactions_all_auth ON public.account_transactions;
CREATE POLICY account_transactions_all_auth ON public.account_transactions FOR ALL TO authenticated
  USING (public.can_see_branch(branch_id)) WITH CHECK (public.can_see_branch(branch_id));

DROP POLICY IF EXISTS journal_entries_all_auth ON public.journal_entries;
CREATE POLICY journal_entries_all_auth ON public.journal_entries FOR ALL TO authenticated
  USING (public.can_see_branch(branch_id)) WITH CHECK (public.can_see_branch(branch_id));

-- 5. PER-BRANCH STOCK
CREATE TABLE public.product_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  stock integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, branch_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_stock TO authenticated;
GRANT ALL ON public.product_stock TO service_role;
ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_stock_all_auth ON public.product_stock FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER product_stock_updated_at BEFORE UPDATE ON public.product_stock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.product_stock (product_id, branch_id, stock)
SELECT p.id, (SELECT id FROM public.branches WHERE code='MAIN'), COALESCE(p.stock,0) FROM public.products p;

-- keep products.stock as the company-wide total
CREATE OR REPLACE FUNCTION public.sync_product_total_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE public.products
    SET stock = COALESCE((SELECT SUM(stock) FROM public.product_stock WHERE product_id = pid), 0),
        updated_at = now()
    WHERE id = pid;
  RETURN NULL;
END;
$$;
CREATE TRIGGER product_stock_sync AFTER INSERT OR UPDATE OR DELETE ON public.product_stock
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_total_stock();

CREATE OR REPLACE FUNCTION public.adjust_branch_stock(_product_id uuid, _branch_id uuid, _delta integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _product_id IS NULL OR _branch_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.product_stock (product_id, branch_id, stock)
  VALUES (_product_id, _branch_id, _delta)
  ON CONFLICT (product_id, branch_id)
  DO UPDATE SET stock = public.product_stock.stock + EXCLUDED.stock, updated_at = now();
END;
$$;

-- 6. STOCK MOVEMENT TRIGGERS (branch aware)
CREATE OR REPLACE FUNCTION public.decrement_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid;
BEGIN
  SELECT branch_id INTO b FROM public.sales WHERE id = NEW.sale_id;
  PERFORM public.adjust_branch_stock(NEW.product_id, b, -NEW.quantity);
  RETURN NEW;
END;
$$;
CREATE TRIGGER sale_items_stock AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.decrement_stock();

CREATE OR REPLACE FUNCTION public.increment_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid;
BEGIN
  SELECT branch_id INTO b FROM public.purchases WHERE id = NEW.purchase_id;
  PERFORM public.adjust_branch_stock(NEW.product_id, b, NEW.quantity);
  RETURN NEW;
END;
$$;
CREATE TRIGGER purchase_items_stock AFTER INSERT ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.increment_stock();

CREATE OR REPLACE FUNCTION public.increment_stock_on_sale_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid;
BEGIN
  SELECT branch_id INTO b FROM public.sale_returns WHERE id = NEW.return_id;
  PERFORM public.adjust_branch_stock(NEW.product_id, b, NEW.quantity);
  RETURN NEW;
END;
$$;
CREATE TRIGGER sale_return_items_stock AFTER INSERT ON public.sale_return_items
  FOR EACH ROW EXECUTE FUNCTION public.increment_stock_on_sale_return();

CREATE OR REPLACE FUNCTION public.decrement_stock_on_purchase_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid;
BEGIN
  SELECT branch_id INTO b FROM public.purchase_returns WHERE id = NEW.return_id;
  PERFORM public.adjust_branch_stock(NEW.product_id, b, -NEW.quantity);
  RETURN NEW;
END;
$$;
CREATE TRIGGER purchase_return_items_stock AFTER INSERT ON public.purchase_return_items
  FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_purchase_return();

CREATE OR REPLACE FUNCTION public.apply_stock_adjustment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.adjust_branch_stock(
    NEW.product_id, NEW.branch_id,
    CASE WHEN NEW.type = 'add' THEN NEW.quantity ELSE -NEW.quantity END);
  RETURN NEW;
END;
$$;
CREATE TRIGGER stock_adjustments_stock AFTER INSERT ON public.stock_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_adjustment();

-- 7. BRANCH STOCK TRANSFERS
CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_branch_id uuid NOT NULL REFERENCES public.branches(id),
  to_branch_id uuid NOT NULL REFERENCES public.branches(id),
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfers TO authenticated;
GRANT ALL ON public.stock_transfers TO service_role;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_transfers_all_auth ON public.stock_transfers FOR ALL TO authenticated
  USING (public.can_see_branch(from_branch_id) OR public.can_see_branch(to_branch_id))
  WITH CHECK (public.can_see_branch(from_branch_id) OR public.can_see_branch(to_branch_id));
CREATE TRIGGER stock_transfers_updated_at BEFORE UPDATE ON public.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfer_items TO authenticated;
GRANT ALL ON public.stock_transfer_items TO service_role;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_transfer_items_all_auth ON public.stock_transfer_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.apply_stock_transfer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f uuid; tb uuid;
BEGIN
  SELECT from_branch_id, to_branch_id INTO f, tb FROM public.stock_transfers WHERE id = NEW.transfer_id;
  PERFORM public.adjust_branch_stock(NEW.product_id, f, -NEW.quantity);
  PERFORM public.adjust_branch_stock(NEW.product_id, tb, NEW.quantity);
  RETURN NEW;
END;
$$;
CREATE TRIGGER stock_transfer_items_stock AFTER INSERT ON public.stock_transfer_items
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_transfer();