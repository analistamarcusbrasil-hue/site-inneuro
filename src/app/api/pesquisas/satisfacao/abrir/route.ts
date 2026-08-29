import { z } from "zod";
import {
  getSurveyPublicDefinition,
  getSurveyServiceClient,
} from "@/lib/surveys/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = z
    .object({ token: z.string().min(48).max(160) })
    .safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json({ ok: false }, { status: 400 });
  const survey = await getSurveyPublicDefinition(body.data.token);
  if (!survey) return Response.json({ ok: false }, { status: 404 });
  const admin = getSurveyServiceClient();
  await admin.from("survey_events").insert({
    organization_id: survey.organization.id,
    unit_id: survey.unit?.id ?? null,
    campaign_id: survey.campaign.id,
    qr_code_id: survey.qrCode.id,
    event_type: "OPENED",
  });
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
