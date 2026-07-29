CREATE OR REPLACE FUNCTION public.check_order_consistency(_lines jsonb)
RETURNS TABLE(product_id uuid, name text, issue text, detail text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l jsonb;
  p record;
  total_stock int;
  branch_count int;
  want int;
BEGIN
  FOR l IN SELECT * FROM jsonb_array_elements(COALESCE(_lines, '[]'::jsonb)) LOOP
    SELECT * INTO p FROM public.products WHERE id = NULLIF(l->>'product_id','')::uuid;
    want := GREATEST(COALESCE((l->>'quantity')::int, 0), 0);

    IF NOT FOUND THEN
      product_id := NULL;
      name := COALESCE(l->>'name', 'Unknown');
      issue := 'missing_product';
      detail := 'Product no longer exists in the catalog';
      RETURN NEXT;
      CONTINUE;
    END IF;

    product_id := p.id;
    name := p.name_en;

    IF p.is_active IS NOT TRUE THEN
      issue := 'inactive';
      detail := 'Product is currently unavailable';
      RETURN NEXT;
    END IF;

    IF (l ? 'price') AND abs(COALESCE((l->>'price')::numeric, 0) - COALESCE(p.price, 0)) > 0.009 THEN
      issue := 'price_mismatch';
      detail := format('Cart price %s, current price %s', l->>'price', p.price);
      RETURN NEXT;
    END IF;

    IF COALESCE(NULLIF(btrim(p.pack_size), ''), '') = '' THEN
      issue := 'pack_size_missing';
      detail := 'Pack size / weight is not set for this product';
      RETURN NEXT;
    ELSIF (l ? 'pack_size')
      AND NULLIF(btrim(l->>'pack_size'), '') IS NOT NULL
      AND btrim(l->>'pack_size') <> btrim(p.pack_size) THEN
      issue := 'pack_size_mismatch';
      detail := format('Selected pack %s, catalog pack %s', l->>'pack_size', p.pack_size);
      RETURN NEXT;
    END IF;

    SELECT COALESCE(sum(stock), 0), count(*) INTO total_stock, branch_count
      FROM public.product_stock WHERE product_stock.product_id = p.id;

    IF branch_count > 0 AND total_stock <> COALESCE(p.stock, 0) THEN
      issue := 'stock_desync';
      detail := format('Branch stock total %s does not match product stock %s', total_stock, p.stock);
      RETURN NEXT;
    END IF;

    IF want > GREATEST(COALESCE(p.stock, 0), total_stock) THEN
      issue := 'insufficient_stock';
      detail := format('Requested %s, available %s', want, GREATEST(COALESCE(p.stock, 0), total_stock));
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_order_consistency(jsonb) TO anon, authenticated, service_role;