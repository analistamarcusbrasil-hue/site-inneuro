begin;

alter table public.candidate_profiles
add column if not exists field_sources jsonb not null default '{}'::jsonb
check (jsonb_typeof(field_sources) = 'object');

alter table public.candidate_experiences
add column if not exists data_source text not null default 'manual'
check (data_source in ('manual', 'resume'));

alter table public.candidate_education
add column if not exists data_source text not null default 'manual'
check (data_source in ('manual', 'resume'));

alter table public.candidate_certifications
add column if not exists data_source text not null default 'manual'
check (data_source in ('manual', 'resume'));

alter table public.candidate_skills
add column if not exists data_source text not null default 'manual'
check (data_source in ('manual', 'resume'));

create table if not exists public.candidate_resume_extractions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_accounts(id) on delete cascade,
  resume_id uuid not null references public.candidate_resumes(id) on delete cascade,
  status text not null check (
    status in ('ready', 'partial', 'failed', 'applied', 'ignored')
  ),
  extracted_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(extracted_data) = 'object'),
  warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warnings) = 'array'),
  parser_version text not null,
  text_sha256 text check (
    text_sha256 is null or text_sha256 ~ '^[a-f0-9]{64}$'
  ),
  total_pages integer check (total_pages is null or total_pages > 0),
  applied_at timestamptz,
  ignored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resume_id),
  unique (id, candidate_id)
);

alter table public.candidate_experiences
add column if not exists source_extraction_id uuid
;
alter table public.candidate_experiences
add column if not exists source_item_index integer
check (source_item_index is null or source_item_index >= 0);

alter table public.candidate_education
add column if not exists source_extraction_id uuid
;
alter table public.candidate_education
add column if not exists source_item_index integer
check (source_item_index is null or source_item_index >= 0);

alter table public.candidate_certifications
add column if not exists source_extraction_id uuid
;
alter table public.candidate_certifications
add column if not exists source_item_index integer
check (source_item_index is null or source_item_index >= 0);

alter table public.candidate_skills
add column if not exists source_extraction_id uuid
;
alter table public.candidate_skills
add column if not exists source_item_index integer
check (source_item_index is null or source_item_index >= 0);

create unique index if not exists candidate_experiences_extraction_item_idx
on public.candidate_experiences (source_extraction_id, source_item_index);
create unique index if not exists candidate_education_extraction_item_idx
on public.candidate_education (source_extraction_id, source_item_index);
create unique index if not exists candidate_certifications_extraction_item_idx
on public.candidate_certifications (source_extraction_id, source_item_index);
create unique index if not exists candidate_skills_extraction_item_idx
on public.candidate_skills (source_extraction_id, source_item_index);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'candidate_experiences_extraction_owner_fk'
  ) then
    alter table public.candidate_experiences
    add constraint candidate_experiences_extraction_owner_fk
    foreign key (source_extraction_id, candidate_id)
    references public.candidate_resume_extractions(id, candidate_id)
    on delete set null (source_extraction_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'candidate_education_extraction_owner_fk'
  ) then
    alter table public.candidate_education
    add constraint candidate_education_extraction_owner_fk
    foreign key (source_extraction_id, candidate_id)
    references public.candidate_resume_extractions(id, candidate_id)
    on delete set null (source_extraction_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'candidate_certifications_extraction_owner_fk'
  ) then
    alter table public.candidate_certifications
    add constraint candidate_certifications_extraction_owner_fk
    foreign key (source_extraction_id, candidate_id)
    references public.candidate_resume_extractions(id, candidate_id)
    on delete set null (source_extraction_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'candidate_skills_extraction_owner_fk'
  ) then
    alter table public.candidate_skills
    add constraint candidate_skills_extraction_owner_fk
    foreign key (source_extraction_id, candidate_id)
    references public.candidate_resume_extractions(id, candidate_id)
    on delete set null (source_extraction_id);
  end if;
end $$;

create index if not exists candidate_resume_extractions_candidate_idx
on public.candidate_resume_extractions (candidate_id, created_at desc);

drop trigger if exists candidate_resume_extractions_updated_at
on public.candidate_resume_extractions;
create trigger candidate_resume_extractions_updated_at
before update on public.candidate_resume_extractions
for each row execute procedure public.set_updated_at();

alter table public.candidate_resume_extractions enable row level security;

create policy "candidate reads own resume extractions"
on public.candidate_resume_extractions for select to authenticated
using (candidate_id = auth.uid());

create policy "candidate creates own resume extractions"
on public.candidate_resume_extractions for insert to authenticated
with check (
  candidate_id = auth.uid()
  and exists (
    select 1 from public.candidate_resumes resume
    where resume.id = resume_id and resume.candidate_id = auth.uid()
  )
);

create policy "candidate reviews own resume extractions"
on public.candidate_resume_extractions for update to authenticated
using (
  candidate_id = auth.uid()
  and status in ('ready', 'partial')
)
with check (
  candidate_id = auth.uid()
  and status in ('applied', 'ignored')
);

create policy "hr reads candidate resume extractions"
on public.candidate_resume_extractions for select to authenticated
using (public.can_manage_hr());

grant select, insert on public.candidate_resume_extractions to authenticated;
grant update (status, applied_at, ignored_at)
on public.candidate_resume_extractions to authenticated;

commit;
