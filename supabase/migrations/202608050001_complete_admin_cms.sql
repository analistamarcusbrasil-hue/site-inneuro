begin;

-- Completa os módulos administráveis sem remover os registros existentes.
alter table public.carousel_slides
  add column if not exists image_url text,
  add column if not exists linked_news_id uuid references public.news_posts(id) on delete set null,
  add column if not exists open_in_new_tab boolean not null default false;

alter table public.carousel_slides alter column created_by drop not null;
alter table public.carousel_slides alter column updated_by drop not null;

alter table public.news_posts
  add column if not exists author text;

alter table public.health_partners
  add column if not exists logo_url text,
  add column if not exists logo_alt text,
  add column if not exists notes text,
  add column if not exists restrictions text;

alter table public.health_partners alter column created_by drop not null;
alter table public.health_partners alter column updated_by drop not null;

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  modality text not null,
  modality_slug text not null,
  short_description text not null,
  preparation_slug text,
  purpose text,
  how_performed text,
  general_guidance text,
  documents text,
  icon text not null default 'brain-mapping',
  cover_media_id uuid references public.media_assets(id) on delete set null,
  featured boolean not null default false,
  active boolean not null default false,
  sort_order integer not null default 0,
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preparations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  exam_slug text references public.exams(slug) on update cascade on delete set null,
  search_terms text[] not null default '{}',
  attendance_mode text not null default 'appointment' check (attendance_mode in ('walk-in', 'appointment', 'mixed')),
  attendance_label text not null,
  schedules jsonb not null default '[]'::jsonb check (jsonb_typeof(schedules) = 'array'),
  preparation_groups jsonb not null default '[]'::jsonb check (jsonb_typeof(preparation_groups) = 'array'),
  documents text[] not null default '{}',
  safety_questions text[] not null default '{}',
  previous_exams_recommended boolean not null default false,
  validated_by_clinic boolean not null default false,
  last_reviewed_at date not null default current_date,
  active boolean not null default false,
  sort_order integer not null default 0,
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exams_public_idx
  on public.exams (status, active, sort_order) where deleted_at is null;
create index if not exists preparations_public_idx
  on public.preparations (status, active, sort_order) where deleted_at is null;
create index if not exists carousel_linked_news_idx
  on public.carousel_slides (linked_news_id) where deleted_at is null;
create unique index if not exists carousel_linked_news_unique_idx
  on public.carousel_slides (linked_news_id)
  where linked_news_id is not null and deleted_at is null;

drop trigger if exists exams_updated_at on public.exams;
create trigger exams_updated_at before update on public.exams
for each row execute procedure public.set_updated_at();
drop trigger if exists preparations_updated_at on public.preparations;
create trigger preparations_updated_at before update on public.preparations
for each row execute procedure public.set_updated_at();

alter table public.exams enable row level security;
alter table public.preparations enable row level security;

drop policy if exists "public reads exams" on public.exams;
create policy "public reads exams" on public.exams for select to anon, authenticated
using ((status = 'published' or (status = 'scheduled' and publish_at <= now())) and active and deleted_at is null and (publish_at is null or publish_at <= now()));
drop policy if exists "staff reads all exams" on public.exams;
create policy "staff reads all exams" on public.exams for select to authenticated using (public.is_staff());
drop policy if exists "staff creates exams" on public.exams;
create policy "staff creates exams" on public.exams for insert to authenticated
with check (public.is_staff() and created_by = auth.uid() and updated_by = auth.uid());
drop policy if exists "staff updates exams" on public.exams;
create policy "staff updates exams" on public.exams for update to authenticated
using (public.is_staff()) with check (public.is_staff() and updated_by = auth.uid());
drop policy if exists "super admin deletes exams" on public.exams;
create policy "super admin deletes exams" on public.exams for delete to authenticated
using (public.current_app_role() = 'super_admin');

drop policy if exists "public reads preparations" on public.preparations;
create policy "public reads preparations" on public.preparations for select to anon, authenticated
using ((status = 'published' or (status = 'scheduled' and publish_at <= now())) and active and deleted_at is null and (publish_at is null or publish_at <= now()));
drop policy if exists "staff reads all preparations" on public.preparations;
create policy "staff reads all preparations" on public.preparations for select to authenticated using (public.is_staff());
drop policy if exists "staff creates preparations" on public.preparations;
create policy "staff creates preparations" on public.preparations for insert to authenticated
with check (public.is_staff() and created_by = auth.uid() and updated_by = auth.uid());
drop policy if exists "staff updates preparations" on public.preparations;
create policy "staff updates preparations" on public.preparations for update to authenticated
using (public.is_staff()) with check (public.is_staff() and updated_by = auth.uid());
drop policy if exists "super admin deletes preparations" on public.preparations;
create policy "super admin deletes preparations" on public.preparations for delete to authenticated
using (public.current_app_role() = 'super_admin');

