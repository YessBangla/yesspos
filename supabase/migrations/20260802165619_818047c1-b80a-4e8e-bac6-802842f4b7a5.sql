UPDATE public.site_content SET
  value_en = replace(value_en, 'Daily Bazar', 'Bazar Bari'),
  value_bn = replace(replace(value_bn, 'প্রতিদিনের বাজার', 'বাজার বাড়ি'), 'Daily Bazar', 'Bazar Bari')
WHERE value_en ILIKE '%Daily Bazar%' OR value_bn LIKE '%প্রতিদিনের বাজার%' OR value_bn ILIKE '%Daily Bazar%';

UPDATE public.site_content SET
  value_en = replace(value_en, 'dailybazar', 'bazarbari'),
  value_bn = replace(value_bn, 'dailybazar', 'bazarbari')
WHERE value_en ILIKE '%dailybazar%' OR value_bn ILIKE '%dailybazar%';

UPDATE public.business_settings SET
  shop_name = replace(replace(shop_name, 'Daily Bazar', 'Bazar Bari'), 'প্রতিদিনের বাজার', 'বাজার বাড়ি')
WHERE shop_name ILIKE '%Daily Bazar%' OR shop_name LIKE '%প্রতিদিনের বাজার%';