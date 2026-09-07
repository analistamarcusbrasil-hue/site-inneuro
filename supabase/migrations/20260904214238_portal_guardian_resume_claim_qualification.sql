begin;

-- Qualifica as colunas do UPDATE porque size_bytes também é nome de uma coluna
-- de saída da função PL/pgSQL.
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
      optimization_claimed_by=p_run_id,optimization_attempts=r.optimization_attempts+1,
      original_size_bytes=coalesce(r.original_size_bytes,r.size_bytes),optimization_last_error=null
    from candidates c where r.id=c.id returning r.*
  ) select c.id,c.storage_path,c.size_bytes,c.original_name from claimed c;
end; $$;

revoke all on function public.portal_guardian_claim_resumes(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.portal_guardian_claim_resumes(uuid,integer)
  to service_role;

commit;
