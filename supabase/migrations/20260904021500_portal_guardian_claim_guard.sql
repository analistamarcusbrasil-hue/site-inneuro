begin;

-- Garante que execução ativa sem a chave de purge não entregue claims ao worker.
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

commit;
