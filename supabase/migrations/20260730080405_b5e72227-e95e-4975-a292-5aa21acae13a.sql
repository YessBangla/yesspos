ALTER TABLE public.customer_notifications
  ADD COLUMN IF NOT EXISTS send_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS send_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

UPDATE public.customer_notifications SET send_status = 'sent' WHERE is_sent = true AND send_status = 'pending';

ALTER TABLE public.delivery_riders
  ADD COLUMN IF NOT EXISTS current_lat double precision,
  ADD COLUMN IF NOT EXISTS current_lng double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

DROP FUNCTION IF EXISTS public.track_delivery_order(bigint, text);

CREATE OR REPLACE FUNCTION public.track_delivery_order(_order_no bigint, _phone text)
 RETURNS TABLE(order_no bigint, status text, total numeric, created_at timestamptz, updated_at timestamptz, slot text, area text, payment_method text, rider_name text, rider_phone text, rider_vehicle text, eta_minutes integer, rider_lat double precision, rider_lng double precision, rider_location_at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.order_no, d.status, d.total, d.created_at, d.updated_at, d.slot, d.area, d.payment_method,
         r.name, r.phone, r.vehicle, z.eta_minutes,
         r.current_lat, r.current_lng, r.location_updated_at
  FROM public.delivery_orders d
  LEFT JOIN public.delivery_riders r ON r.id = d.rider_id
  LEFT JOIN public.delivery_zones z ON z.id = d.zone_id
  WHERE d.order_no = _order_no AND d.customer_phone = trim(_phone)
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.track_delivery_order(bigint, text) TO anon, authenticated;