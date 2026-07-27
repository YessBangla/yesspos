CREATE TABLE public.api_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  enabled boolean NOT NULL DEFAULT false,
  base_url text,
  api_key text,
  api_secret text,
  sender_id text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_settings TO authenticated;
GRANT ALL ON public.api_settings TO service_role;
ALTER TABLE public.api_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage api settings" ON public.api_settings
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER api_settings_updated_at
BEFORE UPDATE ON public.api_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.api_settings (provider, label, category, base_url, sender_id) VALUES
  ('sms', 'SMS Gateway', 'messaging', 'https://api.sms.net.bd/sendsms', 'SheraPOS'),
  ('email', 'Email / SMTP', 'messaging', 'smtp.gmail.com', NULL),
  ('whatsapp', 'WhatsApp Cloud API', 'messaging', 'https://graph.facebook.com/v20.0', NULL),
  ('bkash', 'bKash Checkout', 'payment', 'https://tokenized.pay.bka.sh/v1.2.0-beta', NULL),
  ('nagad', 'Nagad Payment', 'payment', 'https://api.mynagad.com', NULL),
  ('sslcommerz', 'SSLCommerz', 'payment', 'https://securepay.sslcommerz.com', NULL),
  ('barcode', 'Barcode / Label Service', 'other', NULL, NULL),
  ('maps', 'Google Maps', 'other', 'https://maps.googleapis.com', NULL),
  ('webhook', 'Outgoing Webhook', 'other', NULL, NULL);
-- end of migration
