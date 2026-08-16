import { NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { getAdminSession } from "@/lib/cms/auth";
import {
  buildSchedulingFormPdf,
  schedulingFormFileName,
  type SchedulingFormData,
} from "@/lib/scheduling/form-pdf";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session.user || !session.profile) {
    return errorResponse("Autenticação necessária.", 401);
  }
  if (!hasAdminPermission(session.profile, "scheduling.view")) {
    return errorResponse("Acesso negado.", 403);
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return errorResponse("Solicitação inválida.", 400);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return errorResponse("Serviço indisponível.", 503);

  const { data, error } = await admin
    .from("appointment_requests")
    .select(
      "id,protocol,patient_name,cpf,birth_date,phone,email,service_type,insurance_name,insurance_card_number,insurance_card_expiry,insurer_reference,authorization_number,authorization_valid_until,preferred_dates,preferred_periods,notes,workflow_status,claimed_at,completed_at,created_at,unit_name,assigned:profiles!assigned_to(full_name),completed:profiles!appointment_requests_completed_by_fkey(full_name),appointment_request_exams(exam_name,modality,scheduled_date,scheduled_time,preparation_text,documents_to_bring),appointment_request_documents(document_type,file_name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return errorResponse("Solicitação não encontrada.", 404);
  }

  const pdf = await buildSchedulingFormPdf(data as SchedulingFormData);
  const { error: auditError } = await admin.from("audit_logs").insert({
    actor_id: session.user.id,
    action: "APPOINTMENT_FORM_DOWNLOADED",
    entity_type: "appointment_request",
    entity_id: id,
    after_data: { appointment_request_id: id },
  });
  if (auditError) {
    return errorResponse("Não foi possível registrar o download.", 503);
  }

  return new NextResponse(Uint8Array.from(pdf).buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${schedulingFormFileName(data.protocol, data.patient_name)}"`,
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
