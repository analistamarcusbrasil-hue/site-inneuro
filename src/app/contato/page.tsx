import { AtSign, ExternalLink, MapPin, MessageCircle } from "lucide-react";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import { siteConfig } from "@/config/site";
import { clinicalServices } from "@/data/clinical-services";
import { createWhatsAppUrl } from "@/lib/whatsapp";
import { createPageMetadata } from "@/lib/metadata";

const message =
  "Olá! Acessei o site da INNEURO e gostaria de informações sobre exames.";
export const metadata = createPageMetadata({
  title: "Contato da INNEURO em Macapá | Amapá",
  description:
    "Consulte endereço, WhatsApp, Instagram, mapa e horários confirmados da INNEURO em Macapá.",
  path: "/contato",
});

export default function ContactPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Contato"
        title="Canais oficiais da INNEURO."
        description="Fale com nossa equipe ou consulte a localização e os horários específicos de cada modalidade."
      />
      <section className="bg-surface py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Object.values(siteConfig.whatsapp).map((channel) => (
              <a
                key={channel.number}
                href={createWhatsAppUrl(channel.number, message)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${channel.label} — abre em nova aba`}
                className="border-border-light rounded-3xl border bg-white p-7"
              >
                <MessageCircle aria-hidden="true" className="text-brand" />
                <p className="text-muted mt-6 text-xs font-bold tracking-[.12em] uppercase">
                  {channel.label}
                </p>
                <p className="font-heading text-ink mt-2 text-xl font-semibold">
                  {channel.display}
                </p>
                <ExternalLink
                  aria-hidden="true"
                  className="text-brand mt-4"
                  size={16}
                />
              </a>
            ))}
            <a
              href={siteConfig.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram @inneuroap — abre em nova aba"
              className="border-border-light rounded-3xl border bg-white p-7"
            >
              <AtSign aria-hidden="true" className="text-brand" />
              <p className="text-muted mt-6 text-xs font-bold tracking-[.12em] uppercase">
                Instagram
              </p>
              <p className="font-heading text-ink mt-2 text-xl font-semibold">
                {siteConfig.instagram.handle}
              </p>
              <ExternalLink
                aria-hidden="true"
                className="text-brand mt-4"
                size={16}
              />
            </a>
          </div>
          <div className="border-border-light mt-8 rounded-3xl border bg-white p-7">
            <MapPin aria-hidden="true" className="text-brand" />
            <h2 className="font-heading mt-5 text-2xl font-semibold">
              Endereço
            </h2>
            <p className="text-muted mt-3">
              {siteConfig.address.street}, {siteConfig.address.number}
              <br />
              {siteConfig.address.neighborhood}
              <br />
              {siteConfig.address.city} — {siteConfig.address.state}
            </p>
            <p className="text-ink mt-4 text-sm font-semibold">
              Referência: {siteConfig.address.reference}
            </p>
            <a
              href={siteConfig.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Como chegar pelo Google Maps — abre em nova aba"
              className="bg-brand mt-6 inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-bold text-white"
            >
              Como chegar <ExternalLink aria-hidden="true" size={15} />
            </a>
          </div>
          <section className="mt-10">
            <h2 className="font-heading text-ink text-3xl font-semibold">
              Horários por modalidade
            </h2>
            <p className="text-muted mt-3">
              Consulte os horários confirmados para cada modalidade.
            </p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {clinicalServices.map((service) => (
                <article
                  key={service.slug}
                  className="border-border-light rounded-3xl border bg-white p-6"
                >
                  <h3 className="font-heading text-xl font-semibold">
                    {service.name}
                  </h3>
                  <p className="text-brand mt-2 text-sm font-bold">
                    {service.attendanceLabel}
                  </p>
                  <ul className="text-muted mt-4 space-y-2 text-sm">
                    {service.schedules.map((schedule, index) => (
                      <li key={`${schedule.days}-${index}`}>
                        <strong>
                          {schedule.label} — {schedule.days}:
                        </strong>{" "}
                        {schedule.periods
                          .map((period) => `${period.start} às ${period.end}`)
                          .join(" · ")}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </Container>
      </section>
    </main>
  );
}
