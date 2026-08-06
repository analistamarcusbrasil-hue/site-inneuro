"use client";

import {
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  MessageCircle,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Container } from "@/components/layout/container";
import {
  MultiDocumentUploadField,
  type SelectedSchedulingFile,
} from "@/components/scheduling/multi-document-upload-field";
import { Badge } from "@/components/ui/badge";
import type { SiteConfig } from "@/config/site";
import type { SchedulingExamOption } from "@/lib/cms/public-content";
import type { SchedulingSettings } from "@/lib/scheduling/settings";
import {
  MAX_REQUEST_SIZE,
  type DocumentKind,
  type FinalizeSchedulingResponse,
  type PrepareUploadResponse,
  type PreferredPeriod,
  type ServiceType,
  validateFileDescriptor,
} from "@/lib/scheduling/shared";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
import type { Convenio } from "@/types/convenio";

type Channel = "primary" | "secondary";
type SubmitPhase = "idle" | "uploading" | "saving";
type Success = FinalizeSchedulingResponse & {
  examCount: number;
  serviceType: ServiceType;
  authorizationPending: boolean;
};

const steps = [
  "Exames",
  "Paciente",
  "Atendimento",
  "Documentos",
  "Disponibilidade",
  "Revisão",
];
const inputClasses =
  "mt-2 min-h-12 w-full rounded-2xl border border-border-light bg-white px-4 text-base text-ink outline-none transition-colors placeholder:text-muted/65 focus:border-brand focus:ring-2 focus:ring-tech/25";
const serviceLabels: Record<ServiceType, string> = {
  PARTICULAR: "Particular",
  INSURANCE: "Convênio",
  SUS: "SUS",
};
const periodLabels: Record<PreferredPeriod, string> = {
  MORNING: "Manhã",
  AFTERNOON: "Tarde",
  EVENING: "Noite",
  ANY: "Qualquer período",
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function readJsonResponse<T>(response: Response): Promise<T> {
  return response
    .json()
    .catch(() => ({}))
    .then((payload: T & { error?: string }) => {
      if (!response.ok)
        throw new Error(payload.error || "Não foi possível concluir o envio.");
      return payload;
    });
}

function uploadFileToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const data = new FormData();
    data.append("cacheControl", "0");
    data.append("", file);
    request.open("PUT", signedUrl);
    request.timeout = 5 * 60 * 1000;
    request.upload.addEventListener(
      "progress",
      (event) =>
        event.lengthComputable &&
        onProgress(
          Math.min(99, Math.round((event.loaded / event.total) * 100)),
        ),
    );
    request.addEventListener("load", () =>
      request.status >= 200 && request.status < 300
        ? (onProgress(100), resolve())
        : reject(
            new Error(
              "Um documento não pôde ser enviado. Verifique sua conexão.",
            ),
          ),
    );
    request.addEventListener("error", () =>
      reject(
        new Error("O envio foi interrompido. Seus dados foram preservados."),
      ),
    );
    request.addEventListener("timeout", () =>
      reject(
        new Error("O envio demorou mais que o esperado. Tente novamente."),
      ),
    );
    request.send(data);
  });
}

function formatDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function Scheduling({
  initialExam = "",
  whatsapp,
  exams,
  partners,
  settings,
}: {
  initialExam?: string;
  whatsapp: SiteConfig["whatsapp"];
  exams: SchedulingExamOption[];
  partners: Convenio[];
  settings: SchedulingSettings;
}) {
  const [step, setStep] = useState(0);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [examSearch, setExamSearch] = useState("");
  const [modality, setModality] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType | "">("");
  const [files, setFiles] = useState<SelectedSchedulingFile[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [dates, setDates] = useState([""]);
  const [periods, setPeriods] = useState<PreferredPeriod[]>([]);
  const [phone, setPhone] = useState("");
  const [observations, setObservations] = useState("");
  const [insuranceId, setInsuranceId] = useState("");
  const [insuranceOther, setInsuranceOther] = useState("");
  const [authorizationPending, setAuthorizationPending] = useState(false);
  const [channel, setChannel] = useState<Channel>("primary");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [success, setSuccess] = useState<Success | null>(null);
  const [startedAt] = useState(() => Date.now());
  const isSubmitting = phase !== "idle";

  const modalities = useMemo(
    () => [...new Set(exams.map((exam) => exam.modality))].sort(),
    [exams],
  );
  const selectedExams = useMemo(
    () =>
      selectedExamIds
        .map((id) => exams.find((exam) => exam.id === id))
        .filter((exam): exam is SchedulingExamOption => Boolean(exam)),
    [selectedExamIds, exams],
  );
  const filteredExams = useMemo(() => {
    const term = examSearch.trim().toLocaleLowerCase("pt-BR");
    return exams.filter(
      (exam) =>
        (!modality || exam.modality === modality) &&
        (!term ||
          `${exam.name} ${exam.modality}`
            .toLocaleLowerCase("pt-BR")
            .includes(term)),
    );
  }, [examSearch, exams, modality]);
  const activePartners = partners.filter(
    (partner) => partner.category === "convenio" && partner.active,
  );
  const selectedPartner = activePartners.find(
    (partner) => partner.id === insuranceId,
  );

  useEffect(() => {
    const stored = window.sessionStorage.getItem("inneuro-selected-exams");
    let storedIds: unknown = [];
    try {
      storedIds = stored ? JSON.parse(stored) : [];
    } catch {
      storedIds = [];
    }
    const initial = exams.find(
      (exam) =>
        exam.name.toLocaleLowerCase("pt-BR") ===
          initialExam.toLocaleLowerCase("pt-BR") || exam.id === initialExam,
    );
    const validStored = Array.isArray(storedIds)
      ? storedIds
          .map(String)
          .filter((id) => exams.some((exam) => exam.id === id))
      : [];
    window.queueMicrotask(() =>
      setSelectedExamIds([
        ...new Set([...validStored, ...(initial ? [initial.id] : [])]),
      ]),
    );
  }, [exams, initialExam]);

  useEffect(() => {
    window.sessionStorage.setItem(
      "inneuro-selected-exams",
      JSON.stringify(selectedExamIds),
    );
  }, [selectedExamIds]);

  function toggleExam(id: string) {
    setSelectedExamIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
    setErrors([]);
  }

  function addFiles(kind: DocumentKind, incoming: File[]) {
    const nextErrors: string[] = [];
    const accepted = incoming.slice(0, 12).flatMap((file) => {
      const id = crypto.randomUUID();
      const error = validateFileDescriptor({
        id,
        kind,
        name: file.name,
        size: file.size,
        type: file.type,
      });
      if (error) {
        nextErrors.push(`${file.name}: ${error}`);
        return [];
      }
      return [{ id, kind, file }];
    });
    setFiles((current) => {
      const base = [
        "photoId",
        "insuranceCardFront",
        "insuranceCardBack",
      ].includes(kind)
        ? current.filter((item) => item.kind !== kind)
        : current;
      const result = [...base, ...accepted].slice(0, 12);
      if (
        result.reduce((total, item) => total + item.file.size, 0) >
        MAX_REQUEST_SIZE
      ) {
        setErrors(["O total dos arquivos pode ter no máximo 25 MB."]);
        return current;
      }
      return result;
    });
    setErrors(nextErrors);
    if (kind === "susAuthorization" && accepted.length)
      setAuthorizationPending(false);
  }

  function validateStep(target: number, form?: HTMLFormElement) {
    const next: string[] = [];
    const data = form ? new FormData(form) : null;
    if (target === 0 && !selectedExamIds.length)
      next.push("Selecione pelo menos um exame.");
    if (target === 1 && data) {
      if (String(data.get("name") ?? "").trim().length < 2)
        next.push("Informe o nome completo do paciente.");
      if (!String(data.get("birthDate") ?? ""))
        next.push("Informe a data de nascimento.");
      if (phone.replace(/\D/g, "").length < 10)
        next.push("Informe um telefone válido com DDD.");
    }
    if (target === 2) {
      if (!serviceType) next.push("Escolha a forma de atendimento.");
      if (serviceType === "INSURANCE" && !insuranceId)
        next.push("Selecione um convênio.");
      if (
        serviceType === "INSURANCE" &&
        insuranceId === "OTHER" &&
        !insuranceOther.trim()
      )
        next.push("Informe o nome do convênio.");
    }
    if (target === 3) {
      if (!files.some((item) => item.kind === "medicalOrder"))
        next.push("Anexe o pedido médico.");
      if (
        serviceType === "SUS" &&
        settings.susAuthorizationRequired &&
        !files.some((item) => item.kind === "susAuthorization")
      )
        next.push("Anexe a autorização da regulação.");
      if (
        serviceType === "SUS" &&
        !files.some((item) => item.kind === "susAuthorization") &&
        !authorizationPending
      )
        next.push(
          "Anexe a autorização ou marque que ainda não possui o documento.",
        );
    }
    if (target === 4) {
      if (!dates.some(Boolean))
        next.push("Escolha pelo menos uma data preferencial.");
      if (!periods.length) next.push("Selecione ao menos um período.");
    }
    if (target === 5 && !consent)
      next.push("Autorize o uso dos dados e documentos para continuar.");
    setErrors(next);
    return next.length === 0;
  }

  function goNext(form: HTMLFormElement) {
    if (validateStep(step, form))
      setStep((current) => Math.min(5, current + 1));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (step < 5) {
      goNext(form);
      return;
    }
    if (!validateStep(5, form) || isSubmitting) return;
    const data = new FormData(form);
    const insuranceName =
      insuranceId === "OTHER" ? insuranceOther : (selectedPartner?.name ?? "");
    try {
      setPhase("uploading");
      const prepared = await fetch("/api/pre-agendamento/preparar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType,
          authorizationPending,
          website: data.get("website"),
          startedAt,
          files: files.map((item) => ({
            id: item.id,
            kind: item.kind,
            name: item.file.name,
            size: item.file.size,
            type: item.file.type,
          })),
        }),
      }).then((response) => readJsonResponse<PrepareUploadResponse>(response));
      await Promise.all(
        prepared.uploads.map(async (upload) => {
          const selected = files.find((item) => item.id === upload.id);
          if (!selected)
            throw new Error("Um arquivo selecionado não está mais disponível.");
          setProgress((current) => ({ ...current, [upload.id]: 0 }));
          await uploadFileToSignedUrl(
            upload.signedUrl,
            selected.file,
            (value) =>
              setProgress((current) => ({ ...current, [upload.id]: value })),
          );
        }),
      );
      setPhase("saving");
      const finalized = await fetch("/api/pre-agendamento/finalizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken: prepared.sessionToken,
          website: data.get("website"),
          consent,
          name: data.get("name"),
          cpf: data.get("cpf"),
          birthDate: data.get("birthDate"),
          phone,
          email: data.get("email"),
          city: data.get("city"),
          responsibleName: data.get("responsibleName"),
          examIds: selectedExamIds,
          insuranceId: insuranceId === "OTHER" ? null : insuranceId,
          insuranceName,
          insuranceCardNumber: data.get("insuranceCardNumber"),
          susCardNumber: data.get("susCardNumber"),
          regulationNumber: data.get("regulationNumber"),
          susAuthorizationNumber: data.get("susAuthorizationNumber"),
          susRequestNumber: data.get("susRequestNumber"),
          sisregCode: data.get("sisregCode"),
          originCity: data.get("originCity"),
          requestingUnit: data.get("requestingUnit"),
          requestingProfessional: data.get("requestingProfessional"),
          authorizationDate: data.get("authorizationDate"),
          authorizationExpiry: data.get("authorizationExpiry"),
          preferredDates: dates.filter(Boolean),
          preferredPeriods: periods,
          observations,
          channel,
        }),
      }).then((response) =>
        readJsonResponse<FinalizeSchedulingResponse>(response),
      );
      window.sessionStorage.removeItem("inneuro-selected-exams");
      setSuccess({
        ...finalized,
        examCount: selectedExamIds.length,
        serviceType: serviceType as ServiceType,
        authorizationPending,
      });
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a solicitação. Seus dados foram preservados.",
      ]);
    } finally {
      setPhase("idle");
    }
  }

  if (success)
    return (
      <section
        id="pre-agendamento"
        className="scroll-mt-24 bg-white py-16 sm:py-20"
        aria-labelledby="scheduling-success-title"
      >
        <Container>
          <div className="border-border-light bg-surface mx-auto max-w-3xl rounded-[2rem] border p-7 text-center sm:p-10">
            <span className="bg-mint text-brand mx-auto grid h-16 w-16 place-items-center rounded-full">
              <Check aria-hidden="true" size={30} />
            </span>
            <h1
              id="scheduling-success-title"
              className="font-heading text-ink mt-5 text-3xl font-semibold"
            >
              Solicitação enviada com sucesso
            </h1>
            <p className="text-muted mt-3 leading-relaxed">
              Recebemos sua solicitação de agendamento. Nossa equipe analisará
              os exames, os documentos e a disponibilidade informada e entrará
              em contato para confirmar as datas e os horários.
            </p>
            <p className="text-ink mt-5 font-semibold">
              Você solicitou o agendamento de {success.examCount}{" "}
              {success.examCount === 1 ? "exame" : "exames"}.
            </p>
            {success.serviceType === "SUS" ? (
              <p className="text-muted mt-2">
                {success.authorizationPending
                  ? "Sua solicitação foi registrada com pendência de autorização da regulação."
                  : "Os dados e a autorização da regulação serão analisados pela equipe."}
              </p>
            ) : null}
            <p className="text-brand mt-6 rounded-2xl bg-white p-4 font-bold">
              Protocolo: {success.protocol}
            </p>
            <a
              href={success.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-brand hover:bg-brand-dark focus-visible:ring-tech mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-7 font-bold text-white focus-visible:ring-2 focus-visible:outline-none"
            >
              <MessageCircle aria-hidden="true" size={18} /> Enviar também pelo
              WhatsApp
            </a>
          </div>
        </Container>
      </section>
    );

  const fileGroup = (kind: DocumentKind) =>
    files.filter((item) => item.kind === kind);
  const field = (
    name: string,
    label: string,
    options: {
      type?: string;
      required?: boolean;
      placeholder?: string;
      autoComplete?: string;
    } = {},
  ) => (
    <label className="text-ink text-sm font-semibold">
      {label}
      {options.required ? (
        <span className="text-error" aria-hidden="true">
          {" "}
          *
        </span>
      ) : null}
      <input
        name={name}
        type={options.type ?? "text"}
        required={options.required}
        placeholder={options.placeholder}
        autoComplete={options.autoComplete}
        className={inputClasses}
      />
    </label>
  );

  return (
    <section
      id="pre-agendamento"
      aria-labelledby="scheduling-title"
      className="scroll-mt-24 bg-white pt-20 pb-12 sm:pt-24 xl:scroll-mt-28"
    >
      <Container>
        <div className="grid items-start gap-6 lg:grid-cols-[.78fr_1.22fr] lg:gap-10">
          <div className="lg:sticky lg:top-28">
            <Badge>Pré-agendamento</Badge>
            <h1
              id="scheduling-title"
              className="font-heading text-ink mt-3 text-[clamp(2rem,4vw,3rem)] leading-[1.02] font-semibold tracking-[-.05em]"
            >
              Organize sua solicitação de exame.
            </h1>
            <p className="text-muted mt-3 leading-relaxed">
              Selecione um ou vários exames. A equipe confirmará as datas e os
              horários após analisar sua solicitação.
            </p>
            <div className="bg-mint mt-5 rounded-3xl p-4">
              <CalendarCheck
                aria-hidden="true"
                className="text-brand"
                size={22}
              />
              <p className="text-ink mt-2 font-semibold">
                {settings.publicText}
              </p>
              <p className="text-muted mt-1 text-sm">{settings.note}</p>
            </div>
          </div>
          <form
            noValidate
            onSubmit={handleSubmit}
            className="border-border-light bg-surface rounded-[2rem] border p-5 sm:p-8"
          >
            <div
              className="absolute -left-[9999px] h-px w-px overflow-hidden"
              aria-hidden="true"
            >
              <label>
                Não preencha
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <ol
              className="mb-7 grid grid-cols-6 gap-1"
              aria-label="Progresso da solicitação"
            >
              {steps.map((label, index) => (
                <li
                  key={label}
                  aria-current={step === index ? "step" : undefined}
                  className="min-w-0 text-center"
                >
                  <span
                    className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${index <= step ? "bg-brand text-white" : "text-muted bg-white"}`}
                  >
                    {index + 1}
                  </span>
                  <span className="text-muted mt-1 hidden truncate text-[.65rem] sm:block">
                    {label}
                  </span>
                </li>
              ))}
            </ol>
            {errors.length ? (
              <div
                role="alert"
                className="bg-error/10 text-error mb-5 rounded-2xl p-4 text-sm font-semibold"
              >
                <p>Revise antes de continuar:</p>
                <ul className="mt-1 list-disc pl-5">
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div hidden={step !== 0}>
              <h2 className="font-heading text-ink text-2xl font-semibold">
                Quais exames você precisa realizar?
              </h2>
              <p className="text-muted mt-2 text-sm">
                Pesquise e marque todos os exames do pedido médico.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_15rem]">
                <label className="relative">
                  <span className="sr-only">Buscar exame</span>
                  <Search
                    aria-hidden="true"
                    className="text-muted absolute top-5 left-4"
                    size={17}
                  />
                  <input
                    value={examSearch}
                    onChange={(event) => setExamSearch(event.target.value)}
                    placeholder="Buscar por nome"
                    className={`${inputClasses} mt-0 pl-11`}
                  />
                </label>
                <label>
                  <span className="sr-only">Filtrar modalidade</span>
                  <select
                    value={modality}
                    onChange={(event) => setModality(event.target.value)}
                    className={`${inputClasses} mt-0`}
                  >
                    <option value="">Todas as modalidades</option>
                    {modalities.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p
                className="text-brand mt-4 text-sm font-bold"
                aria-live="polite"
              >
                {selectedExamIds.length}{" "}
                {selectedExamIds.length === 1
                  ? "exame selecionado"
                  : "exames selecionados"}
              </p>
              {selectedExams.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedExams.map((exam) => (
                    <button
                      type="button"
                      key={exam.id}
                      onClick={() => toggleExam(exam.id)}
                      className="bg-mint text-brand-dark rounded-full px-3 py-2 text-left text-xs font-semibold"
                    >
                      {exam.name} <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-5 max-h-80 space-y-2 overflow-y-auto pr-1">
                {filteredExams.map((exam) => {
                  const checked = selectedExamIds.includes(exam.id);
                  return (
                    <label
                      key={exam.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${checked ? "border-brand bg-mint/60" : "border-border-light bg-white"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExam(exam.id)}
                        className="text-brand focus:ring-tech mt-1 h-5 w-5 rounded"
                      />
                      <span>
                        <span className="text-ink block font-semibold">
                          {exam.name}
                        </span>
                        <span className="text-muted mt-1 block text-xs">
                          {exam.modality}
                        </span>
                      </span>
                    </label>
                  );
                })}
                {!filteredExams.length ? (
                  <p className="text-muted py-8 text-center">
                    Nenhum exame encontrado.
                  </p>
                ) : null}
              </div>
            </div>

            <div hidden={step !== 1}>
              <h2 className="font-heading text-ink text-2xl font-semibold">
                Dados do paciente
              </h2>
              <p className="text-muted mt-2 text-sm">
                Preencha somente os dados necessários para a equipe entrar em
                contato.
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {field("name", "Nome completo", {
                  required: true,
                  autoComplete: "name",
                })}
                {field("cpf", "CPF (opcional)", {
                  placeholder: "000.000.000-00",
                })}
                {field("birthDate", "Data de nascimento", {
                  type: "date",
                  required: true,
                  autoComplete: "bday",
                })}
                <label className="text-ink text-sm font-semibold">
                  Telefone/WhatsApp <span className="text-error">*</span>
                  <input
                    name="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(formatPhone(event.target.value))
                    }
                    autoComplete="tel"
                    placeholder="(00) 00000-0000"
                    className={inputClasses}
                  />
                </label>
                {field("email", "E-mail (opcional)", {
                  type: "email",
                  autoComplete: "email",
                })}
                {field("city", "Cidade (opcional)", {
                  autoComplete: "address-level2",
                })}
                <div className="sm:col-span-2">
                  {field(
                    "responsibleName",
                    "Nome do responsável (se necessário)",
                  )}
                </div>
              </div>
            </div>

            <div hidden={step !== 2}>
              <h2 className="font-heading text-ink text-2xl font-semibold">
                Como será o atendimento?
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {(["PARTICULAR", "INSURANCE", "SUS"] as ServiceType[]).map(
                  (type) => (
                    <label
                      key={type}
                      className={`cursor-pointer rounded-2xl border p-4 text-center font-semibold ${serviceType === type ? "border-brand bg-mint text-brand-dark" : "border-border-light text-ink bg-white"}`}
                    >
                      <input
                        type="radio"
                        name="serviceType"
                        value={type}
                        checked={serviceType === type}
                        onChange={() => {
                          setServiceType(type);
                          setAuthorizationPending(false);
                          setFiles((current) =>
                            current.filter(
                              (item) =>
                                item.kind === "medicalOrder" ||
                                item.kind === "photoId" ||
                                item.kind === "other" ||
                                (type === "INSURANCE" &&
                                  (item.kind === "insuranceCardFront" ||
                                    item.kind === "insuranceCardBack")) ||
                                (type === "SUS" &&
                                  item.kind === "susAuthorization"),
                            ),
                          );
                          setErrors([]);
                        }}
                        className="sr-only"
                      />
                      {serviceLabels[type]}
                    </label>
                  ),
                )}
              </div>
              {serviceType === "INSURANCE" ? (
                <div className="border-border-light mt-6 grid gap-5 rounded-2xl border bg-white p-5 sm:grid-cols-2">
                  <label className="text-ink text-sm font-semibold sm:col-span-2">
                    Convênio <span className="text-error">*</span>
                    <select
                      value={insuranceId}
                      onChange={(event) => setInsuranceId(event.target.value)}
                      className={inputClasses}
                    >
                      <option value="">Selecione</option>
                      {activePartners.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.name}
                        </option>
                      ))}
                      <option value="OTHER">Outro convênio</option>
                    </select>
                  </label>
                  {insuranceId === "OTHER" ? (
                    <label className="text-ink text-sm font-semibold sm:col-span-2">
                      Nome do convênio <span className="text-error">*</span>
                      <input
                        value={insuranceOther}
                        onChange={(event) =>
                          setInsuranceOther(event.target.value)
                        }
                        className={inputClasses}
                      />
                    </label>
                  ) : null}
                  {field(
                    "insuranceCardNumber",
                    "Número da carteirinha (opcional)",
                  )}
                  {field("insuranceHolderName", "Nome do titular (opcional)")}
                  {field("insuranceCardExpiry", "Validade (se houver)", {
                    type: "date",
                  })}
                </div>
              ) : null}
              {serviceType === "SUS" ? (
                <div className="border-border-light mt-6 rounded-2xl border bg-white p-5">
                  <h3 className="font-heading text-ink text-lg font-semibold">
                    Dados e documentos do atendimento pelo SUS
                  </h3>
                  <p className="text-muted mt-2 text-sm">
                    Para solicitar o agendamento pelo SUS, informe os dados
                    disponíveis e anexe a autorização emitida pela regulação.
                  </p>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    {field(
                      "susCardNumber",
                      "Cartão Nacional de Saúde — CNS (opcional)",
                      { placeholder: "15 números" },
                    )}
                    {field(
                      "regulationNumber",
                      "Número da autorização ou regulação",
                      { placeholder: "Autorização, regulação ou SISREG" },
                    )}
                    {field(
                      "susAuthorizationNumber",
                      "Número da autorização (opcional)",
                    )}
                    {field(
                      "susRequestNumber",
                      "Número da solicitação (opcional)",
                    )}
                    {field("sisregCode", "Chave ou senha do SISREG (opcional)")}
                    {field("originCity", "Município de origem (opcional)")}
                    {field("requestingUnit", "Unidade solicitante (opcional)")}
                    {field(
                      "requestingProfessional",
                      "Profissional solicitante (opcional)",
                    )}
                    {field(
                      "authorizationDate",
                      "Data da autorização (opcional)",
                      { type: "date" },
                    )}
                    {field(
                      "authorizationExpiry",
                      "Validade da autorização (opcional)",
                      { type: "date" },
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div hidden={step !== 3}>
              <h2 className="font-heading text-ink text-2xl font-semibold">
                Documentos
              </h2>
              <p className="text-muted mt-2 text-sm">
                Os arquivos ficam privados e disponíveis temporariamente para a
                equipe autorizada.
              </p>
              <div className="mt-6 space-y-7">
                <MultiDocumentUploadField
                  kind="medicalOrder"
                  label="Pedido médico"
                  description="Anexe o pedido médico. Um mesmo pedido pode conter vários exames e várias páginas."
                  required
                  multiple
                  files={fileGroup("medicalOrder")}
                  progress={progress}
                  disabled={isSubmitting}
                  onAdd={addFiles}
                  onRemove={(id) =>
                    setFiles((current) =>
                      current.filter((item) => item.id !== id),
                    )
                  }
                />
                {serviceType === "SUS" ? (
                  <>
                    <MultiDocumentUploadField
                      kind="susAuthorization"
                      label="Autorização da regulação"
                      description="Anexe a autorização da regulação ou documento do SISREG. Você pode enviar várias páginas."
                      required={settings.susAuthorizationRequired}
                      multiple
                      files={fileGroup("susAuthorization")}
                      progress={progress}
                      disabled={isSubmitting}
                      onAdd={addFiles}
                      onRemove={(id) =>
                        setFiles((current) =>
                          current.filter((item) => item.id !== id),
                        )
                      }
                    />
                    {!settings.susAuthorizationRequired ? (
                      <label className="text-ink flex items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={authorizationPending}
                          onChange={(event) =>
                            setAuthorizationPending(event.target.checked)
                          }
                          className="text-brand focus:ring-tech mt-0.5 h-5 w-5 rounded"
                        />
                        Ainda não tenho o documento. Registrar como pendência
                        para envio posterior.
                      </label>
                    ) : null}
                  </>
                ) : null}
                {serviceType === "INSURANCE" ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    <MultiDocumentUploadField
                      kind="insuranceCardFront"
                      label="Carteirinha — frente"
                      description="Opcional. Envie uma imagem legível."
                      files={fileGroup("insuranceCardFront")}
                      progress={progress}
                      disabled={isSubmitting}
                      onAdd={addFiles}
                      onRemove={(id) =>
                        setFiles((current) =>
                          current.filter((item) => item.id !== id),
                        )
                      }
                    />
                    <MultiDocumentUploadField
                      kind="insuranceCardBack"
                      label="Carteirinha — verso"
                      description="Opcional. Envie se houver informações no verso."
                      files={fileGroup("insuranceCardBack")}
                      progress={progress}
                      disabled={isSubmitting}
                      onAdd={addFiles}
                      onRemove={(id) =>
                        setFiles((current) =>
                          current.filter((item) => item.id !== id),
                        )
                      }
                    />
                  </div>
                ) : null}
                <MultiDocumentUploadField
                  kind="other"
                  label="Outros documentos"
                  description="Opcional. Inclua somente arquivos úteis para analisar esta solicitação."
                  multiple
                  files={fileGroup("other")}
                  progress={progress}
                  disabled={isSubmitting}
                  onAdd={addFiles}
                  onRemove={(id) =>
                    setFiles((current) =>
                      current.filter((item) => item.id !== id),
                    )
                  }
                />
              </div>
            </div>

            <div hidden={step !== 4}>
              <h2 className="font-heading text-ink text-2xl font-semibold">
                Datas e períodos disponíveis
              </h2>
              <p className="text-muted mt-2 text-sm">
                Selecione os períodos em que você tem disponibilidade. A equipe
                confirmará a data e o horário.
              </p>
              <fieldset className="mt-6">
                <legend className="text-ink text-sm font-semibold">
                  Datas preferenciais
                </legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  {dates.map((date, index) => (
                    <label key={index} className="text-muted text-xs">
                      {index === 0 ? "Preferencial" : `Alternativa ${index}`}
                      <input
                        type="date"
                        value={date}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(event) =>
                          setDates((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? event.target.value : item,
                            ),
                          )
                        }
                        className={inputClasses}
                      />
                    </label>
                  ))}
                </div>
                {dates.length < 3 ? (
                  <button
                    type="button"
                    onClick={() => setDates((current) => [...current, ""])}
                    className="text-brand mt-3 text-sm font-bold"
                  >
                    + Adicionar outra data
                  </button>
                ) : null}
              </fieldset>
              <fieldset className="mt-7">
                <legend className="text-ink text-sm font-semibold">
                  Períodos
                </legend>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      "MORNING",
                      "AFTERNOON",
                      "EVENING",
                      "ANY",
                    ] as PreferredPeriod[]
                  ).map((period) => (
                    <label
                      key={period}
                      className={`cursor-pointer rounded-2xl border p-3 text-center text-sm font-semibold ${periods.includes(period) ? "border-brand bg-mint text-brand-dark" : "border-border-light text-ink bg-white"}`}
                    >
                      <input
                        type="checkbox"
                        checked={periods.includes(period)}
                        onChange={() =>
                          setPeriods((current) =>
                            period === "ANY"
                              ? current.includes("ANY")
                                ? []
                                : ["ANY"]
                              : current.includes(period)
                                ? current.filter((item) => item !== period)
                                : [
                                    ...current.filter((item) => item !== "ANY"),
                                    period,
                                  ],
                          )
                        }
                        className="sr-only"
                      />
                      {periodLabels[period]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="text-ink mt-7 block text-sm font-semibold">
                Observações{" "}
                <span className="text-muted font-normal">(opcional)</span>
                <textarea
                  name="observations"
                  value={observations}
                  onChange={(event) =>
                    setObservations(event.target.value.slice(0, 1000))
                  }
                  rows={4}
                  className={`${inputClasses} py-3`}
                />
                <span className="text-muted mt-1 block text-right text-xs">
                  {observations.length}/1000
                </span>
              </label>
              <label className="text-ink mt-5 block text-sm font-semibold">
                Canal de WhatsApp
                <select
                  value={channel}
                  onChange={(event) =>
                    setChannel(event.target.value as Channel)
                  }
                  className={inputClasses}
                >
                  <option value="primary">
                    {whatsapp.primary.label} — {whatsapp.primary.display}
                  </option>
                  <option value="secondary">
                    {whatsapp.secondary.label} — {whatsapp.secondary.display}
                  </option>
                </select>
              </label>
            </div>

            <div hidden={step !== 5}>
              <h2 className="font-heading text-ink text-2xl font-semibold">
                Revise sua solicitação
              </h2>
              <p className="text-muted mt-2 text-sm">
                Volte para editar qualquer informação antes de enviar.
              </p>
              <div className="mt-5 space-y-4 text-sm">
                <section className="rounded-2xl bg-white p-4">
                  <h3 className="text-brand font-bold">
                    EXAMES — {selectedExams.length}
                  </h3>
                  <ul className="text-ink mt-2 list-disc space-y-1 pl-5">
                    {selectedExams.map((exam) => (
                      <li key={exam.id}>
                        {exam.name}{" "}
                        <span className="text-muted">— {exam.modality}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="rounded-2xl bg-white p-4">
                  <h3 className="text-brand font-bold">ATENDIMENTO</h3>
                  <p className="text-ink mt-2">
                    {serviceType ? serviceLabels[serviceType] : "Não informado"}
                    {serviceType === "INSURANCE"
                      ? ` — ${insuranceId === "OTHER" ? insuranceOther : (selectedPartner?.name ?? "")}`
                      : ""}
                  </p>
                  {serviceType === "SUS" && authorizationPending ? (
                    <p className="text-warning mt-1 font-semibold">
                      Autorização da regulação pendente
                    </p>
                  ) : null}
                </section>
                <section className="rounded-2xl bg-white p-4">
                  <h3 className="text-brand font-bold">DOCUMENTOS</h3>
                  <ul className="text-ink mt-2 list-disc pl-5">
                    {files.map((item) => (
                      <li key={item.id}>{item.file.name}</li>
                    ))}
                  </ul>
                </section>
                <section className="rounded-2xl bg-white p-4">
                  <h3 className="text-brand font-bold">DISPONIBILIDADE</h3>
                  <p className="text-ink mt-2">
                    {dates.filter(Boolean).map(formatDate).join(" · ")}
                  </p>
                  <p className="text-muted mt-1">
                    {periods.map((period) => periodLabels[period]).join(" · ")}
                  </p>
                </section>
              </div>
              <p className="text-muted mt-5 flex items-start gap-2 text-sm leading-relaxed">
                <LockKeyhole
                  aria-hidden="true"
                  className="text-brand mt-0.5 shrink-0"
                  size={17}
                />
                Seus dados e documentos serão usados exclusivamente para
                organizar esta solicitação, com acesso restrito à equipe
                autorizada.
              </p>
              <label className="text-ink mt-5 flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="text-brand focus:ring-tech mt-0.5 h-5 w-5 shrink-0 rounded"
                />
                <span>
                  Autorizo o uso dos meus dados e documentos para análise e
                  organização do atendimento pela INNEURO.
                </span>
              </label>
            </div>

            <div className="border-border-light mt-8 flex items-center justify-between gap-3 border-t pt-6">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setErrors([]);
                    setStep((current) => current - 1);
                  }}
                  disabled={isSubmitting}
                  className="text-brand focus-visible:ring-tech inline-flex min-h-11 items-center gap-1 rounded-full px-4 font-bold focus-visible:ring-2 focus-visible:outline-none"
                >
                  <ChevronLeft aria-hidden="true" size={18} /> Voltar
                </button>
              ) : (
                <span />
              )}
              {step < 5 ? (
                <button
                  type="submit"
                  className="bg-brand hover:bg-brand-dark focus-visible:ring-tech inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-bold text-white focus-visible:ring-2 focus-visible:outline-none"
                >
                  Continuar <ChevronRight aria-hidden="true" size={18} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !normalizeWhatsAppNumber(whatsapp[channel].number)
                  }
                  className="bg-brand hover:bg-brand-dark focus-visible:ring-tech inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-bold text-white focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                >
                  <ShieldCheck aria-hidden="true" size={18} />
                  {phase === "uploading"
                    ? "Enviando documentos…"
                    : phase === "saving"
                      ? "Salvando solicitação…"
                      : "Enviar solicitação"}
                </button>
              )}
            </div>
          </form>
        </div>
      </Container>
    </section>
  );
}
