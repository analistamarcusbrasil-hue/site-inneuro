begin;

-- Referências já ausentes no Storage são findings de integridade, não itens de
-- purge. O worker recebe somente documentos cujo original ainda existe.
create or replace function public.portal_guardian_claim_scheduling_documents(
  p_run_id uuid, p_dry_run boolean default true, p_limit integer default 100
) returns table(document_id uuid, storage_path text, preview_storage_path text, file_size bigint, preview_file_size bigint, purge_reason text)
language plpgsql security definer set search_path = '' as $$
declare enabled boolean;
begin
  select auto_purge_enabled into enabled
  from public.portal_guardian_settings where singleton=true;

  if coalesce(p_dry_run,true) then
    return query
    select d.id,d.storage_path,d.preview_storage_path,d.file_size,d.preview_file_size,
      case when r.auto_closed_at is not null then 'auto_closed_retention'
           when r.workflow_status in ('NAO_AGENDAVEL','CANCELADO') then 'not_scheduled_retention'
           else 'completed_retention' end
    from public.appointment_request_documents d
    join public.appointment_requests r on r.id=d.appointment_request_id
    where r.documents_purge_due_at<=now() and d.purged_at is null
      and d.storage_integrity_status in ('AVAILABLE','MISSING_PREVIEW')
      and (d.purge_claimed_at is null or d.purge_claimed_at<now()-interval '30 minutes')
    order by r.documents_purge_due_at
    limit greatest(1,least(coalesce(p_limit,100),500));
    return;
  end if;

  if not enabled then return; end if;

  return query with candidates as (
    select d.id
    from public.appointment_request_documents d
    join public.appointment_requests r on r.id=d.appointment_request_id
    where r.documents_purge_due_at<=now() and d.purged_at is null
      and d.storage_integrity_status in ('AVAILABLE','MISSING_PREVIEW')
      and d.purge_attempts < (select max_attempts from public.portal_guardian_settings where singleton=true)
      and (d.purge_claimed_at is null or d.purge_claimed_at<now()-interval '30 minutes')
    order by r.documents_purge_due_at
    for update of d skip locked
    limit greatest(1,least(coalesce(p_limit,100),500))
  ), claimed as (
    update public.appointment_request_documents d
    set purge_status='CLAIMED',purge_claimed_at=now(),purge_claimed_by=p_run_id,
      purge_attempts=purge_attempts+1
    from candidates c where d.id=c.id returning d.*
  )
  select c.id,c.storage_path,c.preview_storage_path,c.file_size,c.preview_file_size,
    case when r.auto_closed_at is not null then 'auto_closed_retention'
         when r.workflow_status in ('NAO_AGENDAVEL','CANCELADO') then 'not_scheduled_retention'
         else 'completed_retention' end
  from claimed c
  join public.appointment_requests r on r.id=c.appointment_request_id;
end; $$;

revoke all on function public.portal_guardian_claim_scheduling_documents(uuid,boolean,integer)
  from public,anon,authenticated;
grant execute on function public.portal_guardian_claim_scheduling_documents(uuid,boolean,integer)
  to service_role;

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
    'purge_due',(select count(*)::integer from public.appointment_request_documents d join public.appointment_requests r on r.id=d.appointment_request_id where r.documents_purge_due_at<=now() and d.purged_at is null and d.storage_integrity_status in ('AVAILABLE','MISSING_PREVIEW')),
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

revoke all on function public.get_portal_guardian_dashboard()
  from public,anon,authenticated;
grant execute on function public.get_portal_guardian_dashboard() to service_role;

commit;
