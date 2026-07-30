CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  url text NOT NULL,
  name text NOT NULL,
  folder text NOT NULL DEFAULT 'general',
  tags text[] NOT NULL DEFAULT '{}',
  alt_text text,
  mime_type text,
  size_bytes bigint,
  width int,
  height int,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT SELECT ON public.media_assets TO anon;
GRANT ALL ON public.media_assets TO service_role;

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_assets_read_all" ON public.media_assets FOR SELECT USING (true);
CREATE POLICY "media_assets_insert_auth" ON public.media_assets FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "media_assets_update_auth" ON public.media_assets FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "media_assets_delete_auth" ON public.media_assets FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX media_assets_folder_idx ON public.media_assets (folder);
CREATE INDEX media_assets_created_idx ON public.media_assets (created_at DESC);

CREATE TRIGGER media_assets_updated_at BEFORE UPDATE ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "media_gallery_read" ON storage.objects FOR SELECT TO authenticated, anon USING (bucket_id = 'media-gallery');
CREATE POLICY "media_gallery_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media-gallery');
CREATE POLICY "media_gallery_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'media-gallery');
CREATE POLICY "media_gallery_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media-gallery');