grant select on public.exams, public.preparations to anon;
grant select, insert, update, delete on public.exams, public.preparations to authenticated;

-- Importa o carrossel aprovado que antes existia somente no código.
insert into public.carousel_slides
  (title, description, category, image_url, image_alt, cta_label, cta_url, status, active, sort_order)
select seed.title, seed.description, seed.category, seed.image_url, seed.image_alt, seed.cta_label, seed.cta_url,
  'published'::public.content_status, true, seed.sort_order
from (values
  ('Conheça a INNEURO', 'Tecnologia, cuidado e acolhimento em cada etapa do seu atendimento.', 'Institucional', '/images/inneuro/fachada-inneuro.webp', 'Fachada da INNEURO — Instituto de Neurologia do Amapá, em Macapá.', 'Conhecer a INNEURO', '/sobre', 0),
  ('Ressonância Magnética', 'Imagens detalhadas para auxiliar seu médico com precisão e segurança.', 'Exames', '/images/carrossel/ressonancia-magnetica.webp', 'Imagem ilustrativa de equipamento de ressonância magnética', 'Conhecer o exame', '/exames/ressonancia-magnetica', 1),
  ('Tomografia Computadorizada', 'Tecnologia e agilidade com atendimento cuidadoso em cada etapa.', 'Exames', '/images/carrossel/tomografia-computadorizada.webp', 'Imagem ilustrativa de equipamento de tomografia computadorizada', 'Ver informações', '/exames/tomografia-computadorizada', 2),
  ('Raios X', 'Atendimento prático para diferentes necessidades de diagnóstico por imagem.', 'Exames', '/images/carrossel/raios-x.webp', 'Imagem ilustrativa de sala e equipamento de Raios X', 'Saiba mais', '/exames/raios-x', 3)
) as seed(title, description, category, image_url, image_alt, cta_label, cta_url, sort_order)
where not exists (select 1 from public.carousel_slides where deleted_at is null);

-- Importa os convênios aprovados que antes existiam somente no código.
insert into public.health_partners
  (name, slug, website_url, logo_url, logo_alt, kind, status, active, sort_order)
select seed.name, seed.slug, seed.website_url, seed.logo_url, 'Logo ' || seed.name,
  seed.kind::public.partner_kind, 'published'::public.content_status, seed.active, seed.sort_order
from (values
  ('SulAmérica', 'sulamerica', 'https://www.sulamerica.com.br/', '/brands/convenios/sulamerica.png', 'convenio', true, 0),
  ('GEAP Saúde', 'geap-saude', 'https://www.geap.org.br/', '/brands/convenios/geap-saude.svg', 'convenio', true, 1),
  ('Unimed', 'unimed', 'https://www.unimed.coop.br/', '/brands/convenios/unimed.png', 'convenio', true, 2),
  ('Amil', 'amil', 'https://www.amil.com.br/', '/brands/convenios/amil.png', 'convenio', true, 3),
  ('ASSEFAZ', 'assefaz', 'https://www.assefaz.org.br/', '/brands/convenios/assefaz.svg', 'convenio', true, 4),
  ('Bradesco Saúde', 'bradesco-saude', 'https://www.bradescoseguros.com.br/clientes/produtos/plano-saude', '/brands/convenios/bradesco-saude.png', 'convenio', true, 5),
  ('CAPSAÚDE', 'capsaude', null, null, 'convenio', false, 6),
  ('CAPE Saúde — CAPESESP', 'cape-saude-capesesp', null, '/brands/convenios/cape-saude-capesesp.png', 'convenio', true, 7),
  ('AmorSaúde', 'amorsaude', 'https://www.amorsaude.com.br/', '/brands/convenios/amorsaude.svg', 'parceria', true, 8)
) as seed(name, slug, website_url, logo_url, kind, active, sort_order)
where not exists (select 1 from public.health_partners where deleted_at is null);

-- Exames atuais: a migração preserva o conteúdo público aprovado.
insert into public.exams
  (slug, name, modality, modality_slug, short_description, preparation_slug, icon, featured, active, sort_order, status)
