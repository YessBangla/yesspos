CREATE OR REPLACE FUNCTION public.decrement_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE b uuid; st text;
BEGIN
  SELECT branch_id, status INTO b, st FROM public.sales WHERE id = NEW.sale_id;
  IF st IS DISTINCT FROM 'final' THEN RETURN NEW; END IF;
  PERFORM public.adjust_branch_stock(NEW.product_id, b, -NEW.quantity);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_stock_on_sale_finalize()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE r record;
BEGIN
  IF NEW.status = 'final' AND OLD.status IS DISTINCT FROM 'final' THEN
    FOR r IN SELECT product_id, quantity FROM public.sale_items WHERE sale_id = NEW.id LOOP
      PERFORM public.adjust_branch_stock(r.product_id, NEW.branch_id, -r.quantity);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sales_finalize_stock ON public.sales;
CREATE TRIGGER sales_finalize_stock AFTER UPDATE OF status ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_on_sale_finalize();