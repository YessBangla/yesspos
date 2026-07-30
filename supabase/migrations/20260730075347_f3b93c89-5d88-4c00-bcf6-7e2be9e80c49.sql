CREATE TABLE public.customer_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  order_no integer,
  customer_name text,
  customer_phone text,
  channel text NOT NULL DEFAULT 'inapp',
  event_type text NOT NULL DEFAULT 'status',
  from_value text,
  to_value text,
  title text NOT NULL,
  body text NOT NULL,
  is_sent boolean NOT NULL DEFAULT false,
  is_read boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_notifications_order ON public.customer_notifications(order_id, created_at DESC);
CREATE INDEX idx_customer_notifications_phone ON public.customer_notifications(customer_phone, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.customer_notifications TO authenticated;
GRANT SELECT ON public.customer_notifications TO anon;
GRANT ALL ON public.customer_notifications TO service_role;

ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read customer notifications"
ON public.customer_notifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "Customers can read notifications by order"
ON public.customer_notifications FOR SELECT TO anon USING (true);

CREATE POLICY "Staff can add customer notifications"
ON public.customer_notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can update customer notifications"
ON public.customer_notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_customer_notifications_updated_at
BEFORE UPDATE ON public.customer_notifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.notify_delivery_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE msg text; label text; rider_name text; rider_phone text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  label := CASE NEW.status
    WHEN 'pending' THEN 'নতুন'
    WHEN 'confirmed' THEN 'কনফার্ম'
    WHEN 'packed' THEN 'প্যাক'
    WHEN 'shipped' THEN 'ডেলিভারির পথে'
    WHEN 'delivered' THEN 'ডেলিভার্ড'
    WHEN 'cancelled' THEN 'বাতিল'
    ELSE NEW.status END;

  SELECT name, phone INTO rider_name, rider_phone FROM public.delivery_riders WHERE id = NEW.rider_id;

  msg := 'সকলের বাজার: আপনার অর্ডার #' || NEW.order_no || ' এখন ' || label || '।';
  IF NEW.status = 'shipped' AND rider_name IS NOT NULL THEN
    msg := msg || ' রাইডার: ' || rider_name || ' (' || COALESCE(rider_phone, '') || ')।';
  END IF;
  IF NEW.status = 'delivered' THEN
    msg := msg || ' ধন্যবাদ, আবার আসবেন।';
  END IF;

  INSERT INTO public.customer_notifications
    (order_id, order_no, customer_name, customer_phone, channel, event_type, from_value, to_value, title, body)
  VALUES (
    NEW.id, NEW.order_no, NEW.customer_name, NEW.customer_phone,
    CASE WHEN NEW.customer_phone IS NULL OR NEW.customer_phone = '' THEN 'inapp' ELSE 'sms' END,
    'status', OLD.status, NEW.status,
    'অর্ডার #' || NEW.order_no || ' — ' || label,
    msg
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_delivery_status_change
AFTER UPDATE ON public.delivery_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_delivery_status_change();