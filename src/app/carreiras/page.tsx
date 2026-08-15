import {
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  FileCheck2,
  IdCard,
  LogIn,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import { Badge } from "@/components/ui/badge";
import { isCareersPortalEnabled } from "@/lib/careers/feature-flag";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Carreiras | INNEURO",
  description:
    "Conheça o ambiente de carreiras da INNEURO, consulte oportunidades e mantenha seu perfil profissional atualizado.",
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
  const portalEnabled = isCareersPortalEnabled();

  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="CARREIRAS INNEURO"
        title="Faça parte do nosso time."
        description={
          portalEnabled
            ? "Conheça nossas oportunidades, crie seu perfil profissional e participe dos processos seletivos da INNEURO com segurança e transparência."
            : "Estamos preparando um novo ambiente de recrutamento para conectar a INNEURO a profissionais que desejam crescer e construir conosco uma saúde cada vez mais humana, tecnológica e eficiente."
        }
      />

      <section className="bg-surface py-10 sm:py-12 lg:py-16">
        <Container>
          <article className="border-border-light overflow-hidden rounded-[2rem] border bg-white shadow-[0_18px_50px_rgba(3,37,27,0.07)]">
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-10">
              <div className="max-w-3xl">
                <Badge>
                  {portalEnabled ? "Portal disponível" : "Em desenvolvimento"}
                </Badge>
                <h2 className="font-heading text-ink mt-4 text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-semibold tracking-[-0.035em]">
                  {portalEnabled
                    ? "Encontre seu próximo desafio na INNEURO."
                    : "Nosso novo portal de carreiras está chegando."}
                </h2>
                <p className="text-muted mt-4 leading-relaxed">
                  {portalEnabled
                    ? "Consulte as vagas publicadas, mantenha suas informações profissionais atualizadas e acompanhe suas candidaturas em um único lugar."
                    : "Em breve, você poderá criar seu perfil profissional, participar de processos seletivos e fazer parte do Banco de Talentos da INNEURO diretamente pelo nosso site."}
                </p>
                <p className="text-ink mt-4 text-sm leading-relaxed font-semibold sm:text-base">
                  {portalEnabled
                    ? "O cadastro é gratuito e suas informações são tratadas de acordo com a nossa Política de Privacidade."
                    : "Estamos trabalhando para oferecer uma experiência simples, segura e transparente para nossos candidatos."}
                </p>
              </div>

              {portalEnabled ? (
                <div className="bg-brand-dark min-w-0 rounded-3xl p-5 text-white sm:min-w-72 sm:p-6">
                  <p className="text-sm font-semibold text-white/68">
                    Portal de candidatos
                  </p>
                  <div className="mt-4 grid gap-3">
                    <Link
                      href="/carreiras/vagas"
                      className="bg-tech text-brand-dark focus-visible:ring-tech inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 focus-visible:outline-none"
                    >
                      Ver vagas
                      <ArrowRight aria-hidden="true" size={17} />
                    </Link>
                    <Link
                      href="/carreiras/entrar"
                      className="focus-visible:ring-tech inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 focus-visible:outline-none"
                    >
                      <LogIn aria-hidden="true" size={17} />
                      Entrar na minha conta
                    </Link>
                  </div>
                  <Link
                    href="/carreiras/cadastro"
                    className="focus-visible:ring-tech mt-4 block rounded text-center text-sm font-semibold text-white/80 underline decoration-white/30 underline-offset-4 transition hover:text-white focus-visible:ring-2 focus-visible:outline-none"
                  >
                    Criar perfil profissional
                  </Link>
                </div>
              ) : (
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
              )}
            </div>
          </article>

          <section
            className="mt-12 sm:mt-16"
            aria-labelledby="preparacao-title"
          >
            <div className="max-w-2xl">
              <p className="text-brand text-xs font-bold tracking-[0.12em] uppercase">
                {portalEnabled ? "Sua jornada" : "Próximos passos"}
              </p>
              <h2
                id="preparacao-title"
                className="font-heading text-ink mt-3 text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-semibold tracking-[-0.035em]"
              >
                {portalEnabled
                  ? "Recursos disponíveis para candidatos"
                  : "O que está sendo preparado"}
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
            {portalEnabled ? (
              <span>
                Pronto para começar?{" "}
                <Link
                  href="/carreiras/cadastro"
                  className="focus-visible:ring-brand rounded underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                >
                  Crie seu perfil profissional
                </Link>{" "}
                ou consulte as{" "}
                <Link
                  href="/carreiras/vagas"
                  className="focus-visible:ring-brand rounded underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                >
                  vagas disponíveis
                </Link>
                .
              </span>
            ) : (
              "As inscrições pelo portal ainda não estão disponíveis."
            )}
          </aside>
        </Container>
      </section>
    </main>
  );
}
