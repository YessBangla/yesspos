DELETE FROM public.user_roles ur
WHERE ur.role = 'cashier'
  AND EXISTS (
    SELECT 1 FROM public.user_roles o
    WHERE o.user_id = ur.user_id AND o.role <> 'cashier'
  );