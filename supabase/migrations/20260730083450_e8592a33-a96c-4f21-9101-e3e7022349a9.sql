-- 1. Proof columns
ALTER TABLE public.delivery_proofs
  ADD COLUMN IF NOT EXISTS captured_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.delivery_proofs DROP CONSTRAINT IF EXISTS delivery_proofs_status_chk;
ALTER TABLE public.delivery_proofs ADD CONSTRAINT delivery_proofs_status_chk
  CHECK (status IN ('pending','approved','rejected'));

ALTER TABLE public.delivery_proofs DROP CONSTRAINT IF EXISTS delivery_proofs_reject_reason_chk;
ALTER TABLE public.delivery_proofs ADD CONSTRAINT delivery_proofs_reject_reason_chk
  CHECK (status <> 'rejected' OR (reject_reason IS NOT NULL AND length(btrim(reject_reason)) >= 3));

-- 2. Auto-deliver on proof insert + timeline event
CREATE OR REPLACE FUNCTION public.on_delivery_proof_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_status text;
  actor text;
BEGIN
  SELECT status INTO old_status FROM public.delivery_orders WHERE id = NEW.order_id;
  SELECT COALESCE(full_name, username) INTO actor FROM public.profiles WHERE id = NEW.created_by;

  INSERT INTO public.delivery_order_events (order_id, event_type, from_value, to_value, note, actor_id, actor_name)
  VALUES (NEW.order_id, 'proof', NULL, NEW.kind,
          COALESCE(NEW.receiver_name, '') || CASE WHEN NEW.lat IS NOT NULL THEN ' @ ' || NEW.lat || ',' || NEW.lng ELSE '' END,
          NEW.created_by, actor);

  IF old_status IS DISTINCT FROM 'delivered' AND old_status <> 'cancelled' THEN
    UPDATE public.delivery_orders SET status = 'delivered', updated_at = now() WHERE id = NEW.order_id;
    INSERT INTO public.delivery_order_events (order_id, event_type, from_value, to_value, note, actor_id, actor_name)
    VALUES (NEW.order_id, 'status', old_status, 'delivered', 'auto: proof of delivery', NEW.created_by, actor);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_proof_insert ON public.delivery_proofs;
CREATE TRIGGER trg_delivery_proof_insert
AFTER INSERT ON public.delivery_proofs
FOR EACH ROW EXECUTE FUNCTION public.on_delivery_proof_insert();

-- 3. Verification event
CREATE OR REPLACE FUNCTION public.on_delivery_proof_verify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE actor text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT COALESCE(full_name, username) INTO actor FROM public.profiles WHERE id = auth.uid();
    NEW.verified_by := auth.uid();
    NEW.verified_at := now();
    INSERT INTO public.delivery_order_events (order_id, event_type, from_value, to_value, note, actor_id, actor_name)
    VALUES (NEW.order_id, 'proof_verify', OLD.status, NEW.status, NEW.reject_reason, auth.uid(), actor);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_proof_verify ON public.delivery_proofs;
CREATE TRIGGER trg_delivery_proof_verify
BEFORE UPDATE ON public.delivery_proofs
FOR EACH ROW EXECUTE FUNCTION public.on_delivery_proof_verify();

-- 4. Public tracking view of proofs (hide rejected)
DROP FUNCTION IF EXISTS public.track_delivery_proofs(integer, text);
DROP FUNCTION IF EXISTS public.track_delivery_proofs(bigint, text);
CREATE OR REPLACE FUNCTION public.track_delivery_proofs(_order_no integer, _phone text)
RETURNS TABLE (
  kind text, file_path text, receiver_name text, note text,
  created_at timestamptz, captured_at timestamptz,
  lat numeric, lng numeric, accuracy_m numeric, status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.kind, p.file_path, p.receiver_name, p.note, p.created_at, p.captured_at,
         p.lat, p.lng, p.accuracy_m, p.status
  FROM public.delivery_proofs p
  JOIN public.delivery_orders o ON o.id = p.order_id
  WHERE o.order_no = _order_no
    AND regexp_replace(o.customer_phone, '\D', '', 'g') = regexp_replace(_phone, '\D', '', 'g')
    AND p.status <> 'rejected'
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.track_delivery_proofs(integer, text) TO anon, authenticated;

-- 5. Feedback SLA
ALTER TABLE public.delivery_feedback
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_feedback_sla()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.due_at IS NULL THEN
      NEW.due_at := now() + CASE WHEN NEW.kind = 'issue' THEN interval '2 hours' ELSE interval '24 hours' END;
    END IF;
    IF NEW.kind = 'issue' THEN NEW.severity := 'high'; END IF;
  ELSIF NEW.resolved AND NOT OLD.resolved THEN
    NEW.resolved_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_sla ON public.delivery_feedback;
CREATE TRIGGER trg_feedback_sla
BEFORE INSERT OR UPDATE ON public.delivery_feedback
FOR EACH ROW EXECUTE FUNCTION public.set_feedback_sla();

UPDATE public.delivery_feedback
SET due_at = created_at + CASE WHEN kind = 'issue' THEN interval '2 hours' ELSE interval '24 hours' END
WHERE due_at IS NULL;

-- 6. Escalate overdue feedback and queue notifications
CREATE OR REPLACE FUNCTION public.escalate_overdue_feedback()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.delivery_feedback
    WHERE resolved = false AND escalated = false AND due_at IS NOT NULL AND due_at < now()
  LOOP
    UPDATE public.delivery_feedback
      SET escalated = true, escalated_at = now(), severity = 'critical'
      WHERE id = r.id;

    INSERT INTO public.customer_notifications
      (order_id, order_no, customer_phone, event_type, title, body, channel, from_value, to_value)
    VALUES (
      r.order_id, r.order_no, r.customer_phone, 'feedback_sla',
      'SLA অতিক্রম: গ্রাহক ফিডব্যাক',
      'অর্ডার #' || COALESCE(r.order_no::text, '-') || ' এর ' ||
        CASE WHEN r.kind = 'issue' THEN 'সমস্যা রিপোর্ট' ELSE 'ফিডব্যাক' END ||
        ' নির্ধারিত সময়ে সমাধান হয়নি। দ্রুত ব্যবস্থা নিন।',
      'sms', 'pending', 'escalated'
    );
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.escalate_overdue_feedback() TO authenticated;

-- 7. Restrict verification to admins/managers
DROP POLICY IF EXISTS "Managers verify proofs" ON public.delivery_proofs;
CREATE POLICY "Managers verify proofs" ON public.delivery_proofs
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'));