"use client";

import {
  CheckCircle2,
  Heart,
  HelpCircle,
  Lightbulb,
  LoaderCircle,
  MessageSquareText,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Container } from "@/components/layout/container";
import {
  contactCategories,
  formatBrazilianPhone,
  type ContactCategory,
} from "@/lib/contact/shared";

type FormValues = {
  name: string;
  email: string;
  phone: string;
  category: ContactCategory | "";
  subject: string;
  message: string;
  consent: boolean;
  website: string;
};

type FieldErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = {
  name: "",
  email: "",
  phone: "",
  category: "",
  subject: "",
  message: "",
  consent: false,
  website: "",
};

const shortcuts = [
  {
    category: "QUESTION" as const,
    title: "Tire uma dúvida",
    description: "Para informações gerais sobre a INNEURO.",
    icon: HelpCircle,
  },
  {
    category: "SUGGESTION" as const,
    title: "Envie uma sugestão",
    description: "Ajude-nos a melhorar nossos serviços e atendimento.",
    icon: Lightbulb,
  },
  {
    category: "PRAISE" as const,
    title: "Faça um elogio",
    description: "Compartilhe uma experiência positiva com nossa equipe.",
    icon: Heart,
  },
  {
    category: "SERVICE" as const,
    title: "Fale sobre seu atendimento",
    description: "Envie uma observação, relato ou reclamação.",
    icon: MessageSquareText,
  },
] as const;

function validate(values: FormValues) {
  const errors: FieldErrors = {};
  if (values.name.trim().length < 3) errors.name = "Informe seu nome completo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Informe um e-mail válido.";
  }
  if (values.phone && !/^\(\d{2}\) \d{4,5}-\d{4}$/.test(values.phone)) {
    errors.phone = "Informe um telefone brasileiro válido.";
  }
  if (!values.category) errors.category = "Selecione uma categoria.";
  if (values.subject.trim().length < 3) {
    errors.subject = "Informe o assunto da mensagem.";
  }
  if (values.subject.trim().length > 160) {
    errors.subject = "O assunto pode ter no máximo 160 caracteres.";
  }
  if (values.message.trim().length < 10) {
    errors.message = "Escreva uma mensagem com pelo menos 10 caracteres.";
  }
  if (values.message.trim().length > 3000) {
    errors.message = "A mensagem pode ter no máximo 3000 caracteres.";
  }
  if (!values.consent) {
    errors.consent = "Confirme a leitura da Política de Privacidade.";
  }
  return errors;
}

function firstServerErrors(value: unknown): FieldErrors {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, messages]) => Array.isArray(messages) && messages.length > 0)
      .map(([field, messages]) => [field, String(messages[0])]),
  ) as FieldErrors;
}

