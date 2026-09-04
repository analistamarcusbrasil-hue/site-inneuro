begin;

-- Portal Guardian: fundação aditiva. Todos os efeitos destrutivos começam
-- desabilitados e esta migração não fecha solicitações nem remove arquivos.

create table if not exists public.portal_guardian_settings (
  singleton boolean primary key default true check (singleton),
  auto_close_enabled boolean not null default false,
  auto_purge_enabled boolean not null default false,
  resume_optimizer_enabled boolean not null default false,
  orphan_cleanup_enabled boolean not null default false,
  scheduling_close_days integer not null default 20 check (scheduling_close_days between 7 and 90),
  completed_retention_days integer not null default 7 check (completed_retention_days between 1 and 30),
  unscheduled_retention_days integer not null default 7 check (unscheduled_retention_days between 1 and 30),
  auto_closed_retention_days integer not null default 7 check (auto_closed_retention_days between 1 and 30),
  resume_small_bytes bigint not null default 1048576 check (resume_small_bytes between 102400 and 5242880),
  resume_priority_bytes bigint not null default 3145728 check (resume_priority_bytes >= resume_small_bytes),
  resume_min_savings_percent numeric(5,2) not null default 10 check (resume_min_savings_percent between 1 and 90),
  resume_min_savings_bytes bigint not null default 204800 check (resume_min_savings_bytes between 10240 and 5242880),
  orphan_observation_days integer not null default 7 check (orphan_observation_days between 2 and 30),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.portal_guardian_settings (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.portal_guardian_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null default 'RUNNING' check (status in ('RUNNING','SUCCESS','PARTIAL','FAILED')),
  dry_run boolean not null default true,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  scanned_count integer not null default 0 check (scanned_count >= 0),
  affected_count integer not null default 0 check (affected_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  bytes_freed bigint not null default 0 check (bytes_freed >= 0),
  summary jsonb not null default '{}'::jsonb,
  error_code text,
  check ((status = 'RUNNING' and finished_at is null) or (status <> 'RUNNING' and finished_at is not null))
);

create table if not exists public.portal_guardian_findings (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  storage_path text not null,
  finding_type text not null check (finding_type in ('ORPHAN_SUSPECTED','ORPHAN_CONFIRMED','BROKEN_REFERENCE','RESOLVED')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (bucket_id, storage_path)
);

alter table public.appointment_requests
  add column if not exists documents_purge_due_at timestamptz,
  add column if not exists auto_closed_at timestamptz;

alter table public.appointment_request_documents
  add column if not exists purged_at timestamptz,
  add column if not exists purge_reason text,
  add column if not exists purge_status text not null default 'ACTIVE',
  add column if not exists purge_last_error text,
  add column if not exists purge_attempts integer not null default 0,
  add column if not exists purge_claimed_at timestamptz,
  add column if not exists purge_claimed_by uuid,
  add column if not exists storage_integrity_status text not null default 'AVAILABLE',
  add column if not exists storage_integrity_checked_at timestamptz;

alter table public.appointment_request_documents
  drop constraint if exists appointment_request_documents_purge_status_check,
  drop constraint if exists appointment_request_documents_purge_reason_check;
alter table public.appointment_request_documents
  add constraint appointment_request_documents_purge_status_check check (
    purge_status in ('ACTIVE','CLAIMED','PURGED','FAILED')
  ),
  add constraint appointment_request_documents_purge_reason_check check (
    purge_reason is null or purge_reason in (
      'completed_retention','not_scheduled_retention','auto_closed_retention'
    )
  );

alter table public.appointment_request_documents
  drop constraint if exists appointment_request_documents_storage_integrity_status_check;
alter table public.appointment_request_documents
  add constraint appointment_request_documents_storage_integrity_status_check check (
    storage_integrity_status in (
      'AVAILABLE','MISSING_ORIGINAL','MISSING_PREVIEW','MISSING_BOTH','PURGED'
    )
  );

alter table public.candidate_resumes
  add column if not exists original_size_bytes bigint,
  add column if not exists optimization_status text not null default 'PENDING',
  add column if not exists optimization_attempts integer not null default 0,
  add column if not exists optimization_last_error text,
  add column if not exists optimization_claimed_at timestamptz,
  add column if not exists optimization_claimed_by uuid,
  add column if not exists optimized_at timestamptz,
  add column if not exists content_sha256 text;

alter table public.candidate_resumes
  drop constraint if exists candidate_resumes_optimization_status_check;
alter table public.candidate_resumes
  add constraint candidate_resumes_optimization_status_check check (
    optimization_status in (
      'PENDING','PROCESSING','OPTIMIZED','SKIPPED_ALREADY_SMALL',
      'SKIPPED_SIGNED','SKIPPED_ENCRYPTED','SKIPPED_NO_BENEFIT','FAILED'
    )
  );

alter table public.appointment_requests
  drop constraint if exists appointment_requests_operational_outcome_reason_check,
  drop constraint if exists appointment_requests_not_schedulable_reason_check;
alter table public.appointment_requests
  add constraint appointment_requests_operational_outcome_reason_check check (
    operational_outcome_reason is null or operational_outcome_reason in (
      'no_contact','whatsapp_no_response','invalid_phone','patient_declined',
      'exam_already_completed','patient_unavailable','insurance_not_authorized',
      'exam_unavailable','duplicate_request','service_team_timeout','other'
    )
  ),
  add constraint appointment_requests_not_schedulable_reason_check check (
    not_schedulable_reason is null or not_schedulable_reason in (
      'clinic_does_not_offer','insurance_not_covered','insurance_not_authorized',
      'contract_not_covered','service_team_timeout','other'
    )
  );

alter table public.appointment_request_exams
  drop constraint if exists appointment_request_exams_not_schedulable_reason_check;
alter table public.appointment_request_exams
  add constraint appointment_request_exams_not_schedulable_reason_check check (
    not_schedulable_reason is null or not_schedulable_reason in (
      'clinic_does_not_offer','insurance_not_covered','insurance_not_authorized',
      'contract_not_covered','service_team_timeout','other'
    )
  );

create index if not exists appointment_requests_guardian_age_idx
  on public.appointment_requests (created_at)
  where deleted_at is null and completed_at is null
    and workflow_status not in ('CONCLUIDO','NAO_AGENDAVEL','CANCELADO');
create index if not exists appointment_requests_guardian_purge_idx
  on public.appointment_requests (documents_purge_due_at)
  where documents_purge_due_at is not null;
create index if not exists appointment_documents_guardian_purge_idx
  on public.appointment_request_documents (appointment_request_id, purge_status)
  where purged_at is null;
create index if not exists candidate_resumes_guardian_optimize_idx
  on public.candidate_resumes (size_bytes desc, created_at)
  where optimization_status in ('PENDING','FAILED');
create index if not exists portal_guardian_runs_started_idx
  on public.portal_guardian_job_runs (started_at desc);
create index if not exists portal_guardian_findings_type_idx
  on public.portal_guardian_findings (finding_type, last_seen_at desc);
create unique index if not exists appointment_history_guardian_timeout_once_idx
  on public.appointment_request_history (appointment_request_id)
  where action = 'AUTO_CLOSED_BY_SYSTEM_TIMEOUT';

create or replace function private.portal_guardian_schedule_retention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare retention_days integer;
begin
  if new.completed_at is not null and (
    tg_op = 'INSERT' or old.completed_at is distinct from new.completed_at
    or new.documents_purge_due_at is null
  ) then
    select case
      when new.auto_closed_at is not null then auto_closed_retention_days
      when new.workflow_status in ('NAO_AGENDAVEL','CANCELADO') then unscheduled_retention_days
      else completed_retention_days end into retention_days
    from public.portal_guardian_settings where singleton = true;
    new.documents_purge_due_at := new.completed_at + make_interval(days => coalesce(retention_days, 7));
  elsif new.completed_at is null then
    new.documents_purge_due_at := null;
  end if;
  return new;
end;
$$;
revoke all on function private.portal_guardian_schedule_retention() from public,anon,authenticated;

drop trigger if exists appointment_requests_guardian_retention on public.appointment_requests;
create trigger appointment_requests_guardian_retention
before insert or update of completed_at, documents_purge_due_at
on public.appointment_requests for each row
execute function private.portal_guardian_schedule_retention();

-- Backfill de agenda de retenção somente; não produz qualquer efeito externo.
update public.appointment_requests r
set documents_purge_due_at = r.completed_at + make_interval(days => case
  when r.auto_closed_at is not null then s.auto_closed_retention_days
  when r.workflow_status in ('NAO_AGENDAVEL','CANCELADO') then s.unscheduled_retention_days
  else s.completed_retention_days end)
from public.portal_guardian_settings s
where s.singleton = true
  and r.completed_at is not null
  and r.documents_purge_due_at is null;

create or replace function public.portal_guardian_begin_job(p_job_name text, p_dry_run boolean default true)
returns uuid language plpgsql security definer set search_path = '' as $$
declare run_id uuid;
begin
  if nullif(btrim(p_job_name), '') is null then
    raise exception using errcode = '22023', message = 'guardian_job_name_required';
  end if;
  insert into public.portal_guardian_job_runs(job_name, dry_run)
  values (left(btrim(p_job_name), 120), coalesce(p_dry_run, true)) returning id into run_id;
  return run_id;
end; $$;

create or replace function public.portal_guardian_finish_job(
  p_run_id uuid, p_status text, p_scanned integer, p_affected integer,
  p_failed integer, p_bytes_freed bigint, p_summary jsonb default '{}'::jsonb,
  p_error_code text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('SUCCESS','PARTIAL','FAILED') then
    raise exception using errcode = '22023', message = 'guardian_job_status_invalid';
  end if;
  update public.portal_guardian_job_runs set
    status=p_status, finished_at=now(), scanned_count=greatest(coalesce(p_scanned,0),0),
    affected_count=greatest(coalesce(p_affected,0),0), failed_count=greatest(coalesce(p_failed,0),0),
    bytes_freed=greatest(coalesce(p_bytes_freed,0),0), summary=coalesce(p_summary,'{}'::jsonb),
    error_code=left(nullif(p_error_code,''),120)
  where id=p_run_id and status='RUNNING';
end; $$;

create or replace function public.portal_guardian_run_scheduling(
  p_run_id uuid, p_dry_run boolean default true, p_limit integer default 100
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  settings_record record;
  request_record record;
  event_time timestamptz := now();
  eligible_count integer := 0;
  closed_count integer := 0;
  official_note text;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('portal_guardian_scheduling_lifecycle',0)) then
    return jsonb_build_object('locked',true,'eligible',0,'closed',0);
  end if;
  select * into settings_record from public.portal_guardian_settings where singleton=true;
  official_note := format('Solicitação de agendamento não finalizada dentro do prazo operacional de %s dias. O atendimento foi encerrado automaticamente pelo sistema por ausência de conclusão pela equipe de atendimento.', settings_record.scheduling_close_days);
  select count(*)::integer into eligible_count from public.appointment_requests r
  where r.deleted_at is null and r.completed_at is null
    and r.workflow_status not in ('CONCLUIDO','NAO_AGENDAVEL','CANCELADO')
    and r.created_at <= event_time - make_interval(days=>settings_record.scheduling_close_days);
  if coalesce(p_dry_run,true) or not settings_record.auto_close_enabled then
    return jsonb_build_object('locked',false,'enabled',settings_record.auto_close_enabled,'eligible',eligible_count,'closed',0);
  end if;
  for request_record in
    select r.id,r.status,r.workflow_status,r.created_at from public.appointment_requests r
    where r.deleted_at is null and r.completed_at is null
      and r.workflow_status not in ('CONCLUIDO','NAO_AGENDAVEL','CANCELADO')
      and r.created_at <= event_time - make_interval(days=>settings_record.scheduling_close_days)
    order by r.created_at for update skip locked limit greatest(1,least(coalesce(p_limit,100),500))
  loop
    update public.appointment_request_exams set
      status='NOT_SCHEDULABLE', not_schedulable_reason='service_team_timeout',
      not_schedulable_detail=official_note, not_schedulable_at=event_time, not_schedulable_by=null
    where appointment_request_id=request_record.id and status not in ('COMPLETED','CANCELLED','NOT_SCHEDULABLE');
    update public.appointment_requests set
      workflow_status='NAO_AGENDAVEL', status='CANCELLED', completed_by=null,
      completed_at=event_time, auto_closed_at=event_time, follow_up_at=null,
      operational_outcome_reason='service_team_timeout', operational_outcome_note=official_note,
      not_schedulable_reason='service_team_timeout', not_schedulable_detail=official_note,
      not_schedulable_at=event_time, not_schedulable_by=null,
      not_schedulable_communication_status='NOT_REQUIRED', confirmation_status='NOT_REQUIRED'
    where id=request_record.id and completed_at is null;
    insert into public.appointment_request_history(appointment_request_id,actor_id,action,details)
    values(request_record.id,null,'AUTO_CLOSED_BY_SYSTEM_TIMEOUT',jsonb_build_object(
      'rule','scheduling_auto_close_20d','rule_version',1,'source','SYSTEM_JOB',
      'actor_kind','system','agent','PORTAL_GUARDIAN','job_name','portal_guardian_scheduling_lifecycle',
      'job_run_id',p_run_id,'reason_code','service_team_timeout','display_reason','Prazo operacional excedido',
      'previous_status',request_record.status,'previous_workflow_status',request_record.workflow_status,
      'new_status','CANCELLED','new_workflow_status','NAO_AGENDAVEL',
      'request_created_at',request_record.created_at,'auto_closed_at',event_time,
      'age_days',floor(extract(epoch from (event_time-request_record.created_at))/86400),
      'description','Atendimento encerrado automaticamente pelo Portal Guardian após exceder o prazo operacional de 20 dias sem finalização.'
    )) on conflict do nothing;
    closed_count := closed_count + 1;
  end loop;
  return jsonb_build_object('locked',false,'enabled',true,'eligible',eligible_count,'closed',closed_count);
end; $$;

create or replace function public.portal_guardian_claim_scheduling_documents(
  p_run_id uuid, p_dry_run boolean default true, p_limit integer default 100
) returns table(document_id uuid, storage_path text, preview_storage_path text, file_size bigint, preview_file_size bigint, purge_reason text)
language plpgsql security definer set search_path = '' as $$
declare enabled boolean;
begin
  select auto_purge_enabled into enabled from public.portal_guardian_settings where singleton=true;
  if coalesce(p_dry_run,true) then
    return query select d.id,d.storage_path,d.preview_storage_path,d.file_size,d.preview_file_size,
      case when r.auto_closed_at is not null then 'auto_closed_retention'
           when r.workflow_status in ('NAO_AGENDAVEL','CANCELADO') then 'not_scheduled_retention'
           else 'completed_retention' end
    from public.appointment_request_documents d join public.appointment_requests r on r.id=d.appointment_request_id
    where r.documents_purge_due_at<=now() and d.purged_at is null
      and (d.purge_claimed_at is null or d.purge_claimed_at<now()-interval '30 minutes')
    order by r.documents_purge_due_at limit greatest(1,least(coalesce(p_limit,100),500));
    return;
  end if;
  if not enabled then return; end if;
  return query with candidates as (
    select d.id from public.appointment_request_documents d join public.appointment_requests r on r.id=d.appointment_request_id
    where r.documents_purge_due_at<=now() and d.purged_at is null
      and d.purge_attempts < (select max_attempts from public.portal_guardian_settings where singleton=true)
      and (d.purge_claimed_at is null or d.purge_claimed_at<now()-interval '30 minutes')
    order by r.documents_purge_due_at for update of d skip locked limit greatest(1,least(coalesce(p_limit,100),500))
  ), claimed as (
    update public.appointment_request_documents d set purge_status='CLAIMED',purge_claimed_at=now(),purge_claimed_by=p_run_id,purge_attempts=purge_attempts+1
    from candidates c where d.id=c.id returning d.*
  ) select c.id,c.storage_path,c.preview_storage_path,c.file_size,c.preview_file_size,
    case when r.auto_closed_at is not null then 'auto_closed_retention'
         when r.workflow_status in ('NAO_AGENDAVEL','CANCELADO') then 'not_scheduled_retention'
         else 'completed_retention' end
  from claimed c join public.appointment_requests r on r.id=c.appointment_request_id;
end; $$;

create or replace function public.portal_guardian_finish_document_purge(
  p_run_id uuid,p_document_id uuid,p_success boolean,p_reason text,p_error_code text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
  update public.appointment_request_documents set
    purge_status=case when p_success then 'PURGED' else 'FAILED' end,
    purged_at=case when p_success then now() else null end,
    purge_reason=case when p_success then p_reason else purge_reason end,
    purge_last_error=case when p_success then null else left(coalesce(p_error_code,'storage_remove_failed'),200) end,
    purge_claimed_at=null,purge_claimed_by=null,
    storage_integrity_status=case when p_success then 'PURGED' else storage_integrity_status end,
    storage_integrity_checked_at=case when p_success then now() else storage_integrity_checked_at end
  where id=p_document_id and purge_claimed_by=p_run_id;
  get diagnostics updated_count=row_count;
  return updated_count=1;
end; $$;

create or replace function public.portal_guardian_claim_resumes(
  p_run_id uuid,p_limit integer default 10
) returns table(resume_id uuid,storage_path text,size_bytes bigint,original_name text)
language plpgsql security definer set search_path = '' as $$
begin
  if not (select resume_optimizer_enabled from public.portal_guardian_settings where singleton=true) then return; end if;
  update public.candidate_resumes r set
    optimization_status='SKIPPED_ALREADY_SMALL',optimization_last_error=null,
    optimization_claimed_at=null,optimization_claimed_by=null
  from public.portal_guardian_settings s
  where s.singleton=true and r.optimization_status in ('PENDING','FAILED')
    and r.size_bytes<s.resume_small_bytes;
  return query with candidates as (
    select r.id from public.candidate_resumes r, public.portal_guardian_settings s
    where s.singleton=true and r.size_bytes>=s.resume_small_bytes
      and r.optimization_status in ('PENDING','FAILED') and r.optimization_attempts<s.max_attempts
      and (r.optimization_claimed_at is null or r.optimization_claimed_at<now()-interval '30 minutes')
    order by (r.size_bytes>=s.resume_priority_bytes) desc,r.size_bytes desc
    for update of r skip locked limit greatest(1,least(coalesce(p_limit,10),50))
  ), claimed as (
    update public.candidate_resumes r set optimization_status='PROCESSING',optimization_claimed_at=now(),
      optimization_claimed_by=p_run_id,optimization_attempts=optimization_attempts+1,
      original_size_bytes=coalesce(original_size_bytes,size_bytes),optimization_last_error=null
    from candidates c where r.id=c.id returning r.*
  ) select c.id,c.storage_path,c.size_bytes,c.original_name from claimed c;
end; $$;

create or replace function public.portal_guardian_finish_resume(
  p_run_id uuid,p_resume_id uuid,p_expected_path text,p_status text,p_new_path text default null,
  p_new_size bigint default null,p_sha256 text default null,p_error_code text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
  if p_status not in ('OPTIMIZED','SKIPPED_ALREADY_SMALL','SKIPPED_SIGNED','SKIPPED_ENCRYPTED','SKIPPED_NO_BENEFIT','FAILED') then
    raise exception using errcode='22023',message='guardian_resume_status_invalid';
  end if;
  update public.candidate_resumes set
    storage_path=case when p_status='OPTIMIZED' then p_new_path else storage_path end,
    size_bytes=case when p_status='OPTIMIZED' then p_new_size else size_bytes end,
    optimization_status=p_status,optimization_last_error=case when p_status='FAILED' then left(coalesce(p_error_code,'optimization_failed'),200) else null end,
    optimized_at=case when p_status='OPTIMIZED' then now() else optimized_at end,
    content_sha256=coalesce(p_sha256,content_sha256),optimization_claimed_at=null,optimization_claimed_by=null
  where id=p_resume_id and storage_path=p_expected_path and optimization_claimed_by=p_run_id
    and (p_status<>'OPTIMIZED' or (nullif(p_new_path,'') is not null and p_new_size>0));
  get diagnostics updated_count=row_count; return updated_count=1;
end; $$;

create or replace function public.get_portal_guardian_dashboard()
returns jsonb language sql stable security definer set search_path = '' as $$
  with open_requests as (
    select extract(epoch from (now()-created_at))/86400 as age_days
    from public.appointment_requests where deleted_at is null and completed_at is null
      and workflow_status not in ('CONCLUIDO','NAO_AGENDAVEL','CANCELADO')
  ), metrics as (
    select count(*)::integer as open_total,
      count(*) filter(where age_days>=15 and age_days<17)::integer as attention,
      count(*) filter(where age_days>=17 and age_days<20)::integer as risk,
      count(*) filter(where age_days>=20)::integer as overdue from open_requests
  ), run_health as (
    select max(started_at) as last_run,
      count(*) filter(where status='FAILED' and started_at>=now()-interval '24 hours')::integer as recent_failures
    from public.portal_guardian_job_runs
  ), finding_health as (
    select count(*) filter(where finding_type='ORPHAN_SUSPECTED')::integer as orphan_suspected,
      count(*) filter(where finding_type='ORPHAN_CONFIRMED')::integer as orphan_confirmed,
      count(*) filter(where finding_type='BROKEN_REFERENCE')::integer as broken_references
    from public.portal_guardian_findings
  ) select jsonb_build_object(
    'settings',(select to_jsonb(s)-'updated_by' from public.portal_guardian_settings s where singleton=true),
    'health',jsonb_build_object(
      'status',case when run_health.recent_failures>=3 then 'CRITICAL'
        when run_health.last_run is null or run_health.last_run<now()-interval '26 hours'
          or run_health.recent_failures>0 or finding_health.broken_references>0 then 'WARNING'
        else 'HEALTHY' end,
      'last_run',run_health.last_run,
      'next_run',case when run_health.last_run is null then null else run_health.last_run+interval '1 day' end,
      'recent_failures',run_health.recent_failures
    ),
    'requests',to_jsonb(metrics),
    'purge_due',(select count(*)::integer from public.appointment_request_documents d join public.appointment_requests r on r.id=d.appointment_request_id where r.documents_purge_due_at<=now() and d.purged_at is null),
    'resume_pending',(select count(*)::integer from public.candidate_resumes where optimization_status in ('PENDING','FAILED')),
    'findings',(select count(*)::integer from public.portal_guardian_findings where finding_type<>'RESOLVED'),
    'finding_health',to_jsonb(finding_health),
    'storage',jsonb_build_object(
      'scheduling',coalesce((select sum(file_size+coalesce(preview_file_size,0)) from public.appointment_request_documents where purged_at is null),0),
      'resumes',coalesce((select sum(size_bytes) from public.candidate_resumes),0),
      'media',coalesce((select sum(size_bytes) from public.media_assets),0)
    ),
    'scheduling_activity',jsonb_build_object(
      'auto_closed_today',(select count(*)::integer from public.appointment_requests where auto_closed_at>=date_trunc('day',now())),
      'auto_closed_month',(select count(*)::integer from public.appointment_requests where auto_closed_at>=date_trunc('month',now())),
      'documents_purged',(select count(*)::integer from public.appointment_request_documents where purged_at is not null),
      'bytes_freed',coalesce((select sum(bytes_freed) from public.portal_guardian_job_runs where job_name='portal_guardian_scheduling_lifecycle' and status in ('SUCCESS','PARTIAL')),0)
    ),
    'resume_activity',jsonb_build_object(
      'received',(select count(*)::integer from public.candidate_resumes),
      'optimized',(select count(*)::integer from public.candidate_resumes where optimization_status='OPTIMIZED'),
      'already_small',(select count(*)::integer from public.candidate_resumes where optimization_status='SKIPPED_ALREADY_SMALL'),
      'signed',(select count(*)::integer from public.candidate_resumes where optimization_status='SKIPPED_SIGNED'),
      'encrypted',(select count(*)::integer from public.candidate_resumes where optimization_status='SKIPPED_ENCRYPTED'),
      'failed',(select count(*)::integer from public.candidate_resumes where optimization_status='FAILED'),
      'bytes_saved',coalesce((select sum(bytes_freed) from public.portal_guardian_job_runs where job_name='portal_guardian_resume_optimizer' and status in ('SUCCESS','PARTIAL')),0)
    ),
    'recent_runs',coalesce((select jsonb_agg(x) from (select id,job_name,status,dry_run,started_at,finished_at,scanned_count,affected_count,failed_count,bytes_freed,error_code from public.portal_guardian_job_runs order by started_at desc limit 20)x),'[]'::jsonb)
  ) from metrics cross join run_health cross join finding_health;
$$;

alter table public.portal_guardian_settings enable row level security;
alter table public.portal_guardian_job_runs enable row level security;
alter table public.portal_guardian_findings enable row level security;

create policy "authorized staff reads guardian settings" on public.portal_guardian_settings for select to authenticated
  using (public.current_app_role()='super_admin' or 'settings.manage'=any(coalesce((select permissions from public.profiles where id=(select auth.uid())),'{}'::text[])));
create policy "authorized staff reads guardian runs" on public.portal_guardian_job_runs for select to authenticated
  using (public.current_app_role()='super_admin' or 'settings.manage'=any(coalesce((select permissions from public.profiles where id=(select auth.uid())),'{}'::text[])));
create policy "authorized staff reads guardian findings" on public.portal_guardian_findings for select to authenticated
  using (public.current_app_role()='super_admin' or 'settings.manage'=any(coalesce((select permissions from public.profiles where id=(select auth.uid())),'{}'::text[])));

grant select on public.portal_guardian_settings,public.portal_guardian_job_runs,public.portal_guardian_findings to authenticated;
revoke all on function public.portal_guardian_begin_job(text,boolean) from public,anon,authenticated;
revoke all on function public.portal_guardian_finish_job(uuid,text,integer,integer,integer,bigint,jsonb,text) from public,anon,authenticated;
revoke all on function public.portal_guardian_run_scheduling(uuid,boolean,integer) from public,anon,authenticated;
revoke all on function public.portal_guardian_claim_scheduling_documents(uuid,boolean,integer) from public,anon,authenticated;
revoke all on function public.portal_guardian_finish_document_purge(uuid,uuid,boolean,text,text) from public,anon,authenticated;
revoke all on function public.portal_guardian_claim_resumes(uuid,integer) from public,anon,authenticated;
revoke all on function public.portal_guardian_finish_resume(uuid,uuid,text,text,text,bigint,text,text) from public,anon,authenticated;
revoke all on function public.get_portal_guardian_dashboard() from public,anon,authenticated;
grant execute on function public.portal_guardian_begin_job(text,boolean),public.portal_guardian_finish_job(uuid,text,integer,integer,integer,bigint,jsonb,text),
  public.portal_guardian_run_scheduling(uuid,boolean,integer),public.portal_guardian_claim_scheduling_documents(uuid,boolean,integer),
  public.portal_guardian_finish_document_purge(uuid,uuid,boolean,text,text),public.portal_guardian_claim_resumes(uuid,integer),
  public.portal_guardian_finish_resume(uuid,uuid,text,text,text,bigint,text,text),public.get_portal_guardian_dashboard() to service_role;

commit;
