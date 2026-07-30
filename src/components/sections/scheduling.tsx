"use client";

import { CalendarCheck, LockKeyhole, MessageCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Container } from "@/components/layout/container";
import { DocumentUploadField } from "@/components/scheduling/document-upload-field";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import {
  documentKinds,
  MAX_REQUEST_SIZE,
  type DocumentKind,
  type FinalizeSchedulingResponse,
  type PrepareUploadResponse,
  sanitizeSchedulingText,
  validateFileDescriptor,
} from "@/lib/scheduling/shared";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";

type FieldName =
  | "name"
  | "phone"
  | "birthDate"
  | "attendance"
  | "insuranceName"
  | "exam"
  | "period"
  | "photoId"
  | "medicalOrder"
  | "insuranceCard"
  | "consent";
type Errors = Partial<Record<FieldName, string>>;
type Attendance = "" | "Particular" | "Convênio";
type Channel = "primary" | "secondary";
type SubmitPhase = "idle" | "uploading" | "opening";
type UploadState = Record<
  DocumentKind,
  { progress: number; status: "idle" | "uploading" | "complete" }
>;

const inputClasses =
  "mt-2 min-h-12 w-full rounded-2xl border border-border-light bg-white px-4 text-base text-ink outline-none transition-colors placeholder:text-muted/65 focus:border-brand focus:ring-2 focus:ring-tech/25 aria-invalid:border-error aria-invalid:ring-2 aria-invalid:ring-error/15";

