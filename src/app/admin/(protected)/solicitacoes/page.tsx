import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import {
  SchedulingCommandCenter,
  type SchedulingFilterOptions,
  type SchedulingMetrics,
  type SchedulingQueryState,
} from "@/components/admin/scheduling-command-center";
import type { ReceptionRequest } from "@/components/admin/reception-center";
import { requireAdminPermission } from "@/lib/cms/auth";
import {
  canOverrideSchedulingAssignment,
  hasAdminPermission,
} from "@/lib/admin/permissions";
import { defaultDocumentsToBring } from "@/lib/scheduling/operations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 25;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requestSelect =
  "id,protocol,patient_name,cpf,birth_date,phone,email,service_type,insurance_name,insurance_card_number,insurance_card_expiry,preferred_dates,preferred_periods,notes,workflow_status,assigned_to,claimed_at,first_contact_at,follow_up_at,operational_outcome_reason,operational_outcome_note,scheduling_note,insurer_reference,authorization_number,authorization_valid_until,pending_reason,pending_correction,pending_guidance,documents_received_at,unit_name,confirmation_status,confirmation_communication_id,not_schedulable_reason,not_schedulable_detail,not_schedulable_guidance,not_schedulable_communication_status,not_schedulable_communication_id,completed_by,completed_at,created_at,updated_at,assigned:profiles!assigned_to(full_name),completed:profiles!appointment_requests_completed_by_fkey(full_name),appointment_request_exams(id,exam_name,exam_id,modality,status,scheduled_date,scheduled_time,preparation_text,documents_to_bring,not_schedulable_reason,not_schedulable_detail,not_schedulable_guidance,not_schedulable_at),appointment_request_documents(id,document_type,file_name,checked_at,checked_by,source,created_at),appointment_request_history(id,action,details,created_at),appointment_request_communications!appointment_request_communications_appointment_request_id_fkey(id,communication_type,subject,text_body,status,attempt_count,created_at,sent_at),appointment_request_contact_attempts(id,contact_type,result,note,follow_up_at,created_at,actor:profiles!actor_id(full_name))";

function first(value: string | string[] | undefined, fallback = "") {
  return (Array.isArray(value) ? value[0] : value)?.trim() || fallback;
}

