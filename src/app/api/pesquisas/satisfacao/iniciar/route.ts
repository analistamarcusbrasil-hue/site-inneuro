import { z } from "zod";
import {
  createSurveyResponseToken,
  getSurveyPublicDefinition,
  getSurveyServiceClient,
  hashSurveyToken,
} from "@/lib/surveys/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = z
    .object({ token: z.string().min(48).max(160) })
    .safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json({ error: "Pesquisa indisponível." }, { status: 400 });
  const survey = await getSurveyPublicDefinition(body.data.token);
  if (!survey)
    return Response.json({ error: "Pesquisa indisponível." }, { status: 404 });
  const admin = getSurveyServiceClient();
  const responseToken = createSurveyResponseToken();
  const { data: response, error } = await admin
    .from("survey_responses")
    .insert({
      organization_id: survey.organization.id,
      unit_id: survey.unit?.id ?? null,
      campaign_id: survey.campaign.id,
      qr_code_id: survey.qrCode.id,
      access_token_hash: hashSurveyToken(responseToken),
    })
    .select("id")
    .single();
  if (error || !response)
    return Response.json(
      { error: "Não foi possível iniciar agora." },
      { status: 503 },
    );
  await admin.from("survey_events").insert({
    organization_id: survey.organization.id,
    unit_id: survey.unit?.id ?? null,
    campaign_id: survey.campaign.id,
    qr_code_id: survey.qrCode.id,
    response_id: response.id,
    event_type: "STARTED",
  });
  return Response.json(
    { responseId: response.id, responseToken },
    { headers: { "Cache-Control": "no-store" } },
  );
}