const initialUploadState: UploadState = {
  photoId: { progress: 0, status: "idle" },
  medicalOrder: { progress: 0, status: "idle" },
  insuranceCard: { progress: 0, status: "idle" },
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok)
    throw new Error(payload.error || "Não foi possível concluir o envio.");
  return payload;
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
            "Um documento não pôde ser enviado. Verifique sua conexão e tente novamente.",
          ),
        );
      }
    });
    request.addEventListener("error", () =>
      reject(
        new Error(
          "O envio foi interrompido. Verifique sua conexão e tente novamente.",
        ),
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

export function Scheduling() {
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [phone, setPhone] = useState("");
  const [attendance, setAttendance] = useState<Attendance>("");
  const [insuranceName, setInsuranceName] = useState("");
  const [observations, setObservations] = useState("");
  const [channel, setChannel] = useState<Channel>("primary");
  const [files, setFiles] = useState<Record<DocumentKind, File | null>>({
    photoId: null,
    medicalOrder: null,
    insuranceCard: null,
  });
  const [uploads, setUploads] = useState<UploadState>(initialUploadState);
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [startedAt] = useState(() => Date.now());
  const isSubmitting = phase !== "idle";
  const whatsappReady = Boolean(
    normalizeWhatsAppNumber(siteConfig.whatsapp[channel].number),
  );

  function updateFile(kind: DocumentKind, file: File | null) {
    setFiles((current) => ({ ...current, [kind]: file }));
    setUploads((current) => ({
      ...current,
      [kind]: { progress: 0, status: "idle" },
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next[kind];
      if (file) {
        const error = validateFileDescriptor({
          kind,
          name: file.name,
          size: file.size,
          type: file.type,
        });
        if (error) next[kind] = error;
      }
      return next;
    });
  }

  function validateForm(form: HTMLFormElement) {
    const data = new FormData(form);
    const values = {
      name: sanitizeSchedulingText(data.get("name"), 120),
      phone: sanitizeSchedulingText(data.get("phone"), 24),
      birthDate: sanitizeSchedulingText(data.get("birthDate"), 10),
      attendance,
      insuranceName: sanitizeSchedulingText(insuranceName, 100),
      exam: sanitizeSchedulingText(data.get("exam"), 160),
      period: sanitizeSchedulingText(data.get("period"), 40),
      observations: sanitizeSchedulingText(observations, 500),
      consent: data.get("consent") === "on",
      website: sanitizeSchedulingText(data.get("website"), 80),
    };
    const nextErrors: Errors = {};
    if (!values.name) nextErrors.name = "Informe seu nome.";
    if (values.phone.replace(/\D/g, "").length < 10)
      nextErrors.phone = "Informe um telefone válido com DDD.";
    if (!values.birthDate)
      nextErrors.birthDate = "Informe sua data de nascimento.";
    if (!values.attendance)
      nextErrors.attendance = "Selecione o tipo de atendimento.";
    if (values.attendance === "Convênio" && !values.insuranceName)
      nextErrors.insuranceName = "Informe o nome do convênio.";
    if (!values.exam) nextErrors.exam = "Informe o exame ou procedimento.";
    if (!values.period) nextErrors.period = "Selecione o melhor período.";
    if (!files.photoId) nextErrors.photoId = "Anexe um documento com foto.";
    if (!files.medicalOrder) nextErrors.medicalOrder = "Anexe o pedido médico.";
    if (values.attendance === "Convênio" && !files.insuranceCard)
      nextErrors.insuranceCard = "Anexe a carteirinha do convênio.";
    if (!values.consent)
      nextErrors.consent = "Marque a autorização para continuar.";

    let totalSize = 0;
    for (const kind of documentKinds) {
      const file = files[kind];
      if (!file) continue;
      const error = validateFileDescriptor({
        kind,
        name: file.name,
        size: file.size,
        type: file.type,
      });
      if (error) nextErrors[kind] = error;
      totalSize += file.size;
    }
    if (totalSize > MAX_REQUEST_SIZE)
      setFormError("O total dos arquivos pode ter no máximo 25 MB.");

    setErrors(nextErrors);
    return {
      valid:
        Object.keys(nextErrors).length === 0 && totalSize <= MAX_REQUEST_SIZE,
      values,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!whatsappReady || isSubmitting) return;
    setFormError("");
    const form = event.currentTarget;
    const { valid, values } = validateForm(form);
    if (!valid) {
      window.requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }

    const selectedFiles = documentKinds
      .map((kind) => ({ kind, file: files[kind] }))
      .filter((entry): entry is { kind: DocumentKind; file: File } =>
        Boolean(entry.file),
      );
    const whatsappWindow = window.open("", "inneuro-whatsapp");
    if (whatsappWindow) {
      whatsappWindow.opener = null;
      whatsappWindow.document.title = "INNEURO — envio seguro";
      whatsappWindow.document.body.textContent =
        "Enviando documentos com segurança…";
    }

    try {
      setPhase("uploading");
      setUploads(initialUploadState);
      const prepareResponse = await fetch("/api/pre-agendamento/preparar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendance: values.attendance,
          website: values.website,
          startedAt,
          files: selectedFiles.map(({ kind, file }) => ({
            kind,
            name: file.name,
            size: file.size,
            type: file.type,
          })),
        }),
      }).then((response) => readJsonResponse<PrepareUploadResponse>(response));

      await Promise.all(
        prepareResponse.uploads.map(async (upload) => {
          const file = files[upload.kind];
          if (!file)
            throw new Error(
              "Um documento obrigatório não está mais selecionado.",
            );
          setUploads((current) => ({
            ...current,
            [upload.kind]: { progress: 0, status: "uploading" },
          }));
          await uploadFileToSignedUrl(upload.signedUrl, file, (progress) =>
            setUploads((current) => ({
              ...current,
              [upload.kind]: { progress, status: "uploading" },
            })),
          );
          setUploads((current) => ({
            ...current,
            [upload.kind]: { progress: 100, status: "complete" },
          }));
        }),
      );

      const finalized = await fetch("/api/pre-agendamento/finalizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken: prepareResponse.sessionToken,
          ...values,
          channel,
        }),
      }).then((response) =>
        readJsonResponse<FinalizeSchedulingResponse>(response),
      );

      if (!finalized.whatsappUrl)
        throw new Error("O canal de WhatsApp está indisponível.");
      setPhase("opening");
      if (whatsappWindow && !whatsappWindow.closed) {
        whatsappWindow.location.replace(finalized.whatsappUrl);
      } else {
        window.location.assign(finalized.whatsappUrl);
      }
    } catch (error) {
      if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
      setPhase("idle");
      setFormError(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir o envio. Tente novamente.",
      );
    }
  }

  const errorProps = (field: FieldName) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
  });

  return (
    <section
      id="pre-agendamento"
      aria-labelledby="scheduling-title"
      className="scroll-mt-24 bg-white pt-[6.5rem] pb-16 sm:pt-[6.75rem] sm:pb-20 lg:pb-28 xl:scroll-mt-28 xl:pt-32"
    >
      <Container>
        <div className="grid gap-10 lg:grid-cols-[.68fr_1.32fr] lg:gap-16">
          <div>
            <Badge>Pré-agendamento</Badge>
            <h2
              id="scheduling-title"
              className="font-heading text-ink mt-5 text-3xl leading-tight font-semibold tracking-[-0.045em] sm:text-4xl lg:text-5xl"
            >
              Organize sua solicitação de exame.
            </h2>
            <p className="text-muted mt-5 text-lg leading-relaxed">
              Preencha os dados e envie os documentos para abrir o WhatsApp com
              sua solicitação pronta.
            </p>
            <div className="bg-mint mt-8 rounded-3xl p-6">
              <CalendarCheck
                aria-hidden="true"
                className="text-brand"
                size={24}
              />
              <p className="text-ink mt-4 font-semibold">
                O horário será confirmado pela equipe após o contato.
              </p>
            </div>
          </div>

          <form
            noValidate
            onSubmit={handleSubmit}
            className="border-border-light bg-surface rounded-[2rem] border p-6 sm:p-8"
          >
            <div
              className="absolute -left-[9999px] h-px w-px overflow-hidden"
              aria-hidden="true"
            >
              <label>
                Não preencha este campo
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            {Object.keys(errors).length > 0 ? (
              <p
                role="alert"
                className="bg-error/10 text-error mb-5 rounded-2xl p-4 text-sm font-semibold"
              >
                Revise os campos indicados antes de continuar.
              </p>
            ) : null}
            {formError ? (
              <p
                role="alert"
                className="bg-error/10 text-error mb-5 rounded-2xl p-4 text-sm font-semibold"
              >
                {formError}
              </p>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-ink text-sm font-semibold">
                Nome{" "}
                <span aria-hidden="true" className="text-error">
                  *
                </span>
                <input
                  name="name"
                  autoComplete="name"
                  required
                  className={inputClasses}
                  {...errorProps("name")}
                />
                {errors.name ? (
                  <span
                    id="name-error"
                    className="text-error mt-2 block text-sm"
                  >
                    {errors.name}
                  </span>
                ) : null}
              </label>
              <label className="text-ink text-sm font-semibold">
                Telefone{" "}
                <span aria-hidden="true" className="text-error">
                  *
                </span>
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(event) =>
                    setPhone(formatPhone(event.target.value))
                  }
                  placeholder="(00) 00000-0000"
                  className={inputClasses}
                  {...errorProps("phone")}
                />
                {errors.phone ? (
                  <span
                    id="phone-error"
                    className="text-error mt-2 block text-sm"
                  >
                    {errors.phone}
                  </span>
                ) : null}
              </label>
              <label className="text-ink text-sm font-semibold">
                Data de nascimento{" "}
                <span aria-hidden="true" className="text-error">
                  *
                </span>
                <input
                  name="birthDate"
                  type="date"
                  autoComplete="bday"
                  max={new Date().toISOString().slice(0, 10)}
                  required
                  className={inputClasses}
                  {...errorProps("birthDate")}
                />
                {errors.birthDate ? (
                  <span
                    id="birthDate-error"
                    className="text-error mt-2 block text-sm"
                  >
                    {errors.birthDate}
                  </span>
                ) : null}
              </label>
              <label className="text-ink text-sm font-semibold">
                Convênio ou particular{" "}
                <span aria-hidden="true" className="text-error">
                  *
                </span>
                <select
                  name="attendance"
                  value={attendance}
                  required
                  className={inputClasses}
                  {...errorProps("attendance")}
                  onChange={(event) => {
                    const value = event.target.value as Attendance;
                    setAttendance(value);
                    if (value === "Particular") {
                      setInsuranceName("");
                      updateFile("insuranceCard", null);
                    }
                  }}
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  <option value="Particular">Particular</option>
                  <option value="Convênio">Convênio</option>
                </select>
                {errors.attendance ? (
                  <span
                    id="attendance-error"
                    className="text-error mt-2 block text-sm"
                  >
                    {errors.attendance}
                  </span>
                ) : null}
              </label>
              {attendance === "Convênio" ? (
                <label className="text-ink text-sm font-semibold sm:col-span-2">
                  Nome do convênio{" "}
                  <span aria-hidden="true" className="text-error">
                    *
                  </span>
                  <input
                    name="insuranceName"
                    value={insuranceName}
                    onChange={(event) =>
                      setInsuranceName(event.target.value.slice(0, 100))
                    }
                    required
                    placeholder="Informe o convênio"
                    className={inputClasses}
                    {...errorProps("insuranceName")}
                  />
                  {errors.insuranceName ? (
                    <span
                      id="insuranceName-error"
                      className="text-error mt-2 block text-sm"
                    >
                      {errors.insuranceName}
                    </span>
                  ) : null}
                </label>
              ) : null}
              <label className="text-ink text-sm font-semibold sm:col-span-2">
                Exame ou procedimento solicitado{" "}
                <span aria-hidden="true" className="text-error">
                  *
                </span>
                <input
                  name="exam"
                  required
                  maxLength={160}
                  placeholder="Ex.: Ressonância magnética"
                  className={inputClasses}
                  {...errorProps("exam")}
                />
                {errors.exam ? (
                  <span
                    id="exam-error"
                    className="text-error mt-2 block text-sm"
                  >
                    {errors.exam}
                  </span>
                ) : null}
              </label>
              <label className="text-ink text-sm font-semibold">
                Melhor período{" "}
                <span aria-hidden="true" className="text-error">
                  *
                </span>
                <select
                  name="period"
                  defaultValue=""
                  required
                  className={inputClasses}
                  {...errorProps("period")}
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  <option value="Manhã">Manhã</option>
                  <option value="Tarde">Tarde</option>
                  <option value="Sem preferência">Sem preferência</option>
                </select>
                {errors.period ? (
                  <span
                    id="period-error"
                    className="text-error mt-2 block text-sm"
                  >
                    {errors.period}
                  </span>
                ) : null}
              </label>
              <label className="text-ink text-sm font-semibold">
                Canal de WhatsApp
                <select
                  value={channel}
                  onChange={(event) =>
                    setChannel(event.target.value as Channel)
                  }
                  className={inputClasses}
                >
                  <option value="primary">
                    {siteConfig.whatsapp.primary.label} —{" "}
                    {siteConfig.whatsapp.primary.display}
                  </option>
                  <option value="secondary">
                    {siteConfig.whatsapp.secondary.label} —{" "}
                    {siteConfig.whatsapp.secondary.display}
                  </option>
                </select>
              </label>
              <label className="text-ink text-sm font-semibold sm:col-span-2">
                Observações{" "}
                <span className="text-muted font-normal">(opcional)</span>
                <textarea
                  name="observations"
                  value={observations}
                  onChange={(event) =>
                    setObservations(event.target.value.slice(0, 500))
                  }
                  maxLength={500}
                  rows={4}
                  className={`${inputClasses} py-3`}
                />
                <span className="text-muted mt-1 block text-right text-xs">
                  {observations.length}/500
                </span>
              </label>
            </div>

            <fieldset className="border-border-light mt-8 border-t pt-7">
              <legend className="font-heading text-ink pr-3 text-xl font-semibold">
                Documentos para agilizar seu atendimento
              </legend>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                Envie arquivos legíveis. Eles ficarão privados e disponíveis por
                até 48 horas.
              </p>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <DocumentUploadField
                  kind="photoId"
                  label="Documento com foto"
                  description="RG, CNH ou outro documento oficial."
                  required
                  file={files.photoId}
                  error={errors.photoId}
                  {...uploads.photoId}
                  onChange={(file) => updateFile("photoId", file)}
                />
                <DocumentUploadField
                  kind="medicalOrder"
                  label="Pedido médico"
                  description="Fotografia legível ou arquivo PDF."
                  required
                  file={files.medicalOrder}
                  error={errors.medicalOrder}
                  {...uploads.medicalOrder}
                  onChange={(file) => updateFile("medicalOrder", file)}
                />
                {attendance === "Convênio" ? (
                  <div className="md:col-span-2">
                    <DocumentUploadField
                      kind="insuranceCard"
                      label="Carteirinha do convênio"
                      description="Envie a frente da carteirinha de forma legível."
                      required
                      file={files.insuranceCard}
                      error={errors.insuranceCard}
                      {...uploads.insuranceCard}
                      onChange={(file) => updateFile("insuranceCard", file)}
                    />
                  </div>
                ) : null}
              </div>
            </fieldset>

            <div className="border-border-light mt-7 border-t pt-6">
              <p className="text-muted flex items-start gap-2 text-sm leading-relaxed">
                <LockKeyhole
                  aria-hidden="true"
                  className="text-brand mt-0.5 shrink-0"
                  size={16}
                />
                Seus dados e documentos serão utilizados exclusivamente para
                organizar o pré-agendamento e agilizar seu atendimento. Os
                arquivos serão armazenados de forma segura e temporária, com
                acesso restrito à equipe da INNEURO.
              </p>
              <label className="text-ink mt-5 flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                <input
                  name="consent"
                  type="checkbox"
                  required
                  className="border-border-light text-brand focus:ring-tech mt-0.5 h-5 w-5 shrink-0 rounded"
                  {...errorProps("consent")}
                />
                <span>
                  Autorizo o uso dos meus dados e documentos para a organização
                  do pré-agendamento e do atendimento pela INNEURO.
                  {errors.consent ? (
                    <span id="consent-error" className="text-error mt-1 block">
                      {errors.consent}
                    </span>
                  ) : null}
                </span>
              </label>
              <button
                type="submit"
                disabled={!whatsappReady || isSubmitting}
                aria-disabled={!whatsappReady || isSubmitting}
                className="bg-brand hover:bg-brand-dark focus-visible:ring-tech disabled:bg-border-light disabled:text-muted mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed"
              >
                <MessageCircle aria-hidden="true" size={19} />
                {phase === "uploading"
                  ? "Enviando documentos…"
                  : phase === "opening"
                    ? "Abrindo WhatsApp…"
                    : "Enviar documentos e abrir WhatsApp"}
              </button>
              {!whatsappReady ? (
                <p
                  role="status"
                  className="text-warning mt-3 text-center text-sm"
                >
                  Canal de WhatsApp aguardando configuração oficial.
                </p>
              ) : null}
            </div>
          </form>
        </div>
      </Container>
    </section>
  );
}
