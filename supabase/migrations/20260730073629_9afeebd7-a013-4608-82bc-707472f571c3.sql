CREATE TABLE public.delivery_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'status',
  from_value text,
  to_value text,
  actor_id uuid,
  actor_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_order_events_order ON public.delivery_order_events(order_id, created_at);

GRANT SELECT, INSERT ON public.delivery_order_events TO authenticated;
GRANT SELECT ON public.delivery_order_events TO anon;
GRANT ALL ON public.delivery_order_events TO service_role;

ALTER TABLE public.delivery_order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read delivery order events"
ON public.delivery_order_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can add delivery order events"
ON public.delivery_order_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_delivery_order_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uname text; uid uuid;
BEGIN
  uid := auth.uid();
  SELECT COALESCE(username, full_name) INTO uname FROM public.profiles WHERE id = uid;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.delivery_order_events (order_id, event_type, from_value, to_value, actor_id, actor_name)
    VALUES (NEW.id, 'created', NULL, NEW.status, uid, COALESCE(uname, 'customer'));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.delivery_order_events (order_id, event_type, from_value, to_value, actor_id, actor_name)
    VALUES (NEW.id, 'status', OLD.status, NEW.status, uid, COALESCE(uname, 'system'));
  END IF;

  IF NEW.rider_id IS DISTINCT FROM OLD.rider_id THEN
    INSERT INTO public.delivery_order_events (order_id, event_type, from_value, to_value, actor_id, actor_name)
    VALUES (
      NEW.id, 'rider',
      (SELECT name FROM public.delivery_riders WHERE id = OLD.rider_id),
      (SELECT name FROM public.delivery_riders WHERE id = NEW.rider_id),
      uid, COALESCE(uname, 'system'));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_delivery_order_event_insert
AFTER INSERT ON public.delivery_orders
FOR EACH ROW EXECUTE FUNCTION public.log_delivery_order_event();

CREATE TRIGGER trg_delivery_order_event_update
AFTER UPDATE ON public.delivery_orders
FOR EACH ROW EXECUTE FUNCTION public.log_delivery_order_event();

-- backfill a "created" event for existing orders so timelines are never empty
INSERT INTO public.delivery_order_events (order_id, event_type, to_value, actor_name, created_at)
SELECT id, 'created', status, 'customer', created_at FROM public.delivery_orders;