select seed.slug, seed.name, seed.name, seed.slug, seed.description, seed.preparation_slug, seed.icon,
  seed.featured, true, seed.sort_order, 'published'::public.content_status
from (values
  ('ressonancia-magnetica', 'Ressonância Magnética', 'Modalidade de diagnóstico por imagem realizada conforme indicação e solicitação médica.', 'ressonancia-magnetica', 'magnetic-resonance', true, 0),
  ('tomografia-computadorizada', 'Tomografia Computadorizada', 'Exame de imagem realizado para diferentes regiões do corpo, conforme solicitação médica.', 'tomografia-computadorizada', 'computed-tomography', true, 1),
  ('raios-x', 'Raios X', 'Exames radiográficos para diferentes regiões, realizados de acordo com a solicitação médica.', 'raios-x', 'x-ray', true, 2),
  ('medicina-nuclear', 'Medicina Nuclear', 'Área dedicada a procedimentos de medicina nuclear indicados pelo médico responsável.', 'medicina-nuclear', 'nuclear-medicine', false, 3),
  ('cintilografia', 'Cintilografia', 'Exames realizados conforme indicação médica e orientações específicas para cada procedimento.', 'cintilografia', 'scintigraphy', false, 4),
  ('mapeamento-cerebral', 'Mapeamento Cerebral', 'Exame para registro da atividade elétrica cerebral, realizado conforme solicitação médica.', 'mapeamento-cerebral', 'brain-mapping', true, 5)
) as seed(slug, name, description, preparation_slug, icon, featured, sort_order)
where not exists (select 1 from public.exams where deleted_at is null);

-- Preparos e horários atuais, preservados exatamente como estavam no site.
insert into public.preparations
  (slug, name, exam_slug, search_terms, attendance_mode, attendance_label, schedules,
   preparation_groups, documents, safety_questions, previous_exams_recommended,
   validated_by_clinic, last_reviewed_at, active, sort_order, status)
