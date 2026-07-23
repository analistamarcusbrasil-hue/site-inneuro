"use client";

import { CalendarCheck, LockKeyhole, MessageCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import {
  createWhatsAppUrl,
  normalizeWhatsAppNumber,
  sanitizePlainText,
} from "@/lib/whatsapp";

type FieldName = "name" | "phone" | "attendance" | "period";
type Errors = Partial<Record<FieldName, string>>;

const inputClasses =
  "mt-2 min-h-12 w-full rounded-2xl border border-border-light bg-white px-4 text-base text-ink outline-none transition-colors placeholder:text-muted/65 focus:border-brand focus:ring-2 focus:ring-tech/25 aria-invalid:border-error aria-invalid:ring-2 aria-invalid:ring-error/15";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function Scheduling() {
  const [errors, setErrors] = useState<Errors>({});
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"primary" | "secondary">("primary");
  const whatsappReady = Boolean(
    normalizeWhatsAppNumber(siteConfig.whatsapp[channel].number),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!whatsappReady) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      name: sanitizePlainText(String(data.get("name") ?? "")),
      phone: sanitizePlainText(String(data.get("phone") ?? "")),
      attendance: sanitizePlainText(String(data.get("attendance") ?? "")),
      period: sanitizePlainText(String(data.get("period") ?? "")),
    };

    const nextErrors: Errors = {};
    if (!values.name) nextErrors.name = "Informe seu nome.";
    if (values.phone.replace(/\D/g, "").length < 10)
      nextErrors.phone = "Informe um telefone válido com DDD.";
    if (!values.attendance)
      nextErrors.attendance = "Selecione o tipo de atendimento.";
    if (!values.period) nextErrors.period = "Selecione o melhor período.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      window.requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }

    const message = [
      "Olá! Acessei o site da INNEURO e gostaria de solicitar um agendamento.",
      "",
      `Nome: ${values.name}`,
      `Telefone: ${values.phone}`,
      `Atendimento: ${values.attendance}`,
      `Preferência de horário: ${values.period}`,
    ].join("\n");

    const url = createWhatsAppUrl(siteConfig.whatsapp[channel].number, message);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  const errorProps = (field: FieldName) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
  });

  return (
    <section
      id="agendamento"
      aria-labelledby="scheduling-title"
      className="bg-white py-16 sm:py-20 lg:py-28"
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
              Preencha os dados para montar uma mensagem e, somente ao
              confirmar, abrir o WhatsApp da INNEURO.
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
            {Object.keys(errors).length > 0 ? (
              <p
                role="alert"
                className="bg-error/10 text-error mb-5 rounded-2xl p-4 text-sm font-semibold"
              >
                Revise os campos indicados antes de continuar.
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
                {errors.name && (
                  <span
                    id="name-error"
                    className="text-error mt-2 block text-sm"
                  >
                    {errors.name}
                  </span>
                )}
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
                {errors.phone && (
                  <span
                    id="phone-error"
                    className="text-error mt-2 block text-sm"
                  >
                    {errors.phone}
                  </span>
                )}
              </label>
              <label className="text-ink text-sm font-semibold">
                Convênio ou particular{" "}
                <span aria-hidden="true" className="text-error">
                  *
                </span>
                <select
                  name="attendance"
                  defaultValue=""
                  required
                  className={inputClasses}
                  {...errorProps("attendance")}
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  <option value="Particular">Particular</option>
                  <option value="Convênio">Convênio</option>
                </select>
                {errors.attendance && (
                  <span
                    id="attendance-error"
                    className="text-error mt-2 block text-sm"
                  >
                    {errors.attendance}
                  </span>
                )}
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
                {errors.period && (
                  <span
                    id="period-error"
                    className="text-error mt-2 block text-sm"
                  >
                    {errors.period}
                  </span>
                )}
              </label>
              <label className="text-ink text-sm font-semibold sm:col-span-2">
                Canal de WhatsApp
                <select
                  value={channel}
                  onChange={(event) =>
                    setChannel(event.target.value as "primary" | "secondary")
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
            </div>

            <div className="border-border-light mt-7 border-t pt-6">
              <p className="text-muted flex items-start gap-2 text-sm leading-relaxed">
                <LockKeyhole
                  aria-hidden="true"
                  className="text-brand mt-0.5 shrink-0"
                  size={16}
                />
                Os dados são usados apenas para montar a mensagem no seu
                dispositivo. Nada é armazenado pelo site e nenhum dado clínico é
                solicitado.
              </p>
              <button
                type="submit"
                disabled={!whatsappReady}
                aria-disabled={!whatsappReady}
                className="bg-brand hover:bg-brand-dark focus-visible:ring-tech disabled:bg-border-light disabled:text-muted mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed"
              >
                <MessageCircle aria-hidden="true" size={19} /> Abrir WhatsApp
                para confirmar
              </button>
              {!whatsappReady && (
                <p
                  role="status"
                  className="text-warning mt-3 text-center text-sm"
                >
                  Canal de WhatsApp aguardando configuração oficial.
                </p>
              )}
            </div>
          </form>
        </div>
      </Container>
    </section>
  );
}