function safeSearch(value: string) {
  return value
    .replace(/[,()%_'"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function uniqueText(values: Array<string | null | undefined>) {
  return [
    ...new Set(values.map((item) => item?.trim()).filter(Boolean) as string[]),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

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

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function AppointmentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedId = uuidPattern.test(first(params.solicitacao))
    ? first(params.solicitacao)
    : null;
  const page = Math.max(1, Number.parseInt(first(params.page, "1"), 10) || 1);
  const queryState: SchedulingQueryState = {
    query: first(params.q),
    status: first(params.status, "all"),
    scope: first(params.scope, "general"),
    sort: first(params.sort, "priority"),
    from: first(params.from),
    to: first(params.to),
    insurance: first(params.insurance),
    modality: first(params.modality),
    responsible: first(params.responsible),
    unit: first(params.unit),
    reason: first(params.reason),
  };

  const { supabase, user, profile } =
    await requireAdminPermission("scheduling.view");
  const dataClient = createSupabaseAdminClient() ?? supabase;

  const normalizedSearch = safeSearch(queryState.query);
  const [examMatches, modalityMatches] = await Promise.all([
    normalizedSearch
      ? dataClient
          .from("appointment_request_exams")
          .select("appointment_request_id")
          .ilike("exam_name", `%${normalizedSearch}%`)
          .limit(150)
      : Promise.resolve({
          data: [] as Array<{ appointment_request_id: string }>,
        }),
    queryState.modality
      ? dataClient
          .from("appointment_request_exams")
          .select("appointment_request_id")
          .eq("modality", queryState.modality)
          .limit(2000)
      : Promise.resolve({
          data: [] as Array<{ appointment_request_id: string }>,
        }),
  ]);
  const examRequestIds = uniqueText(
    (examMatches.data ?? []).map((item) => item.appointment_request_id),
  );
  const modalityRequestIds = uniqueText(
    (modalityMatches.data ?? []).map((item) => item.appointment_request_id),
  );

  let listQuery = dataClient
    .from("appointment_requests")
    .select(requestSelect, { count: "exact" })
    .is("deleted_at", null);
  if (queryState.status === "waiting")
    listQuery = listQuery.eq("workflow_status", "NOVO");
  if (queryState.status === "in_service")
    listQuery = listQuery.in("workflow_status", [
      "EM_ANALISE",
      "AGUARDANDO_CONVENIO",
      "PENDENCIA",
      "RECUSADO",
      "AUTORIZADO",
    ]);
  if (queryState.status === "scheduled")
    listQuery = listQuery.eq("workflow_status", "CONCLUIDO");
  if (queryState.status === "unscheduled")
    listQuery = listQuery.in("workflow_status", ["NAO_AGENDAVEL", "CANCELADO"]);
  if (queryState.scope === "mine")
    listQuery = listQuery.eq("assigned_to", user.id);
  if (queryState.insurance)
    listQuery = listQuery.eq("insurance_name", queryState.insurance);
  if (queryState.unit) listQuery = listQuery.eq("unit_name", queryState.unit);
  if (queryState.reason)
    listQuery = listQuery.eq("operational_outcome_reason", queryState.reason);
  if (queryState.responsible === "unassigned")
    listQuery = listQuery.is("assigned_to", null);
  else if (uuidPattern.test(queryState.responsible))
    listQuery = listQuery.eq("assigned_to", queryState.responsible);
  if (queryState.from)
    listQuery = listQuery.gte(
      "created_at",
      `${queryState.from}T00:00:00-03:00`,
    );
  if (queryState.to)
    listQuery = listQuery.lte("created_at", `${queryState.to}T23:59:59-03:00`);
  if (queryState.modality)
    listQuery = listQuery.in(
      "id",
      modalityRequestIds.length
        ? modalityRequestIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  if (normalizedSearch) {
    const directFilters = [
      `patient_name.ilike.%${normalizedSearch}%`,
      `cpf.ilike.%${normalizedSearch}%`,
      `phone.ilike.%${normalizedSearch}%`,
      `protocol.ilike.%${normalizedSearch}%`,
      `insurance_name.ilike.%${normalizedSearch}%`,
    ];
    if (examRequestIds.length)
      directFilters.push(`id.in.(${examRequestIds.join(",")})`);
    listQuery = listQuery.or(directFilters.join(","));
  }

  if (queryState.sort === "newest")
    listQuery = listQuery.order("created_at", { ascending: false });
  else if (queryState.sort === "name")
    listQuery = listQuery.order("patient_name", { ascending: true });
  else if (queryState.sort === "status")
    listQuery = listQuery
      .order("workflow_status", { ascending: true })
      .order("created_at", { ascending: true });
  else if (queryState.sort === "responsible")
    listQuery = listQuery
      .order("assigned_to", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
  else if (queryState.sort === "oldest")
    listQuery = listQuery.order("created_at", { ascending: true });
  else
    listQuery = listQuery
      .order("follow_up_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

  const rangeFrom = (page - 1) * PAGE_SIZE;
  listQuery = listQuery.range(rangeFrom, rangeFrom + PAGE_SIZE - 1);

  const [
    listResult,
    examsResult,
    preparationsResult,
    profilesResult,
    optionRequestsResult,
    optionExamsResult,
    indicatorsResult,
    waitingCount,
    inServiceCount,
    scheduledCount,
    unscheduledCount,
  ] = await Promise.all([
    listQuery,
    dataClient.from("exams").select("id,preparation_slug"),
    dataClient.from("preparations").select("slug,preparation_groups,documents"),
    dataClient
      .from("profiles")
      .select("id,full_name,role,active")
      .eq("active", true)
      .in("role", ["super_admin", "admin", "reception"])
      .order("full_name"),
    dataClient
      .from("appointment_requests")
      .select("insurance_name,unit_name")
      .is("deleted_at", null)
      .limit(1500),
    dataClient.from("appointment_request_exams").select("modality").limit(1500),
    dataClient.rpc("get_scheduling_indicators", {
      p_from: null,
      p_to: null,
    }),
    dataClient
      .from("appointment_requests")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("workflow_status", "NOVO"),
    dataClient
      .from("appointment_requests")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .in("workflow_status", [
        "EM_ANALISE",
        "AGUARDANDO_CONVENIO",
        "PENDENCIA",
        "RECUSADO",
        "AUTORIZADO",
      ]),
    dataClient
      .from("appointment_requests")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("workflow_status", "CONCLUIDO"),
    dataClient
      .from("appointment_requests")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .in("workflow_status", ["NAO_AGENDAVEL", "CANCELADO"]),
  ]);

  const requestRows = [...(listResult.data ?? [])];
  let initialSelectionMissing = Boolean(params.solicitacao && !requestedId);
  if (requestedId && !requestRows.some((item) => item.id === requestedId)) {
    const { data: requested } = await dataClient
      .from("appointment_requests")
      .select(requestSelect)
      .eq("id", requestedId)
      .is("deleted_at", null)
      .maybeSingle();
    if (requested) requestRows.push(requested);
    else initialSelectionMissing = true;
  }

  const preparationBySlug = new Map(
    (preparationsResult.data ?? []).map((item) => [
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
    (examsResult.data ?? []).map((exam) => [exam.id, exam.preparation_slug]),
  );
  const rows = requestRows.map((request) => ({
    ...request,
    appointment_request_contact_attempts:
      request.appointment_request_contact_attempts ?? [],
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

  const rawIndicators = (indicatorsResult.data ?? {}) as Record<
    string,
    unknown
  >;
  const fallbackTotal =
    (waitingCount.count ?? 0) +
    (inServiceCount.count ?? 0) +
    (scheduledCount.count ?? 0) +
    (unscheduledCount.count ?? 0);
  const metrics: SchedulingMetrics = {
    total: numberValue(rawIndicators.total) || fallbackTotal,
    waiting: numberValue(rawIndicators.waiting) || waitingCount.count || 0,
    inService:
      numberValue(rawIndicators.in_service) || inServiceCount.count || 0,
    pendingFollowUps: numberValue(rawIndicators.pending_follow_ups),
    scheduledToday: numberValue(rawIndicators.scheduled_today),
    scheduled:
      numberValue(rawIndicators.scheduled) || scheduledCount.count || 0,
    unscheduled:
      numberValue(rawIndicators.unscheduled) || unscheduledCount.count || 0,
    averageFirstContactMinutes:
      rawIndicators.average_first_contact_minutes == null
        ? null
        : numberValue(rawIndicators.average_first_contact_minutes),
    averageCompletionMinutes:
      rawIndicators.average_completion_minutes == null
        ? null
        : numberValue(rawIndicators.average_completion_minutes),
    reasons: Array.isArray(rawIndicators.reasons)
      ? (rawIndicators.reasons as SchedulingMetrics["reasons"])
      : [],
    responsibles: Array.isArray(rawIndicators.responsibles)
      ? (rawIndicators.responsibles as SchedulingMetrics["responsibles"])
      : [],
  };
  const filterOptions: SchedulingFilterOptions = {
    insurances: uniqueText(
      (optionRequestsResult.data ?? []).map((item) => item.insurance_name),
    ),
    units: uniqueText(
      (optionRequestsResult.data ?? []).map((item) => item.unit_name),
    ),
    modalities: uniqueText(
      (optionExamsResult.data ?? []).map((item) => item.modality),
    ),
    responsibles: (profilesResult.data ?? []).map((item) => ({
      id: item.id,
      name: item.full_name || "Atendente",
    })),
  };
  const total = listResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <AdminPageHeading
        eyebrow="Recepção"
        title="Central de Agendamentos"
        description="Gerencie as solicitações, contatos e agendamentos dos pacientes."
      />
      {listResult.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-xl p-4 font-bold"
        >
          Não foi possível carregar a fila. A atualização do banco pode estar
          pendente.
        </p>
      ) : null}
      <SchedulingCommandCenter
        requests={rows}
        currentUser={{
          id: user.id,
          name: profile.full_name || "Atendente",
          canManageScheduling: hasAdminPermission(profile, "scheduling.manage"),
          canOverrideAssignment: canOverrideSchedulingAssignment(profile),
        }}
        initialSelectedId={
          requestedId && !initialSelectionMissing ? requestedId : undefined
        }
        initialSelectionMissing={initialSelectionMissing}
        metrics={metrics}
        queryState={queryState}
        filterOptions={filterOptions}
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total,
          totalPages,
        }}
      />
    </>
  );
}
