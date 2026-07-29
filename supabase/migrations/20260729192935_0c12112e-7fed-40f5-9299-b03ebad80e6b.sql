UPDATE public.brands
SET logo_url = 'https://www.google.com/s2/favicons?domain=' || regexp_replace(logo_url, '^https?://logo\.clearbit\.com/', '') || '&sz=128'
WHERE logo_url LIKE 'https://logo.clearbit.com/%';