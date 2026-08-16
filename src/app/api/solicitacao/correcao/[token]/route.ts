import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  allowedMimeTypes,
  MAX_FILE_SIZE,
  SCHEDULING_BUCKET,
} from "@/lib/scheduling/shared";

export const dynamic = "force-dynamic";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function detect(bytes: Uint8Array) {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  )
    return "application/pdf";
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

function fail(request: Request, token: string, code: string) {
  return Response.redirect(
    new URL(`/solicitacao/corrigir/${token}?error=${code}`, request.url),
    303,
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!sameOrigin(request) || !/^[A-Za-z0-9_-]{40,64}$/.test(token))
    return fail(request, token, "invalid");
  const admin = createSupabaseAdminClient();
  if (!admin) return fail(request, token, "config");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: access } = await admin
    .from("appointment_request_patient_tokens")
    .select("id,appointment_request_id,expires_at,used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!access || access.used_at || Date.parse(access.expires_at) <= Date.now())
    return fail(request, token, "expired");
  const form = await request.formData();
  const files = form
    .getAll("documents")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const information = String(form.get("additional_information") ?? "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 1000);
  if ((!files.length && !information) || files.length > 5)
    return fail(request, token, "validation");
  const uploaded: string[] = [];
  try {
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) throw new Error("size");
      const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      const mime = detect(bytes);
      if (
        !mime ||
        !(allowedMimeTypes as readonly string[]).includes(mime) ||
        mime !== file.type.toLowerCase()
      )
        throw new Error("type");
      const extension =
        mime === "application/pdf"
          ? "pdf"
          : mime === "image/jpeg"
            ? "jpg"
            : mime === "image/png"
              ? "png"
              : "webp";
      const path = `corrections/${access.appointment_request_id}/${randomUUID()}.${extension}`;
      const { error: uploadError } = await admin.storage
        .from(SCHEDULING_BUCKET)
        .upload(path, file, {
          contentType: mime,
          cacheControl: "0",
          upsert: false,
        });
      if (uploadError) throw new Error("upload");
      uploaded.push(path);
      const { error: saveError } = await admin
        .from("appointment_request_documents")
        .insert({
          appointment_request_id: access.appointment_request_id,
          document_type: "other",
          storage_path: path,
          file_name: file.name.slice(0, 180),
          mime_type: mime,
          file_size: file.size,
          source: "PATIENT_CORRECTION",
        });
      if (saveError) throw new Error("save");
    }
    const now = new Date().toISOString();
    await admin
      .from("appointment_requests")
      .update({
        workflow_status: "EM_ANALISE",
        status: "IN_REVIEW",
        documents_received_at: now,
      })
      .eq("id", access.appointment_request_id);
    await admin
      .from("appointment_request_patient_tokens")
      .update({ used_at: now })
      .eq("id", access.id);
    await admin.from("appointment_request_history").insert({
      appointment_request_id: access.appointment_request_id,
      actor_id: null,
      action: "Paciente enviou documentação para correção da pendência.",
      details: {
        file_count: files.length,
        additional_information: information || null,
      },
    });
    revalidatePath("/admin/solicitacoes");
    return Response.redirect(
      new URL(`/solicitacao/corrigir/${token}?status=received`, request.url),
      303,
    );
  } catch {
    if (uploaded.length)
      await admin.storage.from(SCHEDULING_BUCKET).remove(uploaded);
    return fail(request, token, "upload");
  }
}
