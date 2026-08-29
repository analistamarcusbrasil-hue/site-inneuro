import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  SurveyDashboardMetrics,
  SurveyPublicDefinition,
  SurveyQuestion,
  SurveyRule,
} from "@/lib/surveys/types";

export const SURVEY_AUDIO_BUCKET = "survey-feedback-audio";

export function createSurveyResponseToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSurveyToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function surveyTokenMatches(value: string, expectedHash: string) {
  const actual = Buffer.from(hashSurveyToken(value), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function adminClient() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SURVEY_NOT_CONFIGURED");
  return admin;
}

export async function getSurveyPublicDefinition(
  token: string,
): Promise<SurveyPublicDefinition | null> {
  if (!/^[A-Za-z0-9_-]{48,160}$/.test(token)) return null;
  const admin = adminClient();
  const { data: qr } = await admin
    .from("survey_qr_codes")
    .select("id,organization_id,unit_id,campaign_id,stable_token,label,active")
    .eq("stable_token", token)
    .eq("active", true)
    .maybeSingle();
  if (!qr?.campaign_id) return null;
  const now = new Date().toISOString();
  const [{ data: campaign }, { data: organization }, { data: unit }] =
    await Promise.all([
      admin
        .from("survey_campaigns")
        .select("id,title,description,settings,status,starts_at,ends_at")
        .eq("id", qr.campaign_id)
        .eq("organization_id", qr.organization_id)
        .maybeSingle(),
      admin
        .from("survey_organizations")
        .select("id,name,active")
        .eq("id", qr.organization_id)
        .maybeSingle(),
      qr.unit_id
        ? admin
            .from("survey_units")
            .select("id,name,active")
            .eq("id", qr.unit_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  if (
    !campaign ||
    campaign.status !== "ACTIVE" ||
    !organization?.active ||
    (unit && !unit.active) ||
    (campaign.starts_at && campaign.starts_at > now) ||
    (campaign.ends_at && campaign.ends_at <= now)
  )
    return null;

  const { data: questionRows } = await admin
    .from("survey_questions")
    .select("id,stable_key,sort_order,active,current_version_id")
    .eq("campaign_id", campaign.id)
    .eq("active", true)
    .is("deleted_at", null)
    .order("sort_order");
  const versionIds = (questionRows ?? [])
    .map((question) => question.current_version_id)
    .filter((id): id is string => Boolean(id));
  const [{ data: versions }, { data: options }, { data: ruleRows }] =
    await Promise.all([
      versionIds.length
        ? admin
            .from("survey_question_versions")
            .select(
              "id,question_id,version_number,category,question_type,title,description,required,allow_na,configuration",
            )
            .in("id", versionIds)
        : Promise.resolve({ data: [] }),
      versionIds.length
        ? admin
            .from("survey_question_options")
            .select("id,version_id,label,value,sort_order,active")
            .in("version_id", versionIds)
            .eq("active", true)
            .order("sort_order")
        : Promise.resolve({ data: [] }),
      admin
        .from("survey_question_rules")
        .select(
          "id,source_question_id,operator,comparison_value,target_question_id,action",
        )
        .eq("campaign_id", campaign.id)
        .eq("active", true),
    ]);
  const versionMap = new Map((versions ?? []).map((item) => [item.id, item]));
  const questions = (questionRows ?? [])
    .map((question) => {
      const version = versionMap.get(question.current_version_id ?? "");
      if (!version) return null;
      return {
        id: question.id,
        stable_key: question.stable_key,
        sort_order: question.sort_order,
        active: question.active,
        version: {
          ...version,
          configuration:
            version.configuration && typeof version.configuration === "object"
              ? (version.configuration as Record<string, unknown>)
              : {},
          options: (options ?? [])
            .filter((option) => option.version_id === version.id)
            .map(({ id, label, value, sort_order }) => ({
              id,
              label,
              value,
              sort_order,
            })),
        },
      } as SurveyQuestion;
    })
    .filter((question): question is SurveyQuestion => Boolean(question));
  return {
    organization: { id: organization.id, name: organization.name },
    unit: unit ? { id: unit.id, name: unit.name } : null,
    campaign: {
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      settings:
        campaign.settings && typeof campaign.settings === "object"
          ? (campaign.settings as Record<string, unknown>)
          : {},
    },
    qrCode: { id: qr.id, token: qr.stable_token, label: qr.label },
    questions,
    rules: (ruleRows ?? []) as SurveyRule[],
  };
}

export async function getSurveyAdminContext(userId: string) {
  const admin = adminClient();
  const { data: access } = await admin
    .from("survey_profile_access")
    .select("organization_id,unit_id")
    .eq("profile_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!access) return null;
  const [{ data: organization }, { data: unit }, { data: campaign }] =
    await Promise.all([
      admin
        .from("survey_organizations")
        .select("id,name")
        .eq("id", access.organization_id)
        .single(),
      access.unit_id
        ? admin
            .from("survey_units")
            .select("id,name")
            .eq("id", access.unit_id)
            .single()
        : admin
            .from("survey_units")
            .select("id,name")
            .eq("organization_id", access.organization_id)
            .eq("active", true)
            .order("created_at")
            .limit(1)
            .maybeSingle(),
      admin
        .from("survey_campaigns")
        .select("id,name,title,description,status,settings,updated_at")
        .eq("organization_id", access.organization_id)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
    ]);
  if (!organization || !campaign) return null;
  return { admin, organization, unit, campaign };
}

export const emptySurveyMetrics: SurveyDashboardMetrics = {
  responseCount: 0,
  overallScore: null,
  criticalCount: 0,
  positiveRate: null,
  nps: null,
  npsBreakdown: { total: 0, promoters: 0, passives: 0, detractors: 0 },
  completion: { openings: 0, starts: 0, completions: 0, rate: null },
  dimensions: [],
  problems: [],
  praise: [],
};

export async function getSurveyMetrics(input: {
  organizationId: string;
  unitId: string | null;
  start: Date;
  exclusiveEnd: Date;
}) {
  const admin = adminClient();
  const { data, error } = await admin.rpc("survey_dashboard_metrics", {
    p_organization_id: input.organizationId,
    p_unit_id: input.unitId,
    p_start: input.start.toISOString(),
    p_end: input.exclusiveEnd.toISOString(),
  });
  if (error) throw error;
  return { ...emptySurveyMetrics, ...(data as SurveyDashboardMetrics) };
}

export async function auditSurveyAction(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  const admin = adminClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    before_data: input.before ?? null,
    after_data: input.after ?? null,
  });
  if (error) throw error;
}

export function getSurveyServiceClient() {
  return adminClient();
}
