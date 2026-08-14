import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import {
  ArrowRight,
  Award,
  BrainCircuit,
  CalendarPlus,
  ScanSearch,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import { Button } from "@/components/ui/button";
import { medicalTeam } from "@/data/medical-team";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Equipe Médica | INNEURO",
  description:
    "Conheça o corpo médico da INNEURO, formado por especialistas que atuam na análise de exames de diagnóstico por imagem e elaboração de laudos médicos.",
  path: "/equipe-medica",
});

const teamHighlights = [
  {
    title: "Experiência Médica",
    description:
      "Profissionais especialistas dedicados à interpretação criteriosa dos exames.",
    icon: Award,
  },
  {
    title: "Precisão Diagnóstica",
    description:
      "Análise técnica das imagens e elaboração de laudos com atenção aos detalhes.",
    icon: ScanSearch,
  },
  {
    title: "Tecnologia + Conhecimento",
    description:
      "Estrutura tecnológica aliada à experiência de um corpo médico qualificado.",
    icon: BrainCircuit,
  },
] as const;

function hasTeamPortrait(imagePath: string) {
  const relativePath = imagePath.replace(/^\//, "");
  return existsSync(join(process.cwd(), "public", relativePath));
}

export default function MedicalTeamPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Corpo Médico INNEURO"
        title="Especialistas por trás de cada diagnóstico."
        description="Nossa equipe médica atua na análise dos exames, interpretação das imagens e elaboração dos laudos com precisão, experiência e responsabilidade."
      />

      <section className="bg-surface pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-24">
        <Container>
          <section className="border-border-light grid gap-4 rounded-3xl border bg-white p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-10">
            <div>
              <p className="text-brand text-xs font-bold tracking-[0.18em] uppercase">
                Conhecimento e responsabilidade
              </p>
              <h2 className="font-heading text-ink mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
                Excelência que começa pelas pessoas
              </h2>
            </div>
            <p className="text-muted leading-relaxed">
              Nossa equipe médica combina experiência, conhecimento técnico e
              tecnologia para apoiar diagnósticos precisos e seguros.
            </p>
          </section>

          <section className="pt-10 sm:pt-12" aria-labelledby="team-title">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-brand text-xs font-bold tracking-[0.18em] uppercase">
                  Profissionais da INNEURO
                </p>
                <h2
                  id="team-title"
                  className="font-heading text-ink mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl"
                >
                  Corpo Médico INNEURO
                </h2>
              </div>
              <p className="text-brand shrink-0 text-sm font-bold">
                {medicalTeam.length} médicos especialistas
              </p>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {medicalTeam.map((member) => {
                const portraitAvailable = hasTeamPortrait(member.image);
                return (
                  <article
                    key={member.id}
                    className="border-border-light group overflow-hidden rounded-3xl border bg-white shadow-[0_12px_35px_rgba(3,37,27,0.035)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(3,37,27,0.07)]"
                  >
                    <div className="bg-brand-dark relative h-48 overflow-hidden sm:h-52 lg:h-56">
                      {portraitAvailable ? (
                        <Image
                          src={member.image}
                          alt={member.imageAlt}
                          fill
                          sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                        />
                      ) : (
                        <div
                          className="relative grid h-full place-items-center overflow-hidden"
                          role="img"
                          aria-label={`Foto de ${member.name} ainda não disponível`}
                        >
                          <div
                            className="hero-grid absolute inset-0 opacity-20"
                            aria-hidden="true"
                          />
                          <div
                            className="absolute h-32 w-32 rounded-full border border-white/10 shadow-[0_0_0_30px_rgba(33,199,122,0.03),0_0_0_60px_rgba(33,199,122,0.018)]"
                            aria-hidden="true"
                          />
                          <span className="font-heading text-mint relative text-4xl font-semibold tracking-[-0.05em]">
                            {member.initials}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-5 sm:p-6">
                      <h3 className="font-heading text-ink text-xl leading-snug font-semibold tracking-[-0.02em]">
                        {member.name}
                      </h3>
                      <p className="text-brand/85 mt-2 text-xs font-bold">
                        CRM {member.crm}/{member.crmState} • RQE {member.rqe}
                      </p>
                      <div className="border-border-light mt-3 border-t pt-3">
                        <p className="text-ink text-sm font-semibold">
                          {member.specialty || "Médico Especialista"}
                        </p>
                        {member.subspecialties.length > 0 ? (
                          <ul className="mt-2 flex flex-wrap gap-2">
                            {member.subspecialties.map((subspecialty) => (
                              <li
                                key={subspecialty}
                                className="bg-mint text-brand-dark rounded-full px-3 py-1 text-xs font-semibold"
                              >
                                {subspecialty}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <p className="text-muted mt-1 text-xs font-semibold">
                          {member.role}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="mt-12" aria-labelledby="pillars-title">
            <h2 id="pillars-title" className="sr-only">
              Pilares do Corpo Médico INNEURO
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {teamHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="border-border-light rounded-3xl border bg-white p-5"
                  >
                    <span className="bg-mint text-brand grid h-10 w-10 place-items-center rounded-xl">
                      <Icon aria-hidden="true" size={20} />
                    </span>
                    <h3 className="font-heading text-ink mt-4 text-base font-semibold">
                      {item.title}
                    </h3>
                    <p className="text-muted mt-2 text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="bg-mint mt-12 rounded-3xl p-6 sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8">
            <div className="max-w-2xl">
              <h2 className="font-heading text-brand-dark text-2xl font-semibold tracking-[-0.035em]">
                Precisa realizar um exame?
              </h2>
              <p className="text-brand-dark/72 mt-2 text-sm leading-relaxed sm:text-base">
                Conte com a estrutura, a tecnologia e a experiência do corpo
                médico da INNEURO em todas as etapas do seu exame.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 lg:mt-0 lg:shrink-0">
              <Button href="/contato#pre-agendamento">
                <CalendarPlus aria-hidden="true" size={17} /> Agendar exame
              </Button>
              <Button href="/exames" variant="outline">
                Conhecer nossos exames
                <ArrowRight aria-hidden="true" size={16} />
              </Button>
            </div>
          </section>
        </Container>
      </section>
    </main>
  );
}
