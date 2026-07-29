-- Brand logos
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS logo_url text;
CREATE UNIQUE INDEX IF NOT EXISTS brands_name_en_key ON public.brands (lower(name_en));

-- Seed brands from existing product brand names
INSERT INTO public.brands (name_en, name_bn)
SELECT DISTINCT p.brand, p.brand FROM public.products p
WHERE p.brand IS NOT NULL AND p.brand <> ''
  AND NOT EXISTS (SELECT 1 FROM public.brands b WHERE lower(b.name_en) = lower(p.brand));

-- Loyalty membership fields
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS is_member boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS member_since timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_customer_phone_key
  ON public.contacts (phone) WHERE type = 'customer' AND phone IS NOT NULL AND phone <> '';

-- Loyalty point history
CREATE TABLE IF NOT EXISTS public.loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id),
  type text NOT NULL CHECK (type IN ('earn','redeem','adjust')),
  points integer NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.loyalty_ledger TO authenticated;
GRANT ALL ON public.loyalty_ledger TO service_role;
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loyalty_ledger_auth" ON public.loyalty_ledger;
CREATE POLICY "loyalty_ledger_auth" ON public.loyalty_ledger
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "loyalty_ledger_insert" ON public.loyalty_ledger;
CREATE POLICY "loyalty_ledger_insert" ON public.loyalty_ledger
  FOR INSERT TO authenticated WITH CHECK (true);

-- Register (or find) a member by phone from any branch
CREATE OR REPLACE FUNCTION public.register_member(_phone text, _name text DEFAULT NULL)
RETURNS public.contacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c public.contacts;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  _phone := trim(_phone);
  IF _phone = '' OR _phone IS NULL THEN RAISE EXCEPTION 'Phone required'; END IF;

  SELECT * INTO c FROM public.contacts
   WHERE type = 'customer' AND phone = _phone LIMIT 1;

  IF c.id IS NULL THEN
    INSERT INTO public.contacts (type, name, phone, is_member, member_since)
    VALUES ('customer', COALESCE(NULLIF(trim(_name), ''), _phone), _phone, true, now())
    RETURNING * INTO c;
  ELSIF NOT c.is_member THEN
    UPDATE public.contacts
       SET is_member = true,
           member_since = COALESCE(member_since, now()),
           name = COALESCE(NULLIF(trim(_name), ''), name)
     WHERE id = c.id
    RETURNING * INTO c;
  END IF;

  RETURN c;
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_member(text, text) TO authenticated;

-- Earn / redeem points for a sale. 1 point per 10 currency spent.
-- Redemption needs a balance of at least 1000 points; 10 points = 1 currency.
CREATE OR REPLACE FUNCTION public.apply_loyalty(
  _contact_id uuid, _sale_id uuid, _amount numeric, _redeem_points integer DEFAULT 0,
  _branch_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE bal integer; earned integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT COALESCE(loyalty_points, 0) INTO bal FROM public.contacts
    WHERE id = _contact_id AND is_member FOR UPDATE;
  IF bal IS NULL THEN RETURN 0; END IF;

  _redeem_points := GREATEST(COALESCE(_redeem_points, 0), 0);
  IF _redeem_points > 0 THEN
    IF bal < 1000 THEN RAISE EXCEPTION 'Minimum 1000 points required to redeem'; END IF;
    IF _redeem_points > bal THEN RAISE EXCEPTION 'Not enough points'; END IF;
    UPDATE public.contacts SET loyalty_points = loyalty_points - _redeem_points WHERE id = _contact_id;
    INSERT INTO public.loyalty_ledger (contact_id, sale_id, branch_id, type, points, amount)
    VALUES (_contact_id, _sale_id, _branch_id, 'redeem', -_redeem_points, _redeem_points / 10.0);
    bal := bal - _redeem_points;
  END IF;

  earned := floor(GREATEST(COALESCE(_amount, 0), 0) / 10)::int;
  IF earned > 0 THEN
    UPDATE public.contacts SET loyalty_points = loyalty_points + earned WHERE id = _contact_id;
    INSERT INTO public.loyalty_ledger (contact_id, sale_id, branch_id, type, points, amount)
    VALUES (_contact_id, _sale_id, _branch_id, 'earn', earned, _amount);
    bal := bal + earned;
  END IF;

  RETURN bal;
END;
$$;
GRANT EXECUTE ON FUNCTION public.apply_loyalty(uuid, uuid, numeric, integer, uuid) TO authenticated;