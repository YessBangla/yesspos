CREATE TABLE public.user_carts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_carts TO authenticated;
GRANT ALL ON public.user_carts TO service_role;

ALTER TABLE public.user_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own cart"
ON public.user_carts FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_carts_updated_at
BEFORE UPDATE ON public.user_carts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();