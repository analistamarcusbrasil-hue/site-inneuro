import { AtSign, ExternalLink, MapPin, MessageCircle } from "lucide-react";
import { Container } from "@/components/layout/container";
import { siteConfig } from "@/config/site";
import { createWhatsAppUrl } from "@/lib/whatsapp";

const message =
  "Olá! Acessei o site da INNEURO e gostaria de informações sobre exames.";
export function Location() {
  return (
    <section
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
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="flex gap-3 text-white/78">
                <MapPin aria-hidden="true" className="text-tech shrink-0" />
                {siteConfig.address.formatted}
                <br />
                {siteConfig.address.reference}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={siteConfig.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Como chegar pelo Google Maps — abre em nova aba"
                  className="bg-tech text-brand-dark inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-bold"
                >
                  Como chegar <ExternalLink aria-hidden="true" size={15} />
                </a>
                <a
                  href={siteConfig.instagram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/20 px-5 text-sm font-bold"
                >
                  <AtSign aria-hidden="true" size={16} />
                  {siteConfig.instagram.handle}
                </a>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.values(siteConfig.whatsapp).map((channel) => (
                <a
                  key={channel.number}
                  href={createWhatsAppUrl(channel.number, message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${channel.label} — abre em nova aba`}
                  className="rounded-2xl border border-white/15 bg-white/5 p-5"
                >
                  <MessageCircle
                    aria-hidden="true"
                    className="text-tech"
                    size={20}
                  />
                  <span className="mt-3 block text-xs text-white/62">
                    {channel.label}
                  </span>
                  <strong className="mt-1 block">{channel.display}</strong>
                </a>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
