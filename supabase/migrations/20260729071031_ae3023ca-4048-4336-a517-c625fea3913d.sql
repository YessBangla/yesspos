DROP TRIGGER IF EXISTS on_sale_item_insert ON public.sale_items;
DROP TRIGGER IF EXISTS sale_items_stock_out ON public.sale_items;
DROP TRIGGER IF EXISTS purchase_items_stock_in ON public.purchase_items;
DROP TRIGGER IF EXISTS purchase_return_items_stock_out ON public.purchase_return_items;
DROP TRIGGER IF EXISTS sale_return_items_stock_in ON public.sale_return_items;
DROP TRIGGER IF EXISTS stock_adjustments_stock ON public.stock_adjustments;

UPDATE public.product_stock SET stock = 0 WHERE stock < 0;
UPDATE public.products p SET stock = COALESCE((SELECT SUM(ps.stock) FROM public.product_stock ps WHERE ps.product_id = p.id), 0);