export function ContactForm() {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [protocol, setProtocol] = useState("");
  const startedAtRef = useRef(0);
  const submissionIdRef = useRef("");
  const categoryRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
    submissionIdRef.current = crypto.randomUUID();
  }, []);

  function updateField<Key extends keyof FormValues>(
    field: Key,
    value: FormValues[Key],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (status === "error") setStatus("idle");
  }

  function selectShortcut(category: ContactCategory) {
    updateField("category", category);
    requestAnimationFrame(() => categoryRef.current?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const fieldOrder: Array<keyof FormValues> = [
        "name",
        "email",
        "phone",
        "category",
        "subject",
        "message",
        "consent",
      ];
      const firstField = fieldOrder.find((field) => nextErrors[field]);
      if (firstField) {
        requestAnimationFrame(() =>
          document.getElementById(`contact-${firstField}`)?.focus(),
        );
      }
      setStatus("error");
      setStatusMessage("Revise os campos destacados e tente novamente.");
      return;
    }

    if (!submissionIdRef.current) submissionIdRef.current = crypto.randomUUID();
    setStatus("submitting");
    setStatusMessage("Enviando sua mensagem...");

    try {
      const response = await fetch("/api/fale-conosco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          submissionId: submissionIdRef.current,
          startedAt: startedAtRef.current,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        fieldErrors?: unknown;
        protocol?: string;
      };
      if (!response.ok || !result.protocol) {
        setErrors(firstServerErrors(result.fieldErrors));
        setStatus("error");
        setStatusMessage(
          result.error ||
            "Não foi possível enviar sua mensagem neste momento. Revise os dados e tente novamente.",
        );
        return;
      }
      setProtocol(result.protocol);
      setStatus("success");
      setStatusMessage("Mensagem recebida e registrada.");
    } catch {
      setStatus("error");
      setStatusMessage(
        "Não foi possível enviar sua mensagem neste momento. Revise os dados e tente novamente.",
      );
    }
  }

  if (status === "success") {
    return (
      <section className="bg-surface py-12 sm:py-16">
        <Container>
          <div
            className="border-border-light mx-auto max-w-2xl rounded-[2rem] border bg-white p-8 text-center shadow-[0_18px_55px_rgba(3,37,27,0.06)] sm:p-10"
            aria-live="polite"
          >
            <span className="bg-mint text-brand mx-auto grid h-14 w-14 place-items-center rounded-2xl">
              <CheckCircle2 aria-hidden="true" size={28} />
            </span>
            <h2 className="font-heading text-ink mt-5 text-3xl font-semibold">
              Mensagem recebida!
            </h2>
            <p className="text-muted mt-3 leading-relaxed">
              Obrigado por falar com a INNEURO. Sua mensagem foi registrada para
              análise da equipe responsável.
            </p>
            <p className="text-muted mt-7 text-xs font-bold tracking-[0.14em] uppercase">
              Protocolo
            </p>
            <code className="bg-mint text-brand-dark mt-2 inline-flex rounded-xl px-4 py-2 text-base font-bold">
              {protocol}
            </code>
            <p className="text-muted mt-4 text-sm">
              Guarde este número caso precise fazer referência a este contato
              posteriormente.
            </p>
            <Link
              href="/"
              className="bg-brand mt-7 inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-bold text-white"
            >
              Voltar para o início
            </Link>
          </div>
        </Container>
      </section>
    );
  }

  const fieldClass =
    "border-border-light text-ink focus:border-brand focus:ring-brand/15 min-h-12 w-full rounded-2xl border bg-white px-4 text-base outline-none transition focus:ring-4";

  return (
    <section className="bg-surface pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-24">
      <Container>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map((shortcut) => {
            const Icon = shortcut.icon;
            const active = values.category === shortcut.category;
            return (
              <button
                key={shortcut.category}
                type="button"
                aria-pressed={active}
                onClick={() => selectShortcut(shortcut.category)}
                className={`rounded-3xl border p-5 text-left transition-[border-color,background-color,transform] hover:-translate-y-0.5 ${
                  active
                    ? "border-brand bg-mint"
                    : "border-border-light hover:border-brand/35 bg-white"
                }`}
              >
                <span className="bg-mint text-brand grid h-10 w-10 place-items-center rounded-xl">
                  <Icon aria-hidden="true" size={20} />
                </span>
                <span className="font-heading text-ink mt-4 block text-lg font-semibold">
                  {shortcut.title}
                </span>
                <span className="text-muted mt-2 block text-sm leading-relaxed">
                  {shortcut.description}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.68fr_1.32fr] lg:items-start">
          <aside className="bg-brand-dark rounded-3xl p-6 text-white sm:p-8">
            <p className="text-mint text-xs font-bold tracking-[0.16em] uppercase">
              Contato institucional
            </p>
            <h2 className="font-heading mt-3 text-2xl font-semibold">
              Escreva para a INNEURO
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Preencha somente as informações necessárias para que nossa equipe
              possa analisar sua mensagem.
            </p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-white/68">
              Não envie CPF, documentos, exames, diagnósticos ou outros dados
              médicos por este formulário.
            </div>
          </aside>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="border-border-light rounded-[2rem] border bg-white p-6 shadow-[0_18px_55px_rgba(3,37,27,0.05)] sm:p-8"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="contact-name"
                  className="text-ink text-sm font-bold"
                >
                  Nome completo <span aria-hidden="true">*</span>
                </label>
                <input
                  id="contact-name"
                  name="name"
                  autoComplete="name"
                  maxLength={120}
                  value={values.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={
                    errors.name ? "contact-name-error" : undefined
                  }
                  className={`${fieldClass} mt-2`}
                />
                {errors.name ? (
                  <p
                    id="contact-name-error"
                    className="text-error mt-2 text-sm"
                  >
                    {errors.name}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="contact-email"
                  className="text-ink text-sm font-bold"
                >
                  E-mail <span aria-hidden="true">*</span>
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={254}
                  value={values.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={
                    errors.email ? "contact-email-error" : undefined
                  }
                  className={`${fieldClass} mt-2`}
                />
                {errors.email ? (
                  <p
                    id="contact-email-error"
                    className="text-error mt-2 text-sm"
                  >
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="contact-phone"
                  className="text-ink text-sm font-bold"
                >
                  WhatsApp ou telefone{" "}
                  <span className="text-muted font-normal">(opcional)</span>
                </label>
                <input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={15}
                  value={values.phone}
                  onChange={(event) =>
                    updateField(
                      "phone",
                      formatBrazilianPhone(event.target.value),
                    )
                  }
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={
                    errors.phone ? "contact-phone-error" : undefined
                  }
                  placeholder="(96) 99999-9999"
                  className={`${fieldClass} mt-2`}
                />
                {errors.phone ? (
                  <p
                    id="contact-phone-error"
                    className="text-error mt-2 text-sm"
                  >
                    {errors.phone}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="contact-category"
                  className="text-ink text-sm font-bold"
                >
                  Categoria <span aria-hidden="true">*</span>
                </label>
                <select
                  ref={categoryRef}
                  id="contact-category"
                  name="category"
                  value={values.category}
                  onChange={(event) =>
                    updateField(
                      "category",
                      event.target.value as ContactCategory,
                    )
                  }
                  aria-invalid={Boolean(errors.category)}
                  aria-describedby={
                    errors.category ? "contact-category-error" : undefined
                  }
                  className={`${fieldClass} mt-2`}
                >
                  <option value="">Selecione</option>
                  {contactCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
                {errors.category ? (
                  <p
                    id="contact-category-error"
                    className="text-error mt-2 text-sm"
                  >
                    {errors.category}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="contact-subject"
                  className="text-ink text-sm font-bold"
                >
                  Assunto <span aria-hidden="true">*</span>
                </label>
                <input
                  id="contact-subject"
                  name="subject"
                  maxLength={160}
                  value={values.subject}
                  onChange={(event) =>
                    updateField("subject", event.target.value)
                  }
                  aria-invalid={Boolean(errors.subject)}
                  aria-describedby={
                    errors.subject ? "contact-subject-error" : undefined
                  }
                  className={`${fieldClass} mt-2`}
                />
                {errors.subject ? (
                  <p
                    id="contact-subject-error"
                    className="text-error mt-2 text-sm"
                  >
                    {errors.subject}
                  </p>
                ) : null}
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-end justify-between gap-4">
                  <label
                    htmlFor="contact-message"
                    className="text-ink text-sm font-bold"
                  >
                    Mensagem <span aria-hidden="true">*</span>
                  </label>
                  <span className="text-muted text-xs">
                    {values.message.length}/3000
                  </span>
                </div>
                <textarea
                  id="contact-message"
                  name="message"
                  rows={7}
                  maxLength={3000}
                  value={values.message}
                  onChange={(event) =>
                    updateField("message", event.target.value)
                  }
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={
                    errors.message ? "contact-message-error" : undefined
                  }
                  className={`${fieldClass} mt-2 min-h-40 resize-y py-3`}
                />
                {errors.message ? (
                  <p
                    id="contact-message-error"
                    className="text-error mt-2 text-sm"
                  >
                    {errors.message}
                  </p>
                ) : null}
              </div>

              <div className="fixed -left-[9999px]" aria-hidden="true">
                <label htmlFor="contact-website">Website</label>
                <input
                  id="contact-website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={values.website}
                  onChange={(event) =>
                    updateField("website", event.target.value)
                  }
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-start gap-3">
                  <input
                    id="contact-consent"
                    name="consent"
                    type="checkbox"
                    checked={values.consent}
                    onChange={(event) =>
                      updateField("consent", event.target.checked)
                    }
                    aria-invalid={Boolean(errors.consent)}
                    aria-describedby={
                      errors.consent ? "contact-consent-error" : undefined
                    }
                    className="border-border-light text-brand focus:ring-brand mt-1 h-5 w-5 shrink-0 rounded"
                  />
                  <label
                    htmlFor="contact-consent"
                    className="text-muted text-sm leading-relaxed"
                  >
                    Li e concordo com o tratamento dos meus dados para que a
                    INNEURO possa analisar e responder esta mensagem, conforme a{" "}
                    <Link
                      href="/politica-de-privacidade"
                      className="text-brand font-semibold underline underline-offset-2"
                    >
                      Política de Privacidade
                    </Link>
                    .
                  </label>
                </div>
                {errors.consent ? (
                  <p
                    id="contact-consent-error"
                    className="text-error mt-2 text-sm"
                  >
                    {errors.consent}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={status === "submitting"}
                className="bg-brand hover:bg-brand-dark focus-visible:ring-tech inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70 sm:w-auto"
              >
                {status === "submitting" ? (
                  <>
                    <LoaderCircle
                      aria-hidden="true"
                      size={18}
                      className="animate-spin"
                    />
                    Enviando sua mensagem...
                  </>
                ) : (
                  <>
                    <Send aria-hidden="true" size={17} /> Enviar mensagem
                  </>
                )}
              </button>
              <p
                className={`mt-3 text-sm ${status === "error" ? "text-error" : "text-muted"}`}
                aria-live="polite"
                role={status === "error" ? "alert" : "status"}
              >
                {statusMessage}
              </p>
            </div>
          </form>
        </div>
      </Container>
    </section>
  );
}
