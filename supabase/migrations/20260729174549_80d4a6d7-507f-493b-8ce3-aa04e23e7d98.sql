CREATE TABLE public.site_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  group_name text NOT NULL DEFAULT 'home',
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'text',
  value_bn text NOT NULL DEFAULT '',
  value_en text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_content_public_read" ON public.site_content
  FOR SELECT USING (true);

CREATE POLICY "site_content_admin_write" ON public.site_content
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER site_content_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.site_content;

INSERT INTO public.site_content (key, group_name, label, kind, value_bn, value_en, sort_order) VALUES
('brand.name', 'brand', 'ব্র্যান্ডের নাম / Brand name', 'text', 'সকলের বাজার', 'Sokoler Bazar', 1),
('brand.tagline', 'brand', 'ট্যাগলাইন / Tagline', 'text', 'সবার জন্য সহজ পয়েন্ট অব সেল ও হোম ডেলিভারি', 'Easy point of sale and home delivery for everyone', 2),
('brand.support_phone', 'brand', 'সাপোর্ট ফোন / Support phone', 'text', '০৯৬১০-০০০০০০', '09610-000000', 3),
('brand.support_email', 'brand', 'সাপোর্ট ইমেইল / Support email', 'text', 'support@sokolerbazar.com', 'support@sokolerbazar.com', 4),
('home.hero_badge', 'home', 'হোম: ব্যাজ / Hero badge', 'text', 'বাংলাদেশের চেইন সুপারশপের জন্য', 'Built for Bangladeshi retail chains', 1),
('home.hero_title', 'home', 'হোম: প্রধান শিরোনাম / Hero title', 'text', 'দোকান চালান সহজে, বিক্রি বাড়ান দ্রুত', 'Run your shop easily, sell faster', 2),
('home.hero_subtitle', 'home', 'হোম: উপ-শিরোনাম / Hero subtitle', 'textarea', 'বিলিং, স্টক, হিসাব, হোম ডেলিভারি — সবকিছু একটি সহজ সিস্টেমে। মোবাইল, ট্যাব বা কম্পিউটার, যেকোনো ডিভাইসে চলবে।', 'Billing, stock, accounts and home delivery in one simple system that works on any device.', 3),
('home.cta_primary', 'home', 'হোম: প্রথম বাটন / Primary button', 'text', 'হোম ডেলিভারি অর্ডার দিন', 'Order home delivery', 4),
('home.cta_secondary', 'home', 'হোম: দ্বিতীয় বাটন / Secondary button', 'text', 'সিস্টেমে প্রবেশ করুন', 'Sign in to the system', 5),
('shop.hero_title', 'shop', 'ডেলিভারি: শিরোনাম / Storefront title', 'text', 'ঘরে বসেই বাজার', 'Groceries at your door', 1),
('shop.hero_subtitle', 'shop', 'ডেলিভারি: উপ-শিরোনাম / Storefront subtitle', 'textarea', 'তাজা পণ্য, সঠিক দাম, দ্রুত ডেলিভারি।', 'Fresh products, fair prices, fast delivery.', 2),
('shop.free_delivery_note', 'shop', 'ডেলিভারি: ফ্রি ডেলিভারি বার্তা', 'text', 'নির্দিষ্ট অর্ডারের উপরে ডেলিভারি ফ্রি', 'Free delivery above the minimum order', 3),
('footer.about', 'footer', 'ফুটার: পরিচিতি / Footer about', 'textarea', 'সকলের বাজার — ছোট দোকান থেকে চেইন সুপারশপ পর্যন্ত সবার জন্য তৈরি।', 'Sokoler Bazar — made for everyone from corner shops to supermarket chains.', 1),
('footer.copyright', 'footer', 'ফুটার: কপিরাইট / Footer copyright', 'text', '© সকলের বাজার। সর্বস্বত্ব সংরক্ষিত।', '© Sokoler Bazar. All rights reserved.', 2);