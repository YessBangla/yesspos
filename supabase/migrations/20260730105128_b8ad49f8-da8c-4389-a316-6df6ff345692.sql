ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_usage jsonb,
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS media_assets_deleted_at_idx ON public.media_assets (deleted_at);

CREATE OR REPLACE FUNCTION public.can_manage_media(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','admin','manager')
  )
$$;

DROP POLICY IF EXISTS media_assets_insert_auth ON public.media_assets;
DROP POLICY IF EXISTS media_assets_update_auth ON public.media_assets;
DROP POLICY IF EXISTS media_assets_delete_auth ON public.media_assets;

CREATE POLICY media_assets_insert_managers ON public.media_assets
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_media(auth.uid()));

CREATE POLICY media_assets_update_managers ON public.media_assets
  FOR UPDATE TO authenticated
  USING (public.can_manage_media(auth.uid()))
  WITH CHECK (public.can_manage_media(auth.uid()));

CREATE POLICY media_assets_delete_managers ON public.media_assets
  FOR DELETE TO authenticated
  USING (public.can_manage_media(auth.uid()));

DROP POLICY IF EXISTS media_gallery_insert ON storage.objects;
DROP POLICY IF EXISTS media_gallery_update ON storage.objects;
DROP POLICY IF EXISTS media_gallery_delete ON storage.objects;

CREATE POLICY media_gallery_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media-gallery' AND public.can_manage_media(auth.uid()));

CREATE POLICY media_gallery_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media-gallery' AND public.can_manage_media(auth.uid()))
  WITH CHECK (bucket_id = 'media-gallery' AND public.can_manage_media(auth.uid()));

CREATE POLICY media_gallery_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media-gallery' AND public.can_manage_media(auth.uid()));

CREATE OR REPLACE FUNCTION public.purge_expired_media()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF NOT public.can_manage_media(auth.uid()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  WITH gone AS (
    DELETE FROM public.media_assets
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days'
    RETURNING 1
  )
  SELECT count(*) INTO n FROM gone;
  RETURN n;
END;
$$;