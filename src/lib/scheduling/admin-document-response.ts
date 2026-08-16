import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { getAdminSession } from "@/lib/cms/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SCHEDULING_BUCKET } from "@/lib/scheduling/shared";
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
    .select("id,appointment_request_id,storage_path,file_name,mime_type")
    .eq("id", documentId)
    .eq("appointment_request_id", requestId)
    .maybeSingle();

  if (documentError || !document) {
    return errorResponse(
      "Documento não encontrado para esta solicitação.",
      404,
    );
  }

  const { data: file, error: storageError } = await admin.storage
    .from(SCHEDULING_BUCKET)
    .download(document.storage_path);
  if (storageError || !file) {
    return errorResponse("Arquivo não encontrado ou indisponível.", 404);
  }

  if (disposition === "attachment") {
    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "APPOINTMENT_DOCUMENT_DOWNLOADED",
      entity_type: "appointment_request_document",
      entity_id: document.id,
      after_data: {
        appointment_request_id: requestId,
        document_id: document.id,
      },
    });
    if (auditError) {
      return errorResponse("Não foi possível registrar o download.", 503);
    }
  }

  const fileName = sanitizeDownloadName(document.file_name, "documento");
  return new NextResponse(await file.arrayBuffer(), {
    headers: {
      "Content-Type": document.mime_type || "application/octet-stream",
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
