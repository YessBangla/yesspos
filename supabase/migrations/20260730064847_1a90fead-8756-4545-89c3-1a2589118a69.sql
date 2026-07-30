DROP FUNCTION IF EXISTS public.track_delivery_order(bigint, text);

CREATE OR REPLACE FUNCTION public.track_delivery_order(_order_no bigint, _phone text)
 RETURNS TABLE(
   order_no bigint,
   status text,
   total numeric,
   created_at timestamp with time zone,
   updated_at timestamp with time zone,
   slot text,
   area text,
   payment_method text,
   rider_name text,
   rider_phone text,
   rider_vehicle text,
   eta_minutes integer
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.order_no, d.status, d.total, d.created_at, d.updated_at, d.slot, d.area, d.payment_method,
         r.name, r.phone, r.vehicle, z.eta_minutes
  FROM public.delivery_orders d
  LEFT JOIN public.delivery_riders r ON r.id = d.rider_id
  LEFT JOIN public.delivery_zones z ON z.id = d.zone_id
  WHERE d.order_no = _order_no AND d.customer_phone = trim(_phone)
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.track_delivery_order(bigint, text) TO anon, authenticated;