import { ExternalLink, MessageCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { createWhatsAppUrl } from "@/lib/whatsapp";
import type { ClinicalService } from "@/types/clinical-service";

export function ServiceDetails({ service }: { service: ClinicalService }) {
  const whatsappUrl = createWhatsAppUrl(
    siteConfig.whatsapp.primary.number,
    "Olá! Acessei o site da INNEURO e gostaria de informações sobre exames.",
  );
  return (
    <div className="space-y-6">
      <section className="border-border-light rounded-3xl border bg-white p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="bg-mint text-brand-dark rounded-full px-4 py-2 text-sm font-bold">
            {service.attendanceLabel}
          </span>
          <span className="text-muted text-sm">
            Orientações validadas pela INNEURO · revisão em 21/07/2026
          </span>
        </div>
        <h2 className="font-heading text-ink mt-7 text-2xl font-semibold">
          Horários desta modalidade
        </h2>
        <p className="text-muted mt-2 text-sm">
          Estes horários são específicos para {service.name} e não representam o
          horário geral da clínica.
        </p>
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {service.schedules.map((schedule, index) => (
            <li
              key={`${schedule.label}-${schedule.days}-${index}`}
              className="bg-surface rounded-2xl p-5"
            >
              <strong className="text-brand block text-sm">
                {schedule.label}
              </strong>
              <span className="text-ink mt-2 block font-semibold">
                {schedule.days}
              </span>
              <span className="text-muted mt-1 block text-sm">
                {schedule.periods
                  .map((period) => `${period.start} às ${period.end}`)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      </section>
      {service.preparationGroups.map((group) => (
        <section
          key={group.title}
          className="border-border-light rounded-3xl border bg-white p-7"
        >
          <h2 className="font-heading text-ink text-2xl font-semibold">
            {group.title}
          </h2>
          <p className="text-brand mt-3 text-sm font-bold">
            Aplica-se a: {group.appliesTo.join(", ")}
          </p>
          <ul className="text-muted mt-5 list-disc space-y-2 pl-5">
            {group.instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ul>
          {group.warning && (
            <p className="border-warning/25 text-ink mt-6 rounded-2xl border p-4 text-sm">
              {group.warning}
            </p>
          )}
        </section>
      ))}
      {service.documents?.length ? (
        <section className="border-border-light rounded-3xl border bg-white p-7">
          <h2 className="font-heading text-ink text-2xl font-semibold">
            Documentos para agendamentos feitos por telefone
          </h2>
          <ul className="text-muted mt-5 list-disc space-y-2 pl-5">
            {service.documents.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {service.safetyQuestions?.length ? (
        <section className="border-brand/20 bg-mint/45 rounded-3xl border p-7">
          <ShieldAlert aria-hidden="true" className="text-brand" />
          <h2 className="font-heading text-ink mt-4 text-2xl font-semibold">
            Informações que devem ser comunicadas previamente
          </h2>
          <p className="text-muted mt-3">Informe à equipe caso você:</p>
          <ul className="text-muted mt-4 list-disc space-y-2 pl-5">
            {service.safetyQuestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-ink mt-5 text-sm font-semibold">
            A lista orienta a conversa com a equipe e não representa
            contraindicação absoluta.
          </p>
        </section>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Falar com a equipe antes do exame pelo WhatsApp — abre em nova aba"
          className="bg-brand inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-bold text-white"
        >
          <MessageCircle aria-hidden="true" size={18} /> Falar com a equipe
          antes do exame <ExternalLink aria-hidden="true" size={15} />
        </a>
        <Link
          href="/preparos"
          className="border-brand/25 text-brand-dark inline-flex min-h-12 items-center rounded-full border px-6 text-sm font-bold"
        >
          Voltar aos preparos
        </Link>
      </div>
    </div>
  );
}
