import { z } from "zod";
import { requireAdmin } from "@/lib/cms/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeSchedulingText } from "@/lib/scheduling/shared";
import {
  buildConfirmationMessage,
  buildManualMessage,
  buildPendingMessage,
} from "@/lib/scheduling/communications/templates";
import {
  createCorrectionToken,
  queueAndSendSchedulingCommunication,
  retrySchedulingCommunication,
} from "@/lib/scheduling/communications/server";

export const dynamic = "force-dynamic";

const baseSchema = z.object({
  requestId: z.string().uuid(),
  operationId: z.string().uuid(),
  action: z.string().min(1),
});

function response(error: string, status: number) {
  return Response.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

const legacyStatus: Record<string, string> = {
  NOVO: "NEW",
  EM_ANALISE: "IN_REVIEW",
  AGUARDANDO_CONVENIO: "AUTHORIZATION_PENDING",
  PENDENCIA: "DOCUMENT_PENDING",
  RECUSADO: "DOCUMENT_PENDING",
  AUTORIZADO: "IN_REVIEW",
  CONCLUIDO: "COMPLETED",
  CANCELADO: "CANCELLED",
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return response("Requisição inválida.", 403);
  const { user, profile } = await requireAdmin([
    "reception",
    "admin",
    "super_admin",
  ]);
  const admin = createSupabaseAdminClient();
  if (!admin) return response("Serviço indisponível.", 503);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return response("Dados inválidos.", 400);
  }
  const parsed = baseSchema.safeParse(body);
  if (!parsed.success) return response("Dados inválidos.", 400);
  const { requestId, operationId, action } = parsed.data;
  const duplicate = await admin
    .from("appointment_request_history")
    .select("id")
    .eq("appointment_request_id", requestId)
    .contains("details", { operation_id: operationId })
    .maybeSingle();
  if (duplicate.data) return Response.json({ ok: true, duplicate: true });
  const { data: appointment } = await admin
    .from("appointment_requests")
    .select("*,appointment_request_exams(*)")
    .eq("id", requestId)
    .single();
  if (!appointment) return response("Solicitação não encontrada.", 404);
  if (
    profile.role === "reception" &&
    appointment.assigned_to &&
    appointment.assigned_to !== user.id &&
    action !== "claim"
  ) {
    return response("Esta solicitação está com outro atendente.", 409);
  }
  const history = async (
    label: string,
    details: Record<string, unknown> = {},
  ) => {
    await admin.from("appointment_request_history").insert({
      appointment_request_id: requestId,
      actor_id: user.id,
      action: label,
      details: { ...details, operation_id: operationId },
    });
  };
  const setWorkflow = async (
    workflow: string,
    extra: Record<string, unknown> = {},
  ) => {
    const { error } = await admin
      .from("appointment_requests")
      .update({
        workflow_status: workflow,
        status: legacyStatus[workflow],
        ...extra,
      })
      .eq("id", requestId);
    if (error) throw new Error("save_failed");
  };
  try {
    if (action === "claim") {
      if (appointment.workflow_status !== "NOVO")
        return response("Atendimento já assumido.", 409);
      const { data: claimed } = await admin
        .from("appointment_requests")
        .update({
          workflow_status: "EM_ANALISE",
          status: legacyStatus.EM_ANALISE,
          assigned_to: user.id,
          claimed_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("workflow_status", "NOVO")
        .or(`assigned_to.is.null,assigned_to.eq.${user.id}`)
        .select("id")
        .maybeSingle();
      if (!claimed) return response("Atendimento já assumido.", 409);
      await history("Atendimento assumido", { attendant: profile.full_name });
      return Response.json({ ok: true, message: "Atendimento assumido." });
    }
    if (action === "update_contact") {
      const email = z.string().trim().email().safeParse(body.email);
      if (!email.success) return response("Informe um e-mail válido.", 400);
      await admin
        .from("appointment_requests")
        .update({ email: email.data })
        .eq("id", requestId);
      await history("Contato do paciente atualizado");
      return Response.json({ ok: true, message: "Contato atualizado." });
    }
    if (action === "wait_insurance") {
      const reference = sanitizeSchedulingText(body.reference, 120) || null;
      await setWorkflow("AGUARDANDO_CONVENIO", {
        insurer_reference: reference,
      });
      await history("Enviado ao convênio", { reference });
      return Response.json({
        ok: true,
        message: "Solicitação enviada ao convênio.",
      });
    }
    if (action === "pending" || action === "rejected") {
      const reason = sanitizeSchedulingText(body.reason, 300);
      const correction = sanitizeSchedulingText(body.correction, 800);
      const guidance = sanitizeSchedulingText(body.guidance, 1200);
      if (!reason || !correction || !guidance)
        return response("Preencha a orientação ao paciente.", 400);
      if (!appointment.email)
        return response(
          "Cadastre o e-mail do paciente antes de avisá-lo.",
          400,
        );
      const token = await createCorrectionToken(admin, requestId);
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://inneuroap.com.br";
      const message = buildPendingMessage({
        name: appointment.patient_name,
        protocol: appointment.protocol,
        exams: appointment.appointment_request_exams
          .map((exam: { exam_name: string }) => exam.exam_name)
          .join(", "),
        insurance:
          appointment.insurance_name ||
          (appointment.service_type === "PARTICULAR"
            ? "Particular"
            : "Não informado"),
        reason,
        correction,
        guidance,
        correctionUrl: new URL(
          `/solicitacao/corrigir/${token}`,
          siteUrl,
        ).toString(),
        rejected: action === "rejected",
      });
      const workflow = action === "rejected" ? "RECUSADO" : "PENDENCIA";
      await setWorkflow(workflow, {
        pending_reason: reason,
        pending_correction: correction,
        pending_guidance: guidance,
        documents_received_at: null,
      });
      await history(
        action === "rejected"
          ? "Recusa do convênio informada"
          : "Pendência informada",
        { reason, correction, guidance },
      );
      const communication = await queueAndSendSchedulingCommunication({
        admin,
        requestId,
        actorId: user.id,
        type: action === "rejected" ? "INSURANCE_REJECTED" : "PENDING",
        recipient: appointment.email,
        message,
        idempotencyKey: `${requestId}:${action}:${operationId}`,
      });
      await history(
        communication?.status === "SENT"
          ? "Paciente avisado por e-mail"
          : "Falha ao avisar paciente por e-mail",
      );
      return Response.json({
        ok: true,
        message:
          communication?.status === "SENT"
            ? "Pendência registrada e paciente avisado."
            : "Pendência registrada. O e-mail precisa ser reenviado.",
      });
    }
    if (action === "authorize") {
      const number =
        sanitizeSchedulingText(body.authorizationNumber, 120) || null;
      const validity = z
        .string()
        .date()
        .or(z.literal(""))
        .safeParse(body.validUntil ?? "");
      if (!validity.success) return response("Validade inválida.", 400);
      await setWorkflow("AUTORIZADO", {
        authorization_number: number,
        authorization_valid_until: validity.data || null,
        authorization_pending: false,
      });
      await history("Convênio autorizado", {
        authorization_number: number,
        valid_until: validity.data || null,
      });
      return Response.json({ ok: true, message: "Convênio autorizado." });
    }
    if (action === "complete") {
      const schedules = z
        .array(
          z.object({
            examId: z.string().uuid(),
            date: z.string().date(),
            time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
            preparation: z.string().max(5000),
            documents: z.array(z.string().min(1).max(200)).max(20),
          }),
        )
        .min(1)
        .safeParse(body.schedules);
      if (
        !schedules.success ||
        schedules.data.length !== appointment.appointment_request_exams.length
      )
        return response("Preencha data e horário de todos os exames.", 400);
      if (!appointment.email)
        return response(
          "Cadastre o e-mail do paciente antes de concluir.",
          400,
        );
      for (const schedule of schedules.data) {
        const belongs = appointment.appointment_request_exams.some(
          (exam: { id: string }) => exam.id === schedule.examId,
        );
        if (!belongs) return response("Exame inválido.", 400);
        const { error } = await admin
          .from("appointment_request_exams")
          .update({
            status: "SCHEDULED",
            scheduled_date: schedule.date,
            scheduled_time: `${schedule.time}:00`,
            scheduled_period: null,
            preparation_text: schedule.preparation,
            documents_to_bring: schedule.documents,
          })
          .eq("id", schedule.examId)
          .eq("appointment_request_id", requestId);
        if (error) throw new Error("save_failed");
      }
      await setWorkflow("CONCLUIDO", {
        completed_at: new Date().toISOString(),
        documents_received_at: null,
      });
      await history("Agendamento concluído", {
        exams: schedules.data.map(({ examId, date, time }) => ({
          exam_id: examId,
          date,
          time,
        })),
      });
      const formatDate = (value: string) =>
        new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
      const message = buildConfirmationMessage({
        name: appointment.patient_name,
        protocol: appointment.protocol,
        unit: appointment.unit_name,
        exams: schedules.data.map((schedule) => ({
          name:
            appointment.appointment_request_exams.find(
              (exam: { id: string }) => exam.id === schedule.examId,
            )?.exam_name || "Exame",
          date: formatDate(schedule.date),
          time: schedule.time,
          preparation: schedule.preparation,
        })),
        documents: [
          ...new Set(schedules.data.flatMap((schedule) => schedule.documents)),
        ],
      });
      const communication = await queueAndSendSchedulingCommunication({
        admin,
        requestId,
        actorId: user.id,
        type: "SCHEDULE_CONFIRMED",
        recipient: appointment.email,
        message,
        idempotencyKey: `${requestId}:complete:${operationId}`,
      });
      await history(
        communication?.status === "SENT"
          ? "Confirmação enviada ao paciente"
          : "Falha ao enviar confirmação",
      );
      return Response.json({
        ok: true,
        message:
          communication?.status === "SENT"
            ? "Agendamento concluído e paciente avisado."
            : "Agendamento concluído. O e-mail precisa ser reenviado.",
      });
    }
    if (action === "manual") {
      if (!appointment.email)
        return response("Cadastre o e-mail do paciente antes de enviar.", 400);
      const subject = sanitizeSchedulingText(body.subject, 160),
        messageBody = String(body.message ?? "")
          .trim()
          .slice(0, 5000);
      if (!subject || !messageBody)
        return response("Preencha assunto e mensagem.", 400);
      const communication = await queueAndSendSchedulingCommunication({
        admin,
        requestId,
        actorId: user.id,
        type: sanitizeSchedulingText(body.type, 40) || "CUSTOM",
        recipient: appointment.email,
        message: buildManualMessage({ subject, body: messageBody }),
        idempotencyKey: `${requestId}:manual:${operationId}`,
      });
      await history(
        communication?.status === "SENT"
          ? "Mensagem enviada ao paciente"
          : "Falha ao enviar mensagem",
        { subject },
      );
      return Response.json({
        ok: true,
        message:
          communication?.status === "SENT"
            ? "Mensagem enviada."
            : "Não foi possível enviar. Use reenviar.",
      });
    }
    if (action === "retry") {
      const communicationId = z.string().uuid().safeParse(body.communicationId);
      if (!communicationId.success) return response("Mensagem inválida.", 400);
      await retrySchedulingCommunication(communicationId.data);
      await history("Reenvio de mensagem solicitado", {
        communication_id: communicationId.data,
      });
      return Response.json({ ok: true, message: "Reenvio processado." });
    }
    return response("Ação inválida.", 400);
  } catch {
    return response("Não foi possível concluir. Tente novamente.", 500);
  }
}
