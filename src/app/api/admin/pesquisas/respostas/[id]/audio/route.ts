import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/cms/auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import {
  getSurveyAdminContext,
  SURVEY_AUDIO_BUCKET,
} from "@/lib/surveys/server";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (
    !session.user ||
    !session.profile ||
    !hasAdminPermission(session.profile, "surveys.view")
  )
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const context = await getSurveyAdminContext(session.user.id);
  if (!context)
    return NextResponse.json({ error: "NO_SCOPE" }, { status: 403 });
  const { id } = await params;
  const { data } = await context.admin
    .from("survey_feedback")
    .select(
      "audio_storage_path,survey_responses!inner(organization_id,unit_id)",
    )
    .eq("response_id", id)
    .maybeSingle();
  const parent = Array.isArray(data?.survey_responses)
    ? data.survey_responses[0]
    : data?.survey_responses;
  if (
    !data?.audio_storage_path ||
    parent?.organization_id !== context.organization.id ||
    (context.unit && parent?.unit_id !== context.unit.id)
  )
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const signed = await context.admin.storage
    .from(SURVEY_AUDIO_BUCKET)
    .createSignedUrl(data.audio_storage_path, 120);
  if (!signed.data?.signedUrl)
    return NextResponse.json({ error: "AUDIO_ERROR" }, { status: 500 });
  return NextResponse.redirect(signed.data.signedUrl);
}
