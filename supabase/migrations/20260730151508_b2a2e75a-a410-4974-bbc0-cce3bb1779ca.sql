-- 1) Coupon management fields ------------------------------------------------
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS usage_limit integer,
  ADD COLUMN IF NOT EXISTS used_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note text;

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
  IF c.starts_on IS NOT NULL AND c.starts_on > CURRENT_DATE THEN
    RETURN QUERY SELECT c.code, c.type, c.value, 0::numeric, 'not_started'::text; RETURN;
  END IF;
  IF c.expires_on IS NOT NULL AND c.expires_on < CURRENT_DATE THEN
    RETURN QUERY SELECT c.code, c.type, c.value, 0::numeric, 'expired'::text; RETURN;
  END IF;
  IF c.usage_limit IS NOT NULL AND COALESCE(c.used_count,0) >= c.usage_limit THEN
    RETURN QUERY SELECT c.code, c.type, c.value, 0::numeric, 'limit_reached'::text; RETURN;
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

CREATE OR REPLACE FUNCTION public.bump_coupon_usage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.coupon_code IS NOT NULL AND btrim(NEW.coupon_code) <> '' THEN
    UPDATE public.coupons SET used_count = COALESCE(used_count,0) + 1
    WHERE upper(code) = upper(btrim(NEW.coupon_code));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_bump_coupon_usage ON public.delivery_orders;
CREATE TRIGGER trg_bump_coupon_usage AFTER INSERT ON public.delivery_orders
FOR EACH ROW EXECUTE FUNCTION public.bump_coupon_usage();

-- 2) Delivery slot capacity ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_slot_capacity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id text NOT NULL UNIQUE,
  capacity integer NOT NULL DEFAULT 25,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_slot_capacity TO authenticated;
GRANT SELECT ON public.delivery_slot_capacity TO anon;
GRANT ALL ON public.delivery_slot_capacity TO service_role;
ALTER TABLE public.delivery_slot_capacity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "slot capacity readable" ON public.delivery_slot_capacity;
CREATE POLICY "slot capacity readable" ON public.delivery_slot_capacity FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "staff manage slot capacity" ON public.delivery_slot_capacity;
CREATE POLICY "staff manage slot capacity" ON public.delivery_slot_capacity FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.delivery_slot_capacity (slot_id, capacity) VALUES
  ('08:00-11:00', 25), ('11:00-14:00', 30), ('14:00-17:00', 30), ('17:00-20:00', 25)
ON CONFLICT (slot_id) DO NOTHING;

ALTER TABLE public.delivery_orders
  ADD COLUMN IF NOT EXISTS slot_date date,
  ADD COLUMN IF NOT EXISTS slot_id text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS reschedule_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_delivery_orders_slot ON public.delivery_orders (slot_date, slot_id);

CREATE OR REPLACE FUNCTION public.slot_availability(_day date)
RETURNS TABLE(slot_id text, capacity integer, booked integer, available integer, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.slot_id,
         s.capacity,
         COALESCE(b.cnt, 0)::int AS booked,
         GREATEST(s.capacity - COALESCE(b.cnt, 0), 0)::int AS available,
         s.is_active
  FROM public.delivery_slot_capacity s
  LEFT JOIN (
    SELECT d.slot_id AS sid, count(*)::int AS cnt
    FROM public.delivery_orders d
    WHERE d.slot_date = _day AND d.status <> 'cancelled'
    GROUP BY d.slot_id
  ) b ON b.sid = s.slot_id
  ORDER BY s.slot_id;
$$;
GRANT EXECUTE ON FUNCTION public.slot_availability(date) TO anon, authenticated;

-- 3) Customer self-service: cancel & reschedule -------------------------------
CREATE OR REPLACE FUNCTION public.customer_cancel_order(_order_id uuid, _phone text, _reason text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.delivery_orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.delivery_orders WHERE id = _order_id LIMIT 1;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF NOT (o.user_id = auth.uid() OR o.customer_phone = btrim(_phone)) THEN RETURN 'forbidden'; END IF;
  IF o.status IN ('delivered','cancelled') THEN RETURN 'too_late'; END IF;
  IF o.status = 'shipped' THEN RETURN 'on_the_way'; END IF;

  UPDATE public.delivery_orders
     SET status = 'cancelled', cancelled_at = now(),
         cancel_reason = NULLIF(btrim(COALESCE(_reason,'')), '')
   WHERE id = _order_id;

  INSERT INTO public.customer_notifications
    (order_id, order_no, customer_name, customer_phone, channel, event_type, from_value, to_value, title, body)
  VALUES (o.id, o.order_no, o.customer_name, o.customer_phone, 'sms', 'status', o.status, 'cancelled',
          'Order cancelled',
          'Order #' || o.order_no || ' has been cancelled by the customer.');
  RETURN 'ok';
END;
$$;
GRANT EXECUTE ON FUNCTION public.customer_cancel_order(uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.customer_reschedule_order(
  _order_id uuid, _phone text, _slot_date date, _slot_id text, _slot_label text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.delivery_orders%ROWTYPE; cap record;
BEGIN
  SELECT * INTO o FROM public.delivery_orders WHERE id = _order_id LIMIT 1;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF NOT (o.user_id = auth.uid() OR o.customer_phone = btrim(_phone)) THEN RETURN 'forbidden'; END IF;
  IF o.status IN ('delivered','cancelled','shipped') THEN RETURN 'too_late'; END IF;
  IF _slot_date < CURRENT_DATE THEN RETURN 'past'; END IF;

  SELECT * INTO cap FROM public.slot_availability(_slot_date) sa WHERE sa.slot_id = _slot_id;
  IF NOT FOUND OR NOT cap.is_active THEN RETURN 'closed'; END IF;
  IF cap.available <= 0 THEN RETURN 'full'; END IF;

  UPDATE public.delivery_orders
     SET slot_date = _slot_date, slot_id = _slot_id, slot = _slot_label,
         rescheduled_at = now(), reschedule_count = COALESCE(reschedule_count,0) + 1
   WHERE id = _order_id;

  INSERT INTO public.customer_notifications
    (order_id, order_no, customer_name, customer_phone, channel, event_type, from_value, to_value, title, body)
  VALUES (o.id, o.order_no, o.customer_name, o.customer_phone, 'sms', 'slot', o.slot, _slot_label,
          'Delivery rescheduled',
          'Order #' || o.order_no || ' is rescheduled to ' || _slot_label || '.');
  RETURN 'ok';
END;
$$;
GRANT EXECUTE ON FUNCTION public.customer_reschedule_order(uuid, text, date, text, text) TO anon, authenticated;