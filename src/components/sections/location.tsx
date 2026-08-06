import { AtSign, ExternalLink, MapPin, MessageCircle } from "lucide-react";
import { Container } from "@/components/layout/container";
import type { SiteConfig } from "@/config/site";
import type { ClinicalService } from "@/types/clinical-service";
import { createWhatsAppUrl } from "@/lib/whatsapp";

const message =
  "Olá! Acessei o site da INNEURO e gostaria de informações sobre exames.";
export function Location({
  config,
  services,
}: {
  config: SiteConfig;
  services: ClinicalService[];
}) {
  return (
    <section
      id="localizacao"
      className="bg-white py-16 sm:py-20 lg:py-24"
      aria-labelledby="location-title"
    >
      <Container>
        <div className="bg-brand-dark overflow-hidden rounded-[2rem] p-8 text-white sm:p-10 lg:p-12">
          <p className="text-mint text-xs font-bold tracking-[.14em] uppercase">
            Localização e contato
          </p>
          <h2
            id="location-title"
            className="font-heading mt-4 text-3xl font-semibold sm:text-4xl"
          >
            INNEURO em Macapá.
          </h2>
          <div className="mt-8 grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
            <div>
              <p className="flex gap-3 text-white/78">
                <MapPin aria-hidden="true" className="text-tech shrink-0" />
                {config.address.formatted}
                <br />
                {config.address.reference}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={config.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Como chegar pelo Google Maps — abre em nova aba"
                  className="bg-tech text-brand-dark inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-bold"
                >
                  Como chegar <ExternalLink aria-hidden="true" size={15} />
                </a>
                <a
                  href={config.instagram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/20 px-5 text-sm font-bold"
                >
                  <AtSign aria-hidden="true" size={16} />
                  {config.instagram.handle}
                </a>
              </div>
            </div>
            <div>
              <h3 className="font-heading text-xl font-semibold">
                Horários por modalidade
              </h3>
              <p className="mt-2 text-sm text-white/65">
                Horários confirmados para os serviços com orientação cadastrada.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {services.map((service) => (
                  <article
                    key={service.slug}
                    className="rounded-2xl border border-white/12 bg-white/5 p-4"
                  >
                    <h4 className="text-sm font-bold">{service.name}</h4>
                    <p className="mt-2 text-xs leading-relaxed text-white/68">
                      {service.schedules
                        .map(
                          (schedule) =>
                            `${schedule.days}: ${schedule.periods
                              .map(
                                (period) => `${period.start} às ${period.end}`,
                              )
                              .join(" e ")}`,
                        )
                        .join(" · ")}
                    </p>
                  </article>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {Object.values(config.whatsapp).map((channel) => (
                  <a
                    key={channel.number}
                    href={createWhatsAppUrl(channel.number, message)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${channel.label} — abre em nova aba`}
                    className="focus-visible:ring-tech inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-bold text-white/78 hover:text-white focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <MessageCircle aria-hidden="true" size={16} />
                    {channel.display}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
