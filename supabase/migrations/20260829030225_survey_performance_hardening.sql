-- Evita políticas permissivas duplicadas em SELECT e cobre FKs usadas pelo módulo.
drop policy "survey managers manage campaigns" on public.survey_campaigns;
create policy "survey managers insert campaigns" on public.survey_campaigns
for insert to authenticated with check (
  private.can_access_survey_tenant(organization_id, unit_id, 'surveys.manage')
);
create policy "survey managers update campaigns" on public.survey_campaigns
for update to authenticated
using (private.can_access_survey_tenant(organization_id, unit_id, 'surveys.manage'))
with check (private.can_access_survey_tenant(organization_id, unit_id, 'surveys.manage'));
create policy "survey managers delete campaigns" on public.survey_campaigns
for delete to authenticated using (
  private.can_access_survey_tenant(organization_id, unit_id, 'surveys.manage')
);

drop policy "survey managers manage questions" on public.survey_questions;
create policy "survey managers insert questions" on public.survey_questions
for insert to authenticated with check (exists (
  select 1 from public.survey_campaigns campaign where campaign.id = campaign_id
  and private.can_access_survey_tenant(campaign.organization_id, campaign.unit_id, 'surveys.manage')
));
create policy "survey managers update questions" on public.survey_questions
for update to authenticated
using (exists (
  select 1 from public.survey_campaigns campaign where campaign.id = campaign_id
  and private.can_access_survey_tenant(campaign.organization_id, campaign.unit_id, 'surveys.manage')
))
with check (exists (
  select 1 from public.survey_campaigns campaign where campaign.id = campaign_id
  and private.can_access_survey_tenant(campaign.organization_id, campaign.unit_id, 'surveys.manage')
));
create policy "survey managers delete questions" on public.survey_questions
for delete to authenticated using (exists (
  select 1 from public.survey_campaigns campaign where campaign.id = campaign_id
  and private.can_access_survey_tenant(campaign.organization_id, campaign.unit_id, 'surveys.manage')
));

create index survey_answers_question_version_idx on public.survey_answers (question_version_id);
create index survey_campaigns_created_by_idx on public.survey_campaigns (created_by);
create index survey_campaigns_unit_idx on public.survey_campaigns (unit_id);
create index survey_campaigns_updated_by_idx on public.survey_campaigns (updated_by);
create index survey_events_organization_idx on public.survey_events (organization_id);
create index survey_events_qr_idx on public.survey_events (qr_code_id);
create index survey_events_response_idx on public.survey_events (response_id);
create index survey_events_unit_idx on public.survey_events (unit_id);
create index survey_snapshots_generated_by_idx on public.survey_monthly_snapshots (generated_by);
create index survey_snapshots_unit_idx on public.survey_monthly_snapshots (unit_id);
create index survey_profile_access_created_by_idx on public.survey_profile_access (created_by);
create index survey_profile_access_organization_idx on public.survey_profile_access (organization_id);
create index survey_profile_access_unit_idx on public.survey_profile_access (unit_id);
create index survey_qr_campaign_idx on public.survey_qr_codes (campaign_id);
create index survey_qr_created_by_idx on public.survey_qr_codes (created_by);
create index survey_qr_organization_idx on public.survey_qr_codes (organization_id);
create index survey_qr_unit_idx on public.survey_qr_codes (unit_id);
create index survey_options_question_idx on public.survey_question_options (question_id);
create index survey_rules_created_by_idx on public.survey_question_rules (created_by);
create index survey_rules_target_idx on public.survey_question_rules (target_question_id);
create index survey_versions_created_by_idx on public.survey_question_versions (created_by);
create index survey_questions_created_by_idx on public.survey_questions (created_by);
create index survey_questions_current_version_idx on public.survey_questions (current_version_id);
create index survey_questions_deleted_by_idx on public.survey_questions (deleted_by);
create index survey_questions_updated_by_idx on public.survey_questions (updated_by);
create index survey_responses_qr_idx on public.survey_responses (qr_code_id);
create index survey_responses_unit_idx on public.survey_responses (unit_id);
