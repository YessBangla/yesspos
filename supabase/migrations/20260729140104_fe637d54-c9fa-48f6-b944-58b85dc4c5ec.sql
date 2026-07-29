ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seq bigint;
CREATE SEQUENCE IF NOT EXISTS public.products_seq_seq OWNED BY public.products.seq;
UPDATE public.products p SET seq = s.rn FROM (SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM public.products) s WHERE p.id = s.id AND p.seq IS NULL;
SELECT setval('public.products_seq_seq', GREATEST((SELECT COALESCE(MAX(seq),0) FROM public.products), 1));
ALTER TABLE public.products ALTER COLUMN seq SET DEFAULT nextval('public.products_seq_seq');