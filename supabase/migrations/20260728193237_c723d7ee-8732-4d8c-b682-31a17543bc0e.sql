DROP POLICY IF EXISTS product_stock_all_auth ON public.product_stock;
CREATE POLICY product_stock_branch_scoped ON public.product_stock
FOR ALL TO authenticated
USING (public.can_see_branch(branch_id))
WITH CHECK (public.can_see_branch(branch_id));