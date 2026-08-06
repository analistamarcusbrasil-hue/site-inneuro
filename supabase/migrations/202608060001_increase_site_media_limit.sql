-- Mantém o limite do Supabase Storage alinhado ao limite exibido no CMS.
update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'site-media';
