import { ArrowUpRight, AtSign } from "lucide-react";
import { Container } from "@/components/layout/container";
import { siteConfig } from "@/config/site";

export function NewsAndSocial() {
  return (
    <section
      aria-labelledby="news-social-title"
      className="bg-mint/35 py-16 sm:py-20 lg:py-24"
    >
      <Container>
        <div className="bg-brand-dark relative grid overflow-hidden rounded-[2rem] p-8 text-white sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12 lg:p-12">
          <div
            aria-hidden="true"
            className="border-tech/15 absolute top-1/2 right-[-10%] aspect-square w-72 -translate-y-1/2 rounded-full border sm:w-96"
          >
            <span className="border-mint/10 absolute inset-[18%] rounded-full border" />
            <span className="border-tech/20 absolute inset-[38%] rounded-full border" />
          </div>
          <div className="relative max-w-2xl">
            <p className="text-mint text-xs font-bold tracking-[0.14em] uppercase">
              Notícias e redes sociais
            </p>
            <h2
              id="news-social-title"
              className="font-heading mt-4 text-3xl leading-tight font-semibold sm:text-4xl"
            >
              Acompanhe a INNEURO
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/72 sm:text-lg">
              Acompanhe novidades e informações nos canais oficiais da INNEURO.
            </p>
          </div>

          <a
            href={siteConfig.instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Acompanhar ${siteConfig.instagram.handle} no Instagram — abre em nova aba`}
            className="bg-tech text-brand-dark focus-visible:ring-tech focus-visible:ring-offset-brand-dark relative mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none lg:mt-0"
          >
            <AtSign aria-hidden="true" size={18} />
            {siteConfig.instagram.handle}
            <ArrowUpRight aria-hidden="true" size={17} />
          </a>
        </div>
      </Container>
    </section>
  );
}
