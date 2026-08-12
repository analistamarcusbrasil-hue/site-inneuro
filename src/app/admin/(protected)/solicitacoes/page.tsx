import Link from "next/link";
import { FileCheck2, FileDown, Search } from "lucide-react";
import {
  markAppointmentDocumentAction,
  updateAppointmentRequestAction,
} from "@/app/admin/actions";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { requireAdmin } from "@/lib/cms/auth";
import {
  getSchedulingModalityLabel,
  schedulingModalities,
} from "@/lib/scheduling/shared";

const statusLabels: Record<string, string> = {
  NEW: "Nova",
  IN_REVIEW: "Em análise",
  DOCUMENT_PENDING: "Documentação pendente",
  AUTHORIZATION_PENDING: "Aguardando autorização",
  AWAITING_CONTACT: "Aguardando contato",
  CONTACTED: "Contato realizado",
  PARTIALLY_SCHEDULED: "Parcialmente agendada",
  SCHEDULED: "Agendada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};
const serviceLabels: Record<string, string> = {
  PARTICULAR: "Particular",
  INSURANCE: "Convênio",
  SUS: "SUS",
};
const periodLabels: Record<string, string> = {
  MORNING: "Manhã",
  AFTERNOON: "Tarde",
  EVENING: "Noite",
  ANY: "Qualquer período",
};
const documentLabels: Record<string, string> = {
  photo_id: "Documento com foto",
  medical_request: "Pedido médico",
  sus_authorization: "Autorização da regulação",
  sus_card: "Cartão SUS",
  insurance_card_front: "Carteirinha — frente",
  insurance_card_back: "Carteirinha — verso",
  insurance_authorization: "Autorização ou guia do convênio",
  other: "Outro documento",
};

type RequestRow = {
  id: string;
  protocol: string;
  patient_name: string;
  cpf: string | null;
  birth_date: string;
  phone: string;
  email: string | null;
  city: string | null;
  responsible_name: string | null;
  service_type: string;
  insurance_name: string | null;
  insurance_card_number: string | null;
  sus_cns: string | null;
  sus_authorization_number: string | null;
  sus_regulation_number: string | null;
  sus_request_number: string | null;
  sisreg_code: string | null;
  origin_city: string | null;
  requesting_unit: string | null;
  requesting_professional: string | null;
  authorization_pending: boolean;
  preferred_dates: string[];
  preferred_periods: string[];
  notes: string | null;
  status: string;
  assigned_to: string | null;
  assigned:
    { full_name: string | null } | Array<{ full_name: string | null }> | null;
  created_at: string;
  updated_at: string;
  appointment_request_exams: Array<{
    id: string;
    exam_name: string;
    modality: string | null;
    sort_order: number;
    status: string;
    scheduled_date: string | null;
    scheduled_period: string | null;
  }>;
  appointment_request_documents: Array<{
    id: string;
    document_type: string;
    file_name: string;
    mime_type: string;
    file_size: number;
    checked_at: string | null;
    created_at: string;
  }>;
  appointment_request_history: Array<{
    id: string;
    action: string;
    details: Record<string, unknown>;
    created_at: string;
  }>;
};

function mask(value: string | null, visible = 4) {
  if (!value) return "Não informado";
  const digits = value.replace(/\D/g, "");
  return digits.length <= visible
    ? value
    : `${"•".repeat(digits.length - visible)}${digits.slice(-visible)}`;
}
function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}
function formatSize(bytes: number) {
  return bytes < 1048576
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB`;
}

export default async function AppointmentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) =>
    Array.isArray(params[key])
      ? String(params[key]?.[0] ?? "")
      : String(params[key] ?? "");
  const status = value("status"),
    service = value("service"),
    q = value("q").toLocaleLowerCase("pt-BR"),
    examFilter = value("exam").toLocaleLowerCase("pt-BR"),
    modalityFilter = value("modality").toLocaleLowerCase("pt-BR"),
    periodFilter = value("period"),
    dateFilter = value("date"),
    pending = value("pending"),
    selectedId = value("id");
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("appointment_requests")
    .select(
      "*,assigned:profiles!assigned_to(full_name),appointment_request_exams(*),appointment_request_documents(*),appointment_request_history(*)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const all = (data ?? []) as RequestRow[];
  const rows = all.filter((item) => {
    if (status && item.status !== status) return false;
    if (service && item.service_type !== service) return false;
    if (pending === "documents" && item.status !== "DOCUMENT_PENDING")
      return false;
    if (pending === "authorization" && !item.authorization_pending)
      return false;
    if (periodFilter && !item.preferred_periods.includes(periodFilter))
      return false;
    if (dateFilter && !item.preferred_dates.includes(dateFilter)) return false;
    if (
      examFilter &&
      !item.appointment_request_exams.some((exam) =>
        exam.exam_name.toLocaleLowerCase("pt-BR").includes(examFilter),
      )
    )
      return false;
    if (
      modalityFilter &&
      !item.appointment_request_exams.some((exam) =>
        (exam.modality ?? "")
          .toLocaleLowerCase("pt-BR")
          .includes(modalityFilter),
      )
    )
      return false;
    if (
      q &&
      !`${item.protocol} ${item.patient_name} ${item.phone}`
        .toLocaleLowerCase("pt-BR")
        .includes(q)
    )
      return false;
    return true;
  });
  const selected = all.find((item) => item.id === selectedId) ?? null;
  return (
    <>
      <AdminPageHeading
        eyebrow="Atendimento"
        title="Solicitações de agendamento"
        description="Consulte pedidos, exames, documentos privados, disponibilidade, pendências e histórico. Nenhuma solicitação desta tela confirma automaticamente um agendamento."
      />
      {error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-xl p-4 font-bold"
        >
          Não foi possível consultar as solicitações. Confirme se a migration
          foi aplicada.
        </p>
      ) : null}
      {value("success") ? (
        <p
          role="status"
          className="bg-mint text-brand mb-6 rounded-xl p-4 font-bold"
        >
          Solicitação atualizada.
        </p>
      ) : null}
      <form className="border-border-light mb-6 grid gap-3 rounded-3xl border bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-bold">
          Busca
          <input
            name="q"
            defaultValue={value("q")}
            placeholder="Protocolo, paciente ou telefone"
            className="border-border-light mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
          />
        </label>
        <label className="text-xs font-bold">
          Status
          <select
            name="status"
            defaultValue={status}
            className="border-border-light mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
          >
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold">
          Atendimento
          <select
            name="service"
            defaultValue={service}
            className="border-border-light mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
          >
            <option value="">Todos</option>
            {Object.entries(serviceLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold">
          Pendência
          <select
            name="pending"
            defaultValue={pending}
            className="border-border-light mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
          >
            <option value="">Todas</option>
            <option value="documents">Documentos</option>
            <option value="authorization">Autorização SUS</option>
          </select>
        </label>
        <label className="text-xs font-bold">
          Exame
          <input
            name="exam"
            defaultValue={value("exam")}
            className="border-border-light mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
          />
        </label>
        <label className="text-xs font-bold">
          Modalidade
          <select
            name="modality"
            defaultValue={value("modality")}
            className="border-border-light mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
          >
            <option value="">Todas</option>
            {schedulingModalities.map((item) => (
              <option key={item.id} value={item.id.toLocaleLowerCase("pt-BR")}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold">
          Período
          <select
            name="period"
            defaultValue={periodFilter}
            className="border-border-light mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
          >
            <option value="">Todos</option>
            {Object.entries(periodLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold">
          Data preferida
          <input
            type="date"
            name="date"
            defaultValue={dateFilter}
            className="border-border-light mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
          />
        </label>
        <button className="bg-brand inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold text-white sm:col-span-2 xl:col-span-4">
          <Search aria-hidden="true" size={16} /> Filtrar solicitações
        </button>
      </form>
      <div className="grid items-start gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <section>
          <p className="text-muted mb-3 text-sm">
            {rows.length} solicitação(ões) encontrada(s)
          </p>
          <ol className="space-y-3">
            {rows.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/admin/solicitacoes?id=${item.id}`}
                  className={`border-border-light block rounded-2xl border bg-white p-4 ${selected?.id === item.id ? "ring-brand ring-2" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-brand">{item.protocol}</strong>
                    <span className="bg-mint text-brand-dark rounded-full px-2 py-1 text-xs font-bold">
                      {statusLabels[item.status] ?? item.status}
                    </span>
                  </div>
                  <p className="text-ink mt-2 font-semibold">
                    {item.patient_name}
                  </p>
                  <p className="text-muted mt-1 text-sm">
                    {serviceLabels[item.service_type]} ·{" "}
                    {item.appointment_request_exams.length} exame(s) ·{" "}
                    {new Date(item.created_at).toLocaleString("pt-BR")}
                  </p>
                  {item.service_type === "SUS" && item.authorization_pending ? (
                    <p className="text-warning mt-2 text-sm font-bold">
                      Autorização pendente
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ol>
          {!rows.length ? (
            <p className="border-border-light text-muted rounded-2xl border bg-white p-6 text-center">
              Nenhuma solicitação corresponde aos filtros.
            </p>
          ) : null}
        </section>
        <section className="xl:sticky xl:top-28">
          {selected ? (
            <div className="border-border-light space-y-6 rounded-3xl border bg-white p-5 sm:p-7">
              <div>
                <p className="text-brand text-xs font-bold uppercase">
                  {selected.protocol}
                </p>
                <h2 className="font-heading text-ink mt-1 text-2xl font-semibold">
                  {selected.patient_name}
                </h2>
                <p className="text-muted mt-2 text-sm">
                  Recebida em{" "}
                  {new Date(selected.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <section className="grid gap-3 text-sm sm:grid-cols-2">
                <p>
                  <strong>Telefone:</strong> {selected.phone}
                </p>
                <p>
                  <strong>E-mail:</strong> {selected.email || "Não informado"}
                </p>
                <p>
                  <strong>CPF:</strong> {mask(selected.cpf)}
                </p>
                <p>
                  <strong>Cidade:</strong> {selected.city || "Não informada"}
                </p>
                <p>
                  <strong>Nascimento:</strong> {formatDate(selected.birth_date)}
                </p>
                <p>
                  <strong>Responsável:</strong>{" "}
                  {selected.responsible_name || "Não informado"}
                </p>
                <p>
                  <strong>Atendente:</strong>{" "}
                  {(Array.isArray(selected.assigned)
                    ? selected.assigned[0]?.full_name
                    : selected.assigned?.full_name) || "Ainda não atribuído"}
                </p>
              </section>
              <section>
                <h3 className="font-heading text-lg font-semibold">
                  Exames ({selected.appointment_request_exams.length})
                </h3>
                <div className="mt-3 space-y-4">
                  {schedulingModalities.map((modality) => {
                    const items = selected.appointment_request_exams
                      .filter((exam) => exam.modality === modality.id)
                      .sort((a, b) => a.sort_order - b.sort_order);
                    return items.length ? (
                      <div
                        key={modality.id}
                        className="bg-surface rounded-2xl p-4"
                      >
                        <p className="text-brand text-xs font-bold uppercase">
                          {getSchedulingModalityLabel(modality.id)}
                        </p>
                        <ul className="mt-2 space-y-2">
                          {items.map((exam) => (
                            <li
                              key={exam.id}
                              className="rounded-xl bg-white p-3 text-sm"
                            >
                              <strong>{exam.exam_name}</strong>
                              <span className="text-muted mt-1 block">
                                {exam.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null;
                  })}
                  {selected.appointment_request_exams.some(
                    (exam) =>
                      !schedulingModalities.some(
                        (item) => item.id === exam.modality,
                      ),
                  ) ? (
                    <div className="bg-surface rounded-2xl p-4">
                      <p className="text-muted text-xs font-bold uppercase">
                        Modalidade não estruturada
                      </p>
                      <ul className="mt-2 space-y-2">
                        {selected.appointment_request_exams
                          .filter(
                            (exam) =>
                              !schedulingModalities.some(
                                (item) => item.id === exam.modality,
                              ),
                          )
                          .map((exam) => (
                            <li
                              key={exam.id}
                              className="rounded-xl bg-white p-3 text-sm"
                            >
                              <strong>{exam.exam_name}</strong>
                              <span className="text-muted mt-1 block">
                                {exam.modality || "Não informada"} ·{" "}
                                {exam.status}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </section>
              <section>
                <h3 className="font-heading text-lg font-semibold">
                  Atendimento
                </h3>
                <div className="text-muted mt-2 space-y-1 text-sm">
                  <p>{serviceLabels[selected.service_type]}</p>
                  {selected.service_type === "INSURANCE" ? (
                    <>
                      <p>
                        Convênio: {selected.insurance_name || "Não informado"}
                      </p>
                      <p>Carteirinha: {mask(selected.insurance_card_number)}</p>
                    </>
                  ) : null}
                  {selected.service_type === "SUS" ? (
                    <>
                      <p>CNS: {mask(selected.sus_cns)}</p>
                      <p>
                        Autorização/regulação:{" "}
                        {selected.sus_regulation_number ||
                          selected.sus_authorization_number ||
                          "Não informada"}
                      </p>
                      <p>SISREG: {selected.sisreg_code || "Não informado"}</p>
                      <p>
                        Município: {selected.origin_city || "Não informado"}
                      </p>
                      <p>
                        Unidade: {selected.requesting_unit || "Não informada"}
                      </p>
                      {selected.authorization_pending ? (
                        <p className="text-warning font-bold">
                          Pendência: autorização ainda não enviada
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </section>
              <section>
                <h3 className="font-heading text-lg font-semibold">
                  Disponibilidade
                </h3>
                <p className="text-muted mt-2 text-sm">
                  Datas: {selected.preferred_dates.map(formatDate).join(" · ")}
                </p>
                <p className="text-muted mt-1 text-sm">
                  Períodos:{" "}
                  {selected.preferred_periods
                    .map((item) => periodLabels[item] ?? item)
                    .join(" · ")}
                </p>
                <p className="text-muted mt-2 text-sm">
                  Observações: {selected.notes || "Não informadas"}
                </p>
              </section>
              <section>
                <h3 className="font-heading text-lg font-semibold">
                  Documentos privados (
                  {selected.appointment_request_documents.length})
                </h3>
                <ul className="mt-2 space-y-2">
                  {selected.appointment_request_documents.map((document) => (
                    <li
                      key={document.id}
                      className="border-border-light flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
                    >
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate">
                          {documentLabels[document.document_type] ??
                            document.document_type}
                        </strong>
                        <span className="text-muted block truncate">
                          {document.file_name} ·{" "}
                          {formatSize(document.file_size)}
                        </span>
                        {document.checked_at ? (
                          <span className="text-brand mt-1 block text-xs font-bold">
                            Conferido
                          </span>
                        ) : null}
                      </span>
                      <a
                        href={`/api/admin/solicitacoes/documentos/${document.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Visualizar ${document.file_name}`}
                        className="text-brand focus-visible:ring-tech bg-mint grid h-10 w-10 place-items-center rounded-full focus-visible:ring-2"
                      >
                        <FileDown aria-hidden="true" size={17} />
                      </a>
                      {!document.checked_at ? (
                        <form action={markAppointmentDocumentAction}>
                          <input type="hidden" name="id" value={document.id} />
                          <input
                            type="hidden"
                            name="request_id"
                            value={selected.id}
                          />
                          <button
                            aria-label={`Marcar ${document.file_name} como conferido`}
                            className="text-brand focus-visible:ring-tech bg-mint grid h-10 w-10 place-items-center rounded-full focus-visible:ring-2"
                          >
                            <FileCheck2 aria-hidden="true" size={17} />
                          </button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
              <form
                action={updateAppointmentRequestAction}
                className="border-border-light bg-surface rounded-2xl border p-4"
              >
                <input type="hidden" name="id" value={selected.id} />
                <label className="text-sm font-bold">
                  Status
                  <select
                    name="status"
                    defaultValue={selected.status}
                    className="border-border-light mt-2 min-h-11 w-full rounded-xl border bg-white px-3 font-normal"
                  >
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-4 block text-sm font-bold">
                  Observação da alteração
                  <textarea
                    name="note"
                    rows={3}
                    maxLength={500}
                    className="border-border-light mt-2 w-full rounded-xl border bg-white p-3 font-normal"
                  />
                </label>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="assign_to_me"
                    className="text-brand h-5 w-5 rounded"
                  />{" "}
                  Atribuir esta solicitação a mim
                </label>
                <button className="bg-brand mt-4 min-h-11 rounded-full px-5 text-sm font-bold text-white">
                  Salvar atualização
                </button>
              </form>
              <section>
                <h3 className="font-heading text-lg font-semibold">
                  Histórico
                </h3>
                <ol className="mt-2 space-y-2">
                  {[...selected.appointment_request_history]
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .map((history) => (
                      <li
                        key={history.id}
                        className="bg-surface rounded-xl p-3 text-sm"
                      >
                        <strong>{history.action}</strong>
                        <time className="text-muted mt-1 block text-xs">
                          {new Date(history.created_at).toLocaleString("pt-BR")}
                        </time>
                        {typeof history.details?.note === "string" ? (
                          <p className="text-muted mt-1">
                            {history.details.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                </ol>
              </section>
            </div>
          ) : (
            <div className="border-border-light text-muted rounded-3xl border bg-white p-8 text-center">
              Selecione uma solicitação para visualizar todos os dados.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
