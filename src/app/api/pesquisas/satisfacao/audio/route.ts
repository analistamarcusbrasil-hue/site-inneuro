import { randomBytes } from "node:crypto";
import {
  getSurveyServiceClient,
  SURVEY_AUDIO_BUCKET,
  surveyTokenMatches,
} from "@/lib/surveys/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const allowedTypes = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
]);

export async function POST(request: Request) {
  const form = await request.formData();
  const responseId = String(form.get("responseId") ?? "");
  const responseToken = String(form.get("responseToken") ?? "");
  const duration = Number(form.get("duration") ?? 0);
  const audio = form.get("audio");
  if (
    !/^[0-9a-f-]{36}$/i.test(responseId) ||
    responseToken.length < 32 ||
    !(audio instanceof File) ||
    !allowedTypes.has(audio.type) ||
    audio.size < 1 ||
    audio.size > 8 * 1024 * 1024 ||
    !Number.isFinite(duration) ||
    duration < 1 ||
    duration > 90
  )
    return Response.json({ error: "Áudio inválido." }, { status: 400 });
  const admin = getSurveyServiceClient();
  const { data: response } = await admin
    .from("survey_responses")
    .select("id,organization_id,access_token_hash,status")
    .eq("id", responseId)
    .maybeSingle();
  if (
    !response ||
    response.status !== "STARTED" ||
    !surveyTokenMatches(responseToken, response.access_token_hash)
  )
    return Response.json({ error: "Sessão inválida." }, { status: 403 });
  const extension =
    audio.type === "audio/ogg"
      ? "ogg"
      : audio.type === "audio/mp4"
        ? "m4a"
        : audio.type === "audio/mpeg"
          ? "mp3"
          : "webm";
  const path = `${response.organization_id}/${response.id}/feedback-${randomBytes(12).toString("hex")}.${extension}`;
  const { error } = await admin.storage
    .from(SURVEY_AUDIO_BUCKET)
    .upload(path, Buffer.from(await audio.arrayBuffer()), {
      contentType: audio.type,
      upsert: false,
      cacheControl: "0",
    });
  if (error)
    return Response.json(
      { error: "Não foi possível salvar o áudio." },
      { status: 503 },
    );
  return Response.json(
    { path, mimeType: audio.type, duration: Math.round(duration) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
