import {
  BriefcaseBusiness,
  Clock3,
  FileCheck2,
  IdCard,
  UsersRound,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import { Badge } from "@/components/ui/badge";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Carreiras | INNEURO",
  description:
    "Conheça o novo ambiente de carreiras da INNEURO. Em breve, vagas, processos seletivos e Banco de Talentos estarão disponíveis pelo nosso site.",
  path: "/carreiras",
});

const upcomingFeatures = [
  {
    title: "Perfil profissional",
    description:
      "O candidato poderá manter seus dados profissionais atualizados.",
    icon: IdCard,
  },
  {
    title: "Banco de Talentos",
    description:
      "Profissionais poderão deixar seus perfis disponíveis para futuras oportunidades.",
    icon: UsersRound,
  },
  {
    title: "Vagas e processos seletivos",
    description:
      "Será possível acompanhar oportunidades abertas e participar de seleções.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Candidatura digital",
    description:
      "Todo o processo inicial poderá ser realizado diretamente pelo site da INNEURO.",
    icon: FileCheck2,
  },
] as const;

export default function CareersPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="CARREIRAS INNEURO"
        title="Faça parte do nosso time."
        description="Estamos preparando um novo ambiente de recrutamento para conectar a INNEURO a profissionais que desejam crescer e construir conosco uma saúde cada vez mais humana, tecnológica e eficiente."
      />

      <section className="bg-surface py-10 sm:py-12 lg:py-16">
        <Container>
          <article className="border-border-light overflow-hidden rounded-[2rem] border bg-white shadow-[0_18px_50px_rgba(3,37,27,0.07)]">
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-10">
              <div className="max-w-3xl">
                <Badge>Em desenvolvimento</Badge>
                <h2 className="font-heading text-ink mt-4 text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-semibold tracking-[-0.035em]">
                  Nosso novo portal de carreiras está chegando.
                </h2>
                <p className="text-muted mt-4 leading-relaxed">
                  Em breve, você poderá criar seu perfil profissional,
                  participar de processos seletivos e fazer parte do Banco de
                  Talentos da INNEURO diretamente pelo nosso site.
                </p>
                <p className="text-ink mt-4 text-sm leading-relaxed font-semibold sm:text-base">
                  Estamos trabalhando para oferecer uma experiência simples,
                  segura e transparente para nossos candidatos.
                </p>
              </div>

              <div
                className="bg-brand-dark flex min-w-0 items-center gap-4 rounded-3xl p-5 text-white sm:min-w-64 sm:p-6"
                aria-label="Portal de candidatos — em breve"
              >
                <span className="bg-tech/15 text-tech grid size-11 shrink-0 place-items-center rounded-2xl">
                  <Clock3 aria-hidden="true" size={22} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white/68">
                    Portal de candidatos
                  </span>
                  <span className="mt-1 block font-bold">Em breve</span>
                </span>
              </div>
            </div>
          </article>

          <section
            className="mt-12 sm:mt-16"
            aria-labelledby="preparacao-title"
          >
            <div className="max-w-2xl">
              <p className="text-brand text-xs font-bold tracking-[0.12em] uppercase">
                Próximos passos
              </p>
              <h2
                id="preparacao-title"
                className="font-heading text-ink mt-3 text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-semibold tracking-[-0.035em]"
              >
                O que está sendo preparado
              </h2>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {upcomingFeatures.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="border-border-light rounded-3xl border bg-white p-6"
                  >
                    <span className="bg-mint text-brand grid size-11 place-items-center rounded-2xl">
                      <Icon aria-hidden="true" size={21} />
                    </span>
                    <h3 className="font-heading text-ink mt-5 text-xl leading-tight font-semibold">
                      {item.title}
                    </h3>
                    <p className="text-muted mt-3 text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          <aside
            className="border-brand/15 bg-mint/65 text-brand-dark mt-10 rounded-3xl border p-5 text-sm font-semibold sm:p-6 sm:text-base"
            aria-label="Disponibilidade das inscrições"
          >
            As inscrições pelo portal ainda não estão disponíveis.
          </aside>
        </Container>
      </section>
    </main>
  );
}
