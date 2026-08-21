import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { getAdminSession } from "@/lib/cms/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SCHEDULING_BUCKET } from "@/lib/scheduling/shared";
import { detectSchedulingMimeType } from "@/lib/scheduling/server";
import { sanitizeDownloadName } from "@/lib/scheduling/form-pdf";

const uuidSchema = z.string().uuid();

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
      },
    },
  );
}

function previewErrorResponse(
  requestId: string,
  documentId: string,
  message: string,
  status: number,
) {
  const downloadUrl = `/api/admin/solicitacoes/${requestId}/documentos/${documentId}/download`;
  return new NextResponse(
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Visualização indisponível</title><body style="font-family:system-ui;margin:0;background:#f5f7f8;color:#183237"><main style="max-width:38rem;margin:10vh auto;padding:2rem;background:white;border-radius:1.5rem"><h1 style="font-size:1.4rem">Não foi possível gerar a visualização deste arquivo.</h1><p>${message}</p><a href="${downloadUrl}" style="display:inline-block;margin-top:1rem;padding:.8rem 1.2rem;border-radius:999px;background:#176b65;color:white;text-decoration:none;font-weight:700">Baixar original</a></main></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function missingFileResponse() {
  return new NextResponse(
    '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Arquivo indisponível</title><body style="font-family:system-ui;margin:0;background:#f5f7f8;color:#183237"><main style="max-width:38rem;margin:10vh auto;padding:2rem;background:white;border-radius:1.5rem"><h1 style="font-size:1.4rem">⚠️ Arquivo indisponível</h1><p>Este arquivo foi removido anteriormente do armazenamento. Solicite o reenvio ao paciente.</p></main></body></html>',
    {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export async function serveAppointmentDocument(
  requestId: string,
  documentId: string,
  disposition: "inline" | "attachment",
) {
  const session = await getAdminSession();
  if (!session.user || !session.profile) {
    return errorResponse("Autenticação necessária.", 401);
  }
  if (!hasAdminPermission(session.profile, "scheduling.view")) {
    return errorResponse("Acesso negado.", 403);
  }
  if (
    !uuidSchema.safeParse(requestId).success ||
    !uuidSchema.safeParse(documentId).success
  ) {
    return errorResponse("Documento inválido.", 400);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return errorResponse("Serviço indisponível.", 503);

  const { data: document, error: documentError } = await admin
    .from("appointment_request_documents")
    .select(
      "id,appointment_request_id,storage_path,file_name,mime_type,preview_storage_path,preview_mime_type",
    )
    .eq("id", documentId)
    .eq("appointment_request_id", requestId)
    .maybeSingle();

  if (documentError || !document) {
    return errorResponse(
      "Documento não encontrado para esta solicitação.",
      404,
    );
  }

  const preferredPath =
    disposition === "inline" && document.preview_storage_path
      ? document.preview_storage_path
      : document.storage_path;
  let servedPreview = preferredPath === document.preview_storage_path;
  let { data: file, error: storageError } = await admin.storage
    .from(SCHEDULING_BUCKET)
    .download(preferredPath);
  if (
    disposition === "inline" &&
    document.preview_storage_path &&
    (storageError || !file)
  ) {
    const original = await admin.storage
      .from(SCHEDULING_BUCKET)
      .download(document.storage_path);
    file = original.data;
    storageError = original.error;
    servedPreview = false;
  }
  if (storageError || !file) {
    return missingFileResponse();
  }

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detectedMime = detectSchedulingMimeType(bytes);
  if (!detectedMime) {
    return disposition === "inline"
      ? previewErrorResponse(
          requestId,
          documentId,
          "Arquivo inválido ou corrompido.",
          422,
        )
      : errorResponse("Arquivo inválido ou corrompido.", 422);
  }
  const { error: auditError } = await admin.from("audit_logs").insert({
    actor_id: session.user.id,
    action:
      disposition === "attachment"
        ? "APPOINTMENT_DOCUMENT_DOWNLOADED"
        : "APPOINTMENT_DOCUMENT_VIEWED",
    entity_type: "appointment_request_document",
    entity_id: document.id,
    after_data: {
      appointment_request_id: requestId,
      document_id: document.id,
    },
  });
  if (auditError) {
    return errorResponse("Não foi possível registrar o acesso.", 503);
  }

  const originalName = sanitizeDownloadName(document.file_name, "documento");
  const fileName =
    disposition === "inline" && servedPreview && detectedMime === "image/webp"
      ? `${originalName.replace(/\.[^.]+$/, "")}-visualizacao.webp`
      : originalName;
  return new NextResponse(await file.arrayBuffer(), {
    headers: {
      "Content-Type": detectedMime,
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
      "Content-Length": String(file.size),
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
