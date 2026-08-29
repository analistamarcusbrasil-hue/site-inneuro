import { z } from "zod";
import {
  getSurveyServiceClient,
  hashSurveyToken,
  SURVEY_AUDIO_BUCKET,
} from "@/lib/surveys/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  responseId: z.string().uuid(),
  responseToken: z.string().min(32).max(200),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        questionVersionId: z.string().uuid(),
        numericValue: z.number().min(0).max(10).optional(),
        textValue: z.string().max(1500).optional(),
        optionValue: z.union([z.string(), z.array(z.string()).max(20)]).optional(),
        notApplicable: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(30),
  feedback: z.object({
    mode: z.enum(["TEXT", "AUDIO", "NONE"]),
    textContent: z.string().max(1500).optional(),
    audioStoragePath: z.string().max(500).optional(),
    audioMimeType: z.string().max(80).optional(),
    audioDurationSeconds: z.number().int().min(1).max(90).optional(),
  }),
  contact: z.object({
    wantsContact: z.boolean(),
    name: z.string().max(100).optional(),
    phone: z.string().max(30).optional(),
  }),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Revise as respostas antes de enviar." },
      { status: 400 },
    );
  const admin = getSurveyServiceClient();
  const payload = parsed.data;
  const { data, error } = await admin.rpc("complete_survey_response", {
    p_response_id: payload.responseId,
    p_access_token_hash: hashSurveyToken(payload.responseToken),
    p_answers: payload.answers,
    p_feedback: payload.feedback,
    p_contact: payload.contact,
  });
  if (error) {
    if (payload.feedback.audioStoragePath)
      await admin.storage
        .from(SURVEY_AUDIO_BUCKET)
        .remove([payload.feedback.audioStoragePath]);
    const invalid =
      error.message.includes("required_answers") ||
      error.message.includes("contact_check") ||
      error.message.includes("feedback_content");
    return Response.json(
      {
        error: invalid
          ? "Revise os campos obrigatórios antes de enviar."
          : "Não foi possível enviar sua avaliação agora.",
      },
      { status: invalid ? 400 : 503 },
    );
  }
  return Response.json(
    { ok: true, result: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
