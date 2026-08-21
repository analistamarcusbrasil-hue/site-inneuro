begin;

alter function public.replace_candidate_resume(
  text, text, bigint, text, jsonb, jsonb, text, text, integer
) security invoker;

drop policy if exists "candidate deletes own resume extractions"
on public.candidate_resume_extractions;
create policy "candidate deletes own resume extractions"
on public.candidate_resume_extractions for delete to authenticated
using (candidate_id = auth.uid());
grant delete on public.candidate_resume_extractions to authenticated;

commit;
