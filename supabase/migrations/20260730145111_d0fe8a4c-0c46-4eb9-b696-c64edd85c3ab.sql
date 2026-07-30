ALTER TABLE public.delivery_orders ADD COLUMN IF NOT EXISTS coupon_code text;

CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _subtotal numeric)
RETURNS TABLE(code text, kind text, value numeric, discount numeric, reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c public.coupons%ROWTYPE; d numeric := 0;
BEGIN
  SELECT * INTO c FROM public.coupons WHERE upper(public.coupons.code) = upper(btrim(_code)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::numeric, 0::numeric, 'not_found'::text; RETURN;
  END IF;
  IF NOT c.is_active THEN
    RETURN QUERY SELECT c.code, c.type, c.value, 0::numeric, 'inactive'::text; RETURN;
  END IF;
  IF c.expires_on IS NOT NULL AND c.expires_on < CURRENT_DATE THEN
    RETURN QUERY SELECT c.code, c.type, c.value, 0::numeric, 'expired'::text; RETURN;
  END IF;
  IF COALESCE(_subtotal, 0) < COALESCE(c.min_amount, 0) THEN
    RETURN QUERY SELECT c.code, c.type, c.value, 0::numeric, 'min_amount'::text; RETURN;
  END IF;
  d := CASE WHEN c.type = 'percent' THEN COALESCE(_subtotal,0) * c.value / 100 ELSE c.value END;
  IF c.max_discount IS NOT NULL THEN d := least(d, c.max_discount); END IF;
  d := least(round(d, 2), COALESCE(_subtotal, 0));
  RETURN QUERY SELECT c.code, c.type, c.value, d, 'ok'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text, numeric) TO anon, authenticated;

DROP POLICY IF EXISTS "staff read order items" ON public.delivery_order_items;
CREATE POLICY "read own or branch order items" ON public.delivery_order_items
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.delivery_orders o
  WHERE o.id = delivery_order_items.order_id
    AND (o.user_id = auth.uid() OR public.can_see_branch(o.branch_id))
));