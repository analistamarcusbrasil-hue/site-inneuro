import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/cms/auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { auditSurveyAction, getSurveyAdminContext } from "@/lib/surveys/server";

const schema = z.object({
  action: z.enum(["save", "duplicate", "toggle", "delete", "reorder", "rule"]),
  id: z.string().uuid().optional(),
  active: z.boolean().optional(),
  direction: z.enum(["up", "down"]).optional(),
  sourceId: z.string().uuid().optional(),
  targetId: z.string().uuid().optional(),
  operator: z.enum(["LTE", "GTE", "EQ"]).optional(),
  comparisonValue: z.union([z.string(), z.number()]).optional(),
  version: z
    .object({
      title: z.string().trim().min(3).max(300),
      description: z.string().max(500).nullable().optional(),
      category: z.string().min(2).max(40),
      question_type: z.enum([
        "STAR_5",
        "NPS_10",
        "NUMBER_SCALE",
        "YES_NO",
        "SINGLE_CHOICE",
        "MULTIPLE_CHOICE",
        "SHORT_TEXT",
        "LONG_TEXT",
        "AUDIO",
      ]),
      required: z.boolean(),
      allow_na: z.boolean(),
      options: z
        .array(z.object({ label: z.string(), value: z.string() }))
        .default([]),
    })
    .optional(),
});

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (
    !session.user ||
    !session.profile ||
    !hasAdminPermission(session.profile, "surveys.manage")
  )
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const context = await getSurveyAdminContext(session.user.id);
  if (!context)
    return NextResponse.json({ error: "NO_SCOPE" }, { status: 403 });
  const db = context.admin;
  const input = parsed.data;
  const { data: existing } = input.id
    ? await db
        .from("survey_questions")
        .select(
          "*,survey_question_versions!survey_questions_current_version_fkey(*)",
        )
        .eq("id", input.id)
        .eq("campaign_id", context.campaign.id)
        .maybeSingle()
    : { data: null };
  if (input.id && !existing)
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (input.action === "toggle")
    await db
      .from("survey_questions")
      .update({ active: input.active, updated_at: new Date().toISOString() })
      .eq("id", input.id!);
  if (input.action === "delete")
    await db
      .from("survey_questions")
      .update({
        active: false,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id!);
  if (input.action === "reorder" && existing && input.direction) {
    const comparison = input.direction === "up" ? "lt" : "gt";
    let neighborQuery = db
      .from("survey_questions")
      .select("id,sort_order")
      .eq("campaign_id", context.campaign.id)
      .is("deleted_at", null);
    neighborQuery = neighborQuery[comparison](
      "sort_order",
      existing.sort_order,
    );
    const { data: neighbor } = await neighborQuery
      .order("sort_order", { ascending: input.direction === "down" })
      .limit(1)
      .maybeSingle();
    if (neighbor) {
      await db
        .from("survey_questions")
        .update({ sort_order: neighbor.sort_order })
        .eq("id", existing.id);
      await db
        .from("survey_questions")
        .update({ sort_order: existing.sort_order })
        .eq("id", neighbor.id);
    }
  }
  if (
    input.action === "rule" &&
    input.sourceId &&
    input.targetId &&
    input.operator
  ) {
    const { data: scoped, count } = await db
      .from("survey_questions")
      .select("id", { count: "exact" })
      .eq("campaign_id", context.campaign.id)
      .in("id", [input.sourceId, input.targetId]);
    if (count !== 2 || scoped?.length !== 2)
      return NextResponse.json({ error: "INVALID_RULE" }, { status: 400 });
    await db.from("survey_question_rules").upsert(
      {
        campaign_id: context.campaign.id,
        source_question_id: input.sourceId,
        target_question_id: input.targetId,
        operator: input.operator,
        comparison_value: input.comparisonValue ?? 3,
        action: "SHOW",
        active: true,
        created_by: session.user.id,
      },
      { onConflict: "source_question_id,target_question_id,operator,action" },
    );
  }
  if (input.action === "duplicate" && existing) {
    const { data: question, error } = await db
      .from("survey_questions")
      .insert({
        organization_id: context.organization.id,
        unit_id: context.unit?.id ?? null,
        campaign_id: context.campaign.id,
        stable_key: `${existing.stable_key}_copy_${Date.now()}`,
        category: existing.category,
        question_type: existing.question_type,
        title: `${existing.title} (cópia)`,
        description: existing.description,
        required: existing.required,
        allow_na: existing.allow_na,
        sort_order: Number(existing.sort_order) + 1,
        created_by: session.user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    const version = Array.isArray(existing.survey_question_versions)
      ? existing.survey_question_versions[0]
      : existing.survey_question_versions;
    const { data: created } = await db
      .from("survey_question_versions")
      .insert({
        question_id: question.id,
        version_number: 1,
        category: version.category,
        question_type: version.question_type,
        title: `${version.title} (cópia)`,
        description: version.description,
        required: version.required,
        allow_na: version.allow_na,
        configuration: version.configuration,
        created_by: session.user.id,
      })
      .select("id")
      .single();
    await db
      .from("survey_questions")
      .update({ current_version_id: created!.id })
      .eq("id", question.id);
    const { data: sourceOptions } = await db
      .from("survey_question_options")
      .select("label,value,sort_order,active")
      .eq("version_id", version.id);
    if (sourceOptions?.length)
      await db.from("survey_question_options").insert(
        sourceOptions.map((option) => ({
          ...option,
          question_id: question.id,
          version_id: created!.id,
        })),
      );
  }
  if (input.action === "save" && input.version) {
    let questionId = existing?.id as string | undefined;
    if (!questionId) {
      const { count } = await db
        .from("survey_questions")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", context.campaign.id);
      const { data } = await db
        .from("survey_questions")
        .insert({
          organization_id: context.organization.id,
          unit_id: context.unit?.id ?? null,
          campaign_id: context.campaign.id,
          stable_key: `custom_${Date.now()}`,
          category: input.version.category,
          question_type: input.version.question_type,
          title: input.version.title,
          description: input.version.description ?? null,
          required: input.version.required,
          allow_na: input.version.allow_na,
          sort_order: count ?? 0,
          created_by: session.user.id,
        })
        .select("id")
        .single();
      questionId = data!.id;
    }
    const { data: latest } = await db
      .from("survey_question_versions")
      .select("version_number")
      .eq("question_id", questionId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: version, error } = await db
      .from("survey_question_versions")
      .insert({
        question_id: questionId,
        version_number: (latest?.version_number ?? 0) + 1,
        ...input.version,
        options: undefined,
        created_by: session.user.id,
      })
      .select("id")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });
    if (input.version.options.length)
      await db.from("survey_question_options").insert(
        input.version.options.map((option, index) => ({
          version_id: version.id,
          question_id: questionId,
          ...option,
          sort_order: index,
        })),
      );
    await db
      .from("survey_questions")
      .update({
        current_version_id: version.id,
        category: input.version.category,
        question_type: input.version.question_type,
        title: input.version.title,
        description: input.version.description ?? null,
        required: input.version.required,
        allow_na: input.version.allow_na,
        active: true,
        deleted_at: null,
        updated_at: new Date().toISOString(),
        updated_by: session.user.id,
      })
      .eq("id", questionId);
  }
  await auditSurveyAction({
    actorId: session.user.id,
    action:
      input.action === "save"
        ? existing
          ? "SURVEY_QUESTION_UPDATED"
          : "SURVEY_QUESTION_CREATED"
        : input.action === "toggle"
          ? input.active
            ? "SURVEY_QUESTION_ACTIVATED"
            : "SURVEY_QUESTION_DEACTIVATED"
          : input.action === "reorder"
            ? "SURVEY_QUESTION_REORDERED"
            : `SURVEY_QUESTION_${input.action.toUpperCase()}`,
    entityType: "survey_question",
    entityId: input.id ?? context.campaign.id,
    before: existing ?? null,
    after: input as unknown as Record<string, unknown>,
  });
  return NextResponse.json({ ok: true });
}
