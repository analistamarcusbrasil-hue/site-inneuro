import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import {
  ReceptionCenter,
  type ReceptionRequest,
} from "@/components/admin/reception-center";
import { requireAdminPermission } from "@/lib/cms/auth";
import { defaultDocumentsToBring } from "@/lib/scheduling/operations";

function preparationText(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((group) => {
      if (!group || typeof group !== "object") return "";
      const item = group as {
        title?: unknown;
        instructions?: unknown;
        warning?: unknown;
      };
      return [
        typeof item.title === "string" ? item.title : "",
        ...(Array.isArray(item.instructions)
          ? item.instructions.map(String)
          : []),
        typeof item.warning === "string" ? item.warning : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

export default async function AppointmentRequestsPage() {
  const { supabase, user, profile } =
    await requireAdminPermission("scheduling.view");
  const [{ data, error }, { data: exams }, { data: preparations }] =
    await Promise.all([
      supabase
        .from("appointment_requests")
        .select(
          "id,protocol,patient_name,cpf,phone,email,service_type,insurance_name,insurance_card_number,workflow_status,assigned_to,claimed_at,insurer_reference,authorization_number,authorization_valid_until,pending_reason,pending_correction,pending_guidance,documents_received_at,unit_name,created_at,updated_at,assigned:profiles!assigned_to(full_name),appointment_request_exams(id,exam_name,exam_id,modality,scheduled_date,scheduled_time,preparation_text,documents_to_bring),appointment_request_documents(id,document_type,file_name,checked_at,source,created_at),appointment_request_history(id,action,details,created_at),appointment_request_communications(id,subject,text_body,status,attempt_count,created_at,sent_at)",
        )
        .order("documents_received_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(300),
      supabase.from("exams").select("id,preparation_slug"),
      supabase.from("preparations").select("slug,preparation_groups,documents"),
    ]);
  const preparationBySlug = new Map(
    (preparations ?? []).map((item) => [
      item.slug,
      {
        text: preparationText(item.preparation_groups),
        documents: Array.isArray(item.documents)
          ? item.documents.map(String)
          : [],
      },
    ]),
  );
  const slugByExam = new Map(
    (exams ?? []).map((exam) => [exam.id, exam.preparation_slug]),
  );
  const rows = (data ?? []).map((request) => ({
    ...request,
    appointment_request_exams: (request.appointment_request_exams ?? []).map(
      (exam: { exam_id: string | null }) => {
        const official = exam.exam_id
          ? preparationBySlug.get(slugByExam.get(exam.exam_id) ?? "")
          : null;
        return {
          ...exam,
          automatic_preparation: official?.text ?? "",
          automatic_documents: [
            ...new Set([
              ...defaultDocumentsToBring(request.service_type),
              ...(official?.documents ?? []),
            ]),
          ],
        };
      },
    ),
  })) as ReceptionRequest[];

  return (
    <>
      <AdminPageHeading
        eyebrow="Recepção"
        title="Fila de agendamentos"
        description="Assuma, analise, avise o paciente e conclua o agendamento sem sair da fila."
      />
      {error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-xl p-4 font-bold"
        >
          Não foi possível carregar a fila. A atualização do banco pode estar
          pendente.
        </p>
      ) : null}
      <ReceptionCenter
        requests={rows}
        currentUser={{ id: user.id, name: profile.full_name || "Atendente" }}
      />
    </>
  );
}