values
  (
    'tomografia-computadorizada', 'Tomografia Computadorizada', 'tomografia-computadorizada',
    array['tomografia','contraste','abdome'], 'walk-in', 'Ordem de chegada',
    '[{"label":"Sem contraste","days":"Segunda a sexta-feira","periods":[{"start":"07h","end":"23h"}]},{"label":"Sem contraste","days":"Sábado","periods":[{"start":"08h","end":"22h"}]},{"label":"Com contraste","days":"Segunda a sexta-feira","periods":[{"start":"08h","end":"12h"},{"start":"13h","end":"18h"}]}]'::jsonb,
    '[{"title":"Exames com contraste ou de abdome","appliesTo":["Tomografia com contraste","Tomografia de abdome"],"instructions":["Jejum de 4 horas.","Usar roupas leves.","Não usar roupas ou acessórios com metais.","Pacientes com 60 anos ou mais devem comparecer acompanhados.","Pacientes com 60 anos ou mais devem trazer exames recentes de ureia e creatinina."],"warning":"Em caso de dúvida sobre contraste ou preparo, confirme com a equipe da INNEURO."}]'::jsonb,
    '{}', '{}', false, true, '2026-07-21', true, 0, 'published'
  ),
  (
    'raios-x', 'Raios X', 'raios-x',
    array['raios x','bacia','coluna lombar','quadril'], 'walk-in', 'Ordem de chegada',
    '[{"label":"Atendimento","days":"Segunda a sexta-feira","periods":[{"start":"08h","end":"12h"},{"start":"13h","end":"23h"}]},{"label":"Atendimento","days":"Sábado","periods":[{"start":"08h","end":"22h"}]}]'::jsonb,
    '[{"title":"Preparo informado pela INNEURO para esses exames específicos","appliesTo":["Raios X de bacia","Raios X de coluna lombar","Raios X de quadril"],"instructions":["Jejum de 4 horas.","No dia anterior, a partir das 07h, tomar 20 gotas de Luftal a cada 6 horas.","Fazer jantar leve até às 20h.","Após o jantar, tomar 2 comprimidos de Lactopurga ou Ducolax.","Trazer exames anteriores, caso possua.","Comparecer com roupas leves.","Não usar metais, joias ou piercing."],"warning":"Em caso de contraindicação, dúvida, gestação ou uso contínuo de medicamentos, confirme com a equipe da INNEURO."}]'::jsonb,
    '{}', '{}', true, true, '2026-07-21', true, 1, 'published'
  ),
  (
    'mapeamento-cerebral', 'Mapeamento Cerebral', 'mapeamento-cerebral',
    array['mapeamento cerebral','cabelo','menores de 6 anos','sono'], 'appointment', 'Consulte a equipe',
    '[{"label":"Atendimento","days":"Segunda a sexta-feira","periods":[{"start":"08h","end":"11h30"},{"start":"13h","end":"18h30"}]},{"label":"Atendimento","days":"Sábado","periods":[{"start":"08h","end":"11h30"}]}]'::jsonb,
    '[{"title":"Preparo","appliesTo":["Mapeamento Cerebral"],"instructions":["Lavar o cabelo com sabão neutro no dia anterior.","Não usar creme.","Não usar gel.","Não usar óleo.","Não utilizar outros produtos no cabelo.","Comparecer com o cabelo seco."]},{"title":"Menores de 6 anos","appliesTo":["Somente menores de 6 anos"],"instructions":["No dia anterior, dormir por volta de 00h.","Acordar até 03h.","A orientação tem como objetivo que a criança consiga dormir novamente durante o exame na clínica.","Trazer toalha de rosto."],"warning":"Em caso de dúvida, confirme as orientações com a equipe da INNEURO."}]'::jsonb,
    array['Carteira do convênio.','RG.','Pedido médico original.'], '{}', false, true, '2026-07-21', true, 2, 'published'
  ),
  (
    'ressonancia-magnetica', 'Ressonância Magnética', 'ressonancia-magnetica',
    array['ressonância magnética','contraste','metais','claustrofobia'], 'appointment', 'Necessita agendamento',
    '[{"label":"Atendimento","days":"Segunda a sexta-feira","periods":[{"start":"07h","end":"23h"}]},{"label":"Atendimento","days":"Sábado","periods":[{"start":"07h","end":"22h"}]},{"label":"Atendimento","days":"Domingo","periods":[{"start":"07h","end":"19h"}]}]'::jsonb,
    '[{"title":"Exames com contraste","appliesTo":["Ressonância Magnética com contraste"],"instructions":["Jejum de 2 horas.","Comparecer com roupas leves.","Não usar roupas ou acessórios com metais.","Não usar joias.","Não usar piercing.","Pacientes com 60 anos ou mais devem comparecer acompanhados.","Pacientes com 60 anos ou mais devem trazer ureia e creatinina recentes."]}]'::jsonb,
    '{}', array['use aparelho ortodôntico;','possua clipes metálicos;','use marca-passo;','use cílios metálicos;','possua próteses ou metais no corpo;','tenha claustrofobia.'],
    false, true, '2026-07-21', true, 3, 'published'
  )
on conflict (slug) do nothing;

-- Fonte única para telefones, endereço, links e textos institucionais.
insert into public.site_settings (key, value, category, is_public)
values (
  'institutional',
  '{"full_name":"Instituto de Neurologia do Amapá","description":"Diagnóstico por imagem, neurologia e medicina nuclear com tecnologia, precisão e cuidado.","phone":"","email":"","opening_hours":"","whatsapp_primary_label":"WhatsApp principal","whatsapp_primary_display":"(96) 98112-2434","whatsapp_primary_number":"5596981122434","whatsapp_secondary_label":"WhatsApp alternativo","whatsapp_secondary_display":"(96) 99113-4201","whatsapp_secondary_number":"5596991134201","instagram_url":"https://www.instagram.com/inneuroap/","instagram_handle":"@inneuroap","address_street":"Rua Marcelo Cândia","address_number":"535","address_neighborhood":"Santa Rita","address_city":"Macapá","address_state":"AP","address_postal_code":"","address_reference":"Esquina com a Duque de Caxias.","maps_url":"https://www.google.com/maps/search/?api=1&query=Rua%20Marcelo%20C%C3%A2ndia%2C%20535%2C%20Santa%20Rita%2C%20Macap%C3%A1%20-%20AP","patient_portal_url":"https://exames.image2doc.com.br/#/login/protocolo","about_title":"Tecnologia, precisão e cuidado.","about_description":"O Instituto de Neurologia do Amapá reúne diagnóstico por imagem, neurologia e medicina nuclear em Macapá.","about_purpose":"Facilitar o acesso a informações sobre exames, preparos, convênios e canais oficiais da INNEURO.","about_technology":"Tecnologia, comunicação clara e acesso digital aos resultados apoiam a jornada de atendimento."}'::jsonb,
  'institutional',
  true
)
on conflict (key) do nothing;

commit;
