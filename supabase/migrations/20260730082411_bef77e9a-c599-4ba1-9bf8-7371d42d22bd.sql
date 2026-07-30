CREATE TABLE public.delivery_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'photo',
  file_path text NOT NULL,
  receiver_name text,
  note text,
  lat double precision,
  lng double precision,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_proofs TO authenticated;
GRANT ALL ON public.delivery_proofs TO service_role;
ALTER TABLE public.delivery_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage delivery proofs" ON public.delivery_proofs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_delivery_proofs_order ON public.delivery_proofs(order_id);

CREATE TABLE public.delivery_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  order_no integer,
  customer_phone text,
  kind text NOT NULL DEFAULT 'confirm',
  rating integer,
  message text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_feedback TO authenticated;
GRANT ALL ON public.delivery_feedback TO service_role;
ALTER TABLE public.delivery_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage delivery feedback" ON public.delivery_feedback FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_delivery_feedback_order ON public.delivery_feedback(order_id);

CREATE TRIGGER trg_delivery_proofs_updated BEFORE UPDATE ON public.delivery_proofs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_delivery_feedback_updated BEFORE UPDATE ON public.delivery_feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.submit_delivery_feedback(
  _order_no integer,
  _phone text,
  _kind text,
  _message text DEFAULT NULL,
  _rating integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _oid uuid;
  _fid uuid;
BEGIN
  IF _kind NOT IN ('confirm','issue') THEN
    RAISE EXCEPTION 'invalid feedback kind';
  END IF;
  SELECT id INTO _oid FROM public.delivery_orders
   WHERE order_no = _order_no
     AND regexp_replace(customer_phone, '[^0-9]', '', 'g') = regexp_replace(coalesce(_phone,''), '[^0-9]', '', 'g')
   LIMIT 1;
  IF _oid IS NULL THEN
    RAISE EXCEPTION 'order not found';
  END IF;
  INSERT INTO public.delivery_feedback(order_id, order_no, customer_phone, kind, rating, message)
  VALUES (_oid, _order_no, _phone, _kind, _rating, nullif(left(coalesce(_message,''), 1000), ''))
  RETURNING id INTO _fid;

  INSERT INTO public.delivery_order_events(order_id, event_type, to_value, note, actor_name)
  VALUES (_oid, 'customer_feedback', _kind, left(coalesce(_message,''), 500), 'Customer');

  RETURN _fid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_delivery_feedback(integer, text, text, text, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.track_delivery_proofs(_order_no integer, _phone text)
RETURNS TABLE (kind text, file_path text, receiver_name text, note text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.kind, p.file_path, p.receiver_name, p.note, p.created_at
  FROM public.delivery_proofs p
  JOIN public.delivery_orders o ON o.id = p.order_id
  WHERE o.order_no = _order_no
    AND regexp_replace(o.customer_phone, '[^0-9]', '', 'g') = regexp_replace(coalesce(_phone,''), '[^0-9]', '', 'g')
  ORDER BY p.created_at DESC
  LIMIT 20;
$$;
GRANT EXECUTE ON FUNCTION public.track_delivery_proofs(integer, text) TO anon, authenticated;

CREATE POLICY "Anon can read delivery proof files" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'delivery-proofs');
CREATE POLICY "Staff can read delivery proof files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'delivery-proofs');
CREATE POLICY "Staff can upload delivery proof files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'delivery-proofs');
CREATE POLICY "Staff can update delivery proof files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'delivery-proofs');
CREATE POLICY "Staff can delete delivery proof files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'delivery-proofs');