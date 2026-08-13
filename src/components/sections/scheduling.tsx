"use client";

import Link from "next/link";
import {
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  MessageCircle,
  Plus,
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
  getSchedulingModalityLabel,
  inferSchedulingModality,
  isValidCpf,
  MAX_REQUEST_SIZE,
  schedulingModalities,
  type DocumentKind,
  type FinalizeSchedulingResponse,
  type PrepareUploadResponse,
  type PreferredPeriod,
  type SchedulingExamInput,
  type SchedulingModality,
  type ServiceType,
  validateFileDescriptor,
} from "@/lib/scheduling/shared";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
import type { Convenio } from "@/types/convenio";

type SubmitPhase = "idle" | "uploading" | "saving";
type Success = FinalizeSchedulingResponse & {
  examCount: number;
  serviceType: ServiceType;
  authorizationPending: boolean;
};

const steps = ["Exames", "Seus dados", "Finalizar"];
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
  ANY: "Qualquer horário",
};
const schedulingSessionKey = "inneuro-scheduling-modalities-v4";
const legacySchedulingSessionKey = "inneuro-scheduling-exams-v3";
const publicSchedulingModalities: SchedulingModality[] =
  schedulingModalities.map((modality) => modality.id);

function isSchedulingModality(value: unknown): value is SchedulingModality {
  return schedulingModalities.some((modality) => modality.id === value);
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskCpf(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11
    ? `***.***.${digits.slice(6, 9)}-${digits.slice(9)}`
    : value;
}

function formatDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
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
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable)
        onProgress(
          Math.min(99, Math.round((event.loaded / event.total) * 100)),
        );
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(
          new Error(
            "Um documento não pôde ser enviado. Verifique sua conexão.",
          ),
        );
      }
    });
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
  const [selectedModalities, setSelectedModalities] = useState<
    SchedulingModality[]
  >([]);
  const [patientName, setPatientName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType | "">("");
  const [insuranceSearch, setInsuranceSearch] = useState("");
  const [insuranceId, setInsuranceId] = useState("");
  const [insuranceOther, setInsuranceOther] = useState("");
  const [files, setFiles] = useState<SelectedSchedulingFile[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [authorizationPending, setAuthorizationPending] = useState(false);
  const [dates, setDates] = useState([""]);
  const [periods, setPeriods] = useState<PreferredPeriod[]>([]);
  const [observations, setObservations] = useState("");
  const [consent, setConsent] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [success, setSuccess] = useState<Success | null>(null);
  const [startedAt] = useState(() => Date.now());
  const isSubmitting = phase !== "idle";

  const activePartners = useMemo(
    () =>
      partners.filter(
        (partner) => partner.category === "convenio" && partner.active,
      ),
    [partners],
  );
  const filteredPartners = useMemo(() => {
    const term = insuranceSearch.trim().toLocaleLowerCase("pt-BR");
    return activePartners.filter(
      (partner) =>
        !term || partner.name.toLocaleLowerCase("pt-BR").includes(term),
    );
  }, [activePartners, insuranceSearch]);
  const selectedPartner = activePartners.find(
    (partner) => partner.id === insuranceId,
  );
  const examEntries = useMemo<SchedulingExamInput[]>(
    () =>
      selectedModalities.map((modality, order) => ({
        modality,
        description: getSchedulingModalityLabel(modality),
        examId: null,
        order,
      })),
    [selectedModalities],
  );

  useEffect(() => {
    let storedModalities: SchedulingModality[] = [];
    try {
      const currentStored = window.sessionStorage.getItem(schedulingSessionKey);
      const legacyStored = window.sessionStorage.getItem(
        legacySchedulingSessionKey,
      );
      const currentParsed = currentStored ? JSON.parse(currentStored) : null;
      const legacyParsed = legacyStored ? JSON.parse(legacyStored) : [];
      const candidates = Array.isArray(currentParsed)
        ? currentParsed
        : Array.isArray(legacyParsed)
          ? legacyParsed.map((item) => item?.modality)
          : [];
      storedModalities = candidates.filter(isSchedulingModality);
    } catch {
      storedModalities = [];
    }
    const initialOfficial = exams.find(
      (exam) =>
        exam.id === initialExam ||
        exam.name.toLocaleLowerCase("pt-BR") ===
          initialExam.toLocaleLowerCase("pt-BR"),
    );
    const initialModality = inferSchedulingModality(
      initialOfficial?.modality || initialExam,
    );
    if (initialExam && initialModality) storedModalities.push(initialModality);
    window.queueMicrotask(() => {
      setSelectedModalities([...new Set(storedModalities)]);
      window.sessionStorage.removeItem(legacySchedulingSessionKey);
    });
  }, [exams, initialExam]);

  useEffect(() => {
    window.sessionStorage.setItem(
      schedulingSessionKey,
      JSON.stringify(selectedModalities),
    );
  }, [selectedModalities]);

  function toggleModality(modality: SchedulingModality) {
    setSelectedModalities((current) =>
      current.includes(modality)
        ? current.filter((item) => item !== modality)
        : [...current, modality],
    );
    setErrors([]);
  }

  function validateSelectedFile(kind: DocumentKind, file: File) {
    const id = crypto.randomUUID();
    const error = validateFileDescriptor({
      id,
      kind,
      name: file.name,
      size: file.size,
      type: file.type,
    });
    return { id, error };
  }

  function addFiles(kind: DocumentKind, incoming: File[]) {
    const nextErrors: string[] = [];
    const accepted = incoming.slice(0, 12).flatMap((file) => {
      const { id, error } = validateSelectedFile(kind, file);
      if (error) {
        nextErrors.push(`${file.name}: ${error}`);
        return [];
      }
      return [{ id, kind, file }];
    });
    const singleKinds: DocumentKind[] = [
      "photoId",
      "insuranceCardFront",
      "insuranceCardBack",
      "susCard",
    ];
    setFiles((current) => {
      const base = singleKinds.includes(kind)
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

  function replaceFile(id: string, kind: DocumentKind, file: File) {
    const checked = validateSelectedFile(kind, file);
    if (checked.error) {
      setErrors([`${file.name}: ${checked.error}`]);
      return;
    }
    setFiles((current) => {
      const result = current.map((item) =>
        item.id === id ? { id: checked.id, kind, file } : item,
      );
      if (
        result.reduce((total, item) => total + item.file.size, 0) >
        MAX_REQUEST_SIZE
      ) {
        setErrors(["O total dos arquivos pode ter no máximo 25 MB."]);
        return current;
      }
      return result;
    });
    setErrors([]);
  }

  function selectService(type: ServiceType) {
    setServiceType(type);
    setAuthorizationPending(false);
    setFiles((current) =>
      current.filter(
        (item) =>
          item.kind === "medicalOrder" ||
          item.kind === "photoId" ||
          (type === "INSURANCE" &&
            [
              "insuranceCardFront",
              "insuranceCardBack",
              "insuranceAuthorization",
            ].includes(item.kind)) ||
          (type === "SUS" &&
            ["susAuthorization", "susCard"].includes(item.kind)),
      ),
    );
    setErrors([]);
  }

  const fileGroup = (kind: DocumentKind) =>
    files.filter((item) => item.kind === kind);

  function validateStep(target: number) {
    const next: string[] = [];
    if (target === 0) {
      if (!selectedModalities.length)
        next.push("Escolha pelo menos um tipo de exame.");
    }
    if (target === 1) {
      if (patientName.trim().length < 2) next.push("Informe o nome completo.");
      if (!isValidCpf(cpf)) next.push("Confira o CPF informado.");
      if (!birthDate) next.push("Informe a data de nascimento.");
      else if (birthDate > new Date().toISOString().slice(0, 10))
        next.push("A data de nascimento não pode estar no futuro.");
      if (!/^\d{10,11}$/.test(phone.replace(/\D/g, "")))
        next.push("Informe um Telefone / WhatsApp válido com DDD.");
      if (!serviceType) next.push("Escolha como será o atendimento.");
      if (serviceType === "INSURANCE" && !insuranceId)
        next.push("Selecione o convênio.");
      if (
        serviceType === "INSURANCE" &&
        insuranceId === "OTHER" &&
        !insuranceOther.trim()
      )
        next.push("Digite o nome do convênio.");
    }
    if (target === 2) {
      if (!files.some((item) => item.kind === "medicalOrder"))
        next.push("Anexe o pedido médico.");
      if (!files.some((item) => item.kind === "photoId"))
        next.push("Anexe um documento oficial com foto.");
      if (
        serviceType === "INSURANCE" &&
        !files.some((item) => item.kind === "insuranceCardFront")
      )
        next.push("Anexe a carteirinha do convênio.");
      if (
        serviceType === "SUS" &&
        !files.some((item) => item.kind === "susAuthorization") &&
        !authorizationPending
      )
        next.push(
          "Anexe a autorização do SISREG ou marque que ainda não a possui.",
        );
      if (
        serviceType === "SUS" &&
        settings.susAuthorizationRequired &&
        !files.some((item) => item.kind === "susAuthorization")
      )
        next.push("A autorização da Regulação / SISREG é obrigatória.");
      if (!dates.some(Boolean)) next.push("Escolha uma data preferencial.");
      if (!periods.length) next.push("Selecione ao menos um período.");
      if (!consent)
        next.push("Confirme o uso dos dados para enviar a solicitação.");
    }
    setErrors(next);
    return next.length === 0;
  }

  function goNext() {
    if (validateStep(step)) {
      setStep((current) => Math.min(2, current + 1));
      setReviewing(false);
      document
        .getElementById("pre-agendamento")
        ?.scrollIntoView({ behavior: "smooth" });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 2) {
      goNext();
      return;
    }
    if (!reviewing) {
      if (validateStep(2)) setReviewing(true);
      return;
    }
    if (!validateStep(2) || isSubmitting || !serviceType) return;
    const data = new FormData(event.currentTarget);
    const insuranceName =
      insuranceId === "OTHER"
        ? insuranceOther.trim()
        : (selectedPartner?.name ?? "");
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
            throw new Error("Um arquivo selecionado não está disponível.");
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
          name: patientName,
          cpf,
          birthDate,
          phone,
          exams: examEntries.map(
            ({ modality, description, examId, order }) => ({
              modality,
              description,
              examId,
              order,
            }),
          ),
          insuranceId: insuranceId === "OTHER" ? null : insuranceId,
          insuranceName,
          preferredDates: dates.filter(Boolean),
          preferredPeriods: periods,
          observations,
          channel: "primary",
        }),
      }).then((response) =>
        readJsonResponse<FinalizeSchedulingResponse>(response),
      );
      window.sessionStorage.removeItem(schedulingSessionKey);
      window.sessionStorage.removeItem(legacySchedulingSessionKey);
      setSuccess({
        ...finalized,
        examCount: examEntries.length,
        serviceType,
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
              Solicitação recebida!
            </h1>
            <p className="text-muted mt-3 leading-relaxed">
              Recebemos sua solicitação. Nossa equipe analisará os exames e
              documentos enviados e entrará em contato pelo WhatsApp para
              confirmar a data e o horário.
            </p>
            <p className="text-brand mt-6 rounded-2xl bg-white p-4 font-bold">
              Protocolo: {success.protocol}
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={success.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-brand hover:bg-brand-dark focus-visible:ring-tech inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-7 font-bold text-white focus-visible:ring-2 focus-visible:outline-none"
              >
                <MessageCircle aria-hidden="true" size={18} /> Falar com a
                INNEURO pelo WhatsApp
              </a>
              <Link
                href="/"
                className="border-brand text-brand inline-flex min-h-12 items-center justify-center rounded-full border px-7 font-bold"
              >
                Voltar ao início
              </Link>
            </div>
          </div>
        </Container>
      </section>
    );

  const documentStatus = (kind: DocumentKind, fallback = "Pendente") =>
    files.some((item) => item.kind === kind) ? "Anexado" : fallback;

  return (
    <section
      id="pre-agendamento"
      aria-labelledby="scheduling-title"
      className="scroll-mt-24 bg-white pt-20 pb-12 sm:pt-24 xl:scroll-mt-28"
    >
      <Container>
        <div className="grid items-start gap-6 lg:grid-cols-[.72fr_1.28fr] lg:gap-10">
          <div className="lg:sticky lg:top-28">
            <Badge>Pré-agendamento</Badge>
            <h1
              id="scheduling-title"
              className="font-heading text-ink mt-3 text-[clamp(2rem,4vw,3rem)] leading-[1.02] font-semibold tracking-[-.05em]"
            >
              Organize sua solicitação de exame.
            </h1>
            <p className="text-muted mt-3 leading-relaxed">
              Informe somente o necessário. A equipe da INNEURO conferirá os
              detalhes e confirmará o atendimento pelo WhatsApp.
            </p>
            <div className="bg-mint mt-5 rounded-3xl p-4">
              <CalendarCheck
                aria-hidden="true"
                className="text-brand"
                size={22}
              />
              <p className="text-ink mt-2 font-semibold">
                Realizamos exames todos os dias.
              </p>
              <p className="text-muted mt-1 text-sm">
                Segunda a sábado: 07h às 22h.
              </p>
              <p className="text-muted text-sm">Domingo: 07h às 19h.</p>
              <p className="text-muted mt-2 text-sm">
                A data e o horário serão confirmados pela equipe da INNEURO pelo
                WhatsApp.
              </p>
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
              className="mb-7 grid grid-cols-3 gap-2"
              aria-label="Progresso da solicitação"
            >
              {steps.map((label, index) => (
                <li
                  key={label}
                  aria-current={step === index ? "step" : undefined}
                  className="text-center"
                >
                  <span
                    className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${index <= step ? "bg-brand text-white" : "text-muted bg-white"}`}
                  >
                    {index + 1}
                  </span>
                  <span className="text-muted mt-1 block text-xs font-semibold">
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
                Qual exame você precisa realizar?
              </h2>
              <p className="text-muted mt-2 text-sm">
                Selecione o tipo de exame que deseja realizar. Nossa equipe
                identificará os detalhes pelo seu pedido médico.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {publicSchedulingModalities.map((modality) => {
                  const selected = selectedModalities.includes(modality);
                  return (
                    <button
                      key={modality}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleModality(modality)}
                      className={`flex min-h-20 items-center gap-3 rounded-2xl border p-4 text-left font-bold ${selected ? "border-brand bg-mint text-brand-dark" : "border-border-light text-ink bg-white"}`}
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${selected ? "bg-brand text-white" : "bg-surface text-muted"}`}
                      >
                        {selected ? (
                          <Check aria-hidden="true" size={16} />
                        ) : (
                          <Plus aria-hidden="true" size={16} />
                        )}
                      </span>
                      {getSchedulingModalityLabel(modality)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div hidden={step !== 1}>
              <h2 className="font-heading text-ink text-2xl font-semibold">
                Seus dados
              </h2>
              <p className="text-muted mt-2 text-sm">
                Precisamos somente dos dados necessários para identificar você e
                entrar em contato.
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="text-ink text-sm font-semibold sm:col-span-2">
                  Nome completo <span className="text-error">*</span>
                  <input
                    value={patientName}
                    onChange={(event) =>
                      setPatientName(event.target.value.slice(0, 120))
                    }
                    autoComplete="name"
                    className={inputClasses}
                  />
                </label>
                <label className="text-ink text-sm font-semibold">
                  CPF <span className="text-error">*</span>
                  <input
                    value={cpf}
                    onChange={(event) => setCpf(formatCpf(event.target.value))}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="000.000.000-00"
                    className={inputClasses}
                  />
                </label>
                <label className="text-ink text-sm font-semibold">
                  Data de nascimento <span className="text-error">*</span>
                  <input
                    type="date"
                    value={birthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setBirthDate(event.target.value)}
                    autoComplete="bday"
                    className={inputClasses}
                  />
                </label>
                <label className="text-ink text-sm font-semibold sm:col-span-2">
                  Telefone / WhatsApp <span className="text-error">*</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(formatPhone(event.target.value))
                    }
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(00) 00000-0000"
                    className={inputClasses}
                  />
                </label>
              </div>

              <fieldset className="mt-8">
                <legend className="font-heading text-ink text-xl font-semibold">
                  Como será seu atendimento?
                </legend>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {(["PARTICULAR", "INSURANCE", "SUS"] as ServiceType[]).map(
                    (type) => (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={serviceType === type}
                        onClick={() => selectService(type)}
                        className={`min-h-16 rounded-2xl border p-4 font-bold ${serviceType === type ? "border-brand bg-mint text-brand-dark" : "border-border-light text-ink bg-white"}`}
                      >
                        {serviceLabels[type]}
                      </button>
                    ),
                  )}
                </div>
              </fieldset>

              {serviceType === "INSURANCE" ? (
                <section className="border-border-light mt-6 rounded-2xl border bg-white p-5">
                  <h3 className="font-heading text-ink text-lg font-semibold">
                    Qual é o seu convênio?
                  </h3>
                  <label className="text-ink mt-4 block text-sm font-semibold">
                    Buscar convênio
                    <input
                      value={insuranceSearch}
                      onChange={(event) =>
                        setInsuranceSearch(event.target.value)
                      }
                      placeholder="Digite o nome"
                      className={inputClasses}
                    />
                  </label>
                  <label className="text-ink mt-4 block text-sm font-semibold">
                    Convênio <span className="text-error">*</span>
                    <select
                      value={insuranceId}
                      onChange={(event) => setInsuranceId(event.target.value)}
                      className={inputClasses}
                    >
                      <option value="">Selecione</option>
                      {filteredPartners.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.name}
                        </option>
                      ))}
                      <option value="OTHER">Outro convênio</option>
                    </select>
                  </label>
                  {insuranceId === "OTHER" ? (
                    <label className="text-ink mt-4 block text-sm font-semibold">
                      Digite o nome do convênio{" "}
                      <span className="text-error">*</span>
                      <input
                        value={insuranceOther}
                        onChange={(event) =>
                          setInsuranceOther(event.target.value.slice(0, 100))
                        }
                        className={inputClasses}
                      />
                    </label>
                  ) : null}
                </section>
              ) : null}
            </div>

            <div hidden={step !== 2}>
              {!reviewing ? (
                <>
                  <h2 className="font-heading text-ink text-2xl font-semibold">
                    Envie seus documentos
                  </h2>
                  <p className="text-muted mt-2 text-sm">
                    Envie fotos legíveis ou arquivos dos documentos necessários.
                  </p>
                  <p className="bg-mint text-brand-dark mt-4 rounded-2xl p-4 text-sm font-semibold">
                    Seu pedido médico pode conter vários exames. Não é
                    necessário enviar um pedido diferente para cada exame.
                  </p>
                  <div className="mt-6 space-y-7">
                    <MultiDocumentUploadField
                      kind="medicalOrder"
                      label="Pedido médico"
                      description="Pode conter vários exames e várias páginas."
                      required
                      multiple
                      files={fileGroup("medicalOrder")}
                      progress={progress}
                      disabled={isSubmitting}
                      onAdd={addFiles}
                      onReplace={replaceFile}
                      onRemove={(id) =>
                        setFiles((current) =>
                          current.filter((item) => item.id !== id),
                        )
                      }
                    />
                    <MultiDocumentUploadField
                      kind="photoId"
                      label="Documento oficial com foto"
                      description="Envie RG, CNH ou outro documento oficial com foto."
                      required
                      files={fileGroup("photoId")}
                      progress={progress}
                      disabled={isSubmitting}
                      onAdd={addFiles}
                      onReplace={replaceFile}
                      onRemove={(id) =>
                        setFiles((current) =>
                          current.filter((item) => item.id !== id),
                        )
                      }
                    />
                    {serviceType === "INSURANCE" ? (
                      <>
                        <div className="grid gap-6 md:grid-cols-2">
                          <MultiDocumentUploadField
                            kind="insuranceCardFront"
                            label="Carteirinha — frente"
                            description="Envie uma imagem legível da frente."
                            required
                            files={fileGroup("insuranceCardFront")}
                            progress={progress}
                            disabled={isSubmitting}
                            onAdd={addFiles}
                            onReplace={replaceFile}
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
                            onReplace={replaceFile}
                            onRemove={(id) =>
                              setFiles((current) =>
                                current.filter((item) => item.id !== id),
                              )
                            }
                          />
                        </div>
                        <MultiDocumentUploadField
                          kind="insuranceAuthorization"
                          label="Autorização ou guia do convênio"
                          description="Opcional nesta primeira solicitação."
                          multiple
                          files={fileGroup("insuranceAuthorization")}
                          progress={progress}
                          disabled={isSubmitting}
                          onAdd={addFiles}
                          onReplace={replaceFile}
                          onRemove={(id) =>
                            setFiles((current) =>
                              current.filter((item) => item.id !== id),
                            )
                          }
                        />
                      </>
                    ) : null}
                    {serviceType === "SUS" ? (
                      <>
                        <MultiDocumentUploadField
                          kind="susAuthorization"
                          label="Autorização da Regulação / SISREG"
                          description="Envie todas as páginas disponíveis."
                          required={settings.susAuthorizationRequired}
                          multiple
                          files={fileGroup("susAuthorization")}
                          progress={progress}
                          disabled={isSubmitting}
                          onAdd={addFiles}
                          onReplace={replaceFile}
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
                            Não tenho este documento agora. Registrar como
                            pendência para envio posterior.
                          </label>
                        ) : null}
                        <MultiDocumentUploadField
                          kind="susCard"
                          label="Cartão SUS"
                          description="Opcional."
                          files={fileGroup("susCard")}
                          progress={progress}
                          disabled={isSubmitting}
                          onAdd={addFiles}
                          onReplace={replaceFile}
                          onRemove={(id) =>
                            setFiles((current) =>
                              current.filter((item) => item.id !== id),
                            )
                          }
                        />
                      </>
                    ) : null}
                  </div>

                  <section className="border-border-light mt-9 rounded-3xl border bg-white p-5">
                    <h3 className="font-heading text-ink text-xl font-semibold">
                      Quando você prefere realizar seus exames?
                    </h3>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {dates.map((date, index) => (
                        <label
                          key={index}
                          className="text-ink text-sm font-semibold"
                        >
                          {index === 0
                            ? "Data preferencial"
                            : "Outra data (opcional)"}
                          <input
                            type="date"
                            value={date}
                            min={new Date().toISOString().slice(0, 10)}
                            onChange={(event) =>
                              setDates((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? event.target.value
                                    : item,
                                ),
                              )
                            }
                            className={inputClasses}
                          />
                        </label>
                      ))}
                    </div>
                    {dates.length < 2 ? (
                      <button
                        type="button"
                        onClick={() => setDates((current) => [...current, ""])}
                        className="text-brand mt-3 min-h-10 text-sm font-bold"
                      >
                        + Adicionar outra data
                      </button>
                    ) : null}
                    <fieldset className="mt-6">
                      <legend className="text-ink text-sm font-semibold">
                        Período
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
                          <button
                            key={period}
                            type="button"
                            aria-pressed={periods.includes(period)}
                            onClick={() =>
                              setPeriods((current) =>
                                period === "ANY"
                                  ? current.includes("ANY")
                                    ? []
                                    : ["ANY"]
                                  : current.includes(period)
                                    ? current.filter((item) => item !== period)
                                    : [
                                        ...current.filter(
                                          (item) => item !== "ANY",
                                        ),
                                        period,
                                      ],
                              )
                            }
                            className={`min-h-12 rounded-2xl border p-3 text-sm font-semibold ${periods.includes(period) ? "border-brand bg-mint text-brand-dark" : "border-border-light text-ink bg-white"}`}
                          >
                            {periodLabels[period]}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <div className="bg-mint mt-6 rounded-2xl p-4 text-sm">
                      <p className="text-ink font-semibold">
                        Realizamos exames todos os dias.
                      </p>
                      <p className="text-muted mt-1">
                        Segunda a sábado: 07h às 22h. Domingo: 07h às 19h.
                      </p>
                    </div>
                    <label className="text-ink mt-6 block text-sm font-semibold">
                      Deseja informar mais alguma coisa?{" "}
                      <span className="text-muted font-normal">(opcional)</span>
                      <textarea
                        value={observations}
                        onChange={(event) =>
                          setObservations(event.target.value.slice(0, 500))
                        }
                        rows={4}
                        placeholder="Ex.: preciso realizar os exames no mesmo dia."
                        className={`${inputClasses} py-3`}
                      />
                      <span className="text-muted mt-1 block text-right text-xs">
                        {observations.length}/500
                      </span>
                    </label>
                  </section>

                  <label className="text-ink mt-6 flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(event) => setConsent(event.target.checked)}
                      className="text-brand focus:ring-tech mt-0.5 h-5 w-5 shrink-0 rounded"
                    />
                    <span>
                      Ao enviar esta solicitação, você concorda com o uso dos
                      dados e documentos informados pela INNEURO exclusivamente
                      para análise e contato relacionado ao seu atendimento.{" "}
                      <Link
                        href="/politica-de-privacidade"
                        className="text-brand font-bold underline"
                      >
                        Política de Privacidade
                      </Link>
                    </span>
                  </label>
                </>
              ) : (
                <>
                  <h2 className="font-heading text-ink text-2xl font-semibold">
                    Revise sua solicitação
                  </h2>
                  <p className="text-muted mt-2 text-sm">
                    Confira as informações antes de enviar.
                  </p>
                  <div className="mt-5 space-y-4 text-sm">
                    <section className="rounded-2xl bg-white p-4">
                      <h3 className="text-brand font-bold">EXAMES</h3>
                      <ul className="text-ink mt-3 space-y-2 font-semibold">
                        {selectedModalities.map((modality) => (
                          <li
                            key={modality}
                            className="flex items-center gap-2"
                          >
                            <Check
                              aria-hidden="true"
                              className="text-brand shrink-0"
                              size={17}
                            />
                            {getSchedulingModalityLabel(modality)}
                          </li>
                        ))}
                      </ul>
                    </section>
                    <section className="rounded-2xl bg-white p-4">
                      <h3 className="text-brand font-bold">PACIENTE</h3>
                      <p className="text-ink mt-2">{patientName}</p>
                      <p className="text-muted">CPF: {maskCpf(cpf)}</p>
                      <p className="text-muted">
                        Nascimento: {formatDate(birthDate)}
                      </p>
                      <p className="text-muted">WhatsApp: {phone}</p>
                    </section>
                    <section className="rounded-2xl bg-white p-4">
                      <h3 className="text-brand font-bold">ATENDIMENTO</h3>
                      <p className="text-ink mt-2">
                        {serviceType
                          ? serviceLabels[serviceType]
                          : "Não informado"}
                        {serviceType === "INSURANCE"
                          ? ` — ${insuranceId === "OTHER" ? insuranceOther : (selectedPartner?.name ?? "")}`
                          : ""}
                      </p>
                    </section>
                    <section className="rounded-2xl bg-white p-4">
                      <h3 className="text-brand font-bold">DOCUMENTOS</h3>
                      <ul className="text-muted mt-2 space-y-1">
                        <li>
                          ✓ Pedido médico: {documentStatus("medicalOrder")}
                        </li>
                        <li>
                          ✓ Documento com foto: {documentStatus("photoId")}
                        </li>
                        {serviceType === "INSURANCE" ? (
                          <li>
                            ✓ Carteirinha:{" "}
                            {documentStatus("insuranceCardFront")}
                          </li>
                        ) : null}
                        {serviceType === "SUS" ? (
                          <li>
                            ✓ Regulação/SISREG:{" "}
                            {authorizationPending
                              ? "Pendente"
                              : documentStatus("susAuthorization")}
                          </li>
                        ) : null}
                      </ul>
                    </section>
                    <section className="rounded-2xl bg-white p-4">
                      <h3 className="text-brand font-bold">DISPONIBILIDADE</h3>
                      <p className="text-ink mt-2">
                        {dates.filter(Boolean).map(formatDate).join(" · ")}
                      </p>
                      <p className="text-muted mt-1">
                        {periods
                          .map((period) => periodLabels[period])
                          .join(" · ")}
                      </p>
                    </section>
                  </div>
                  <p className="text-muted mt-5 flex items-start gap-2 text-sm leading-relaxed">
                    <LockKeyhole
                      aria-hidden="true"
                      className="text-brand mt-0.5 shrink-0"
                      size={17}
                    />
                    Seus documentos ficam privados e acessíveis somente à equipe
                    autorizada.
                  </p>
                  <button
                    type="button"
                    onClick={() => setReviewing(false)}
                    className="text-brand mt-5 min-h-11 rounded-full px-4 font-bold"
                  >
                    Editar informações
                  </button>
                </>
              )}
            </div>

            <div className="border-border-light mt-8 flex items-center justify-between gap-3 border-t pt-6">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setErrors([]);
                    setReviewing(false);
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
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  (reviewing &&
                    !normalizeWhatsAppNumber(whatsapp.primary.number))
                }
                className="bg-brand hover:bg-brand-dark focus-visible:ring-tech inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-bold text-white focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                {step < 2 ? (
                  <>
                    Continuar <ChevronRight aria-hidden="true" size={18} />
                  </>
                ) : !reviewing ? (
                  <>
                    Revisar solicitação{" "}
                    <ChevronRight aria-hidden="true" size={18} />
                  </>
                ) : (
                  <>
                    <ShieldCheck aria-hidden="true" size={18} />
                    {phase === "uploading"
                      ? "Enviando documentos…"
                      : phase === "saving"
                        ? "Salvando solicitação…"
                        : "Enviar solicitação"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </Container>
    </section>
  );
}
