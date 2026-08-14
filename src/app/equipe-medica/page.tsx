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
import { Badge } from "@/components/ui/badge";
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
      <section className="bg-brand-dark relative overflow-hidden pt-24 pb-12 text-white sm:pt-28 sm:pb-16 lg:pt-32 lg:pb-20">
        <div
          className="hero-grid absolute inset-0 opacity-20"
          aria-hidden="true"
        />
        <div className="internal-hero-ring" aria-hidden="true" />
        <Container className="relative">
          <div className="grid items-end gap-9 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-16">
            <div className="max-w-4xl">
              <Badge className="text-mint border-white/15 bg-white/8">
                Corpo Médico INNEURO
              </Badge>
              <h1 className="font-heading mt-4 text-[clamp(2.5rem,5.8vw,5.25rem)] leading-[0.98] font-semibold tracking-[-0.06em]">
                Especialistas por trás de cada diagnóstico.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/78 sm:text-lg">
                A INNEURO reúne um corpo médico formado por especialistas
                comprometidos com a excelência em diagnóstico por imagem. São
                profissionais que analisam exames, interpretam imagens e
                elaboram laudos com atenção, conhecimento e precisão.
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/58 sm:text-base">
                Tecnologia de alto nível faz a diferença. Mas é a experiência
                médica que transforma imagens em informações relevantes para a
                condução do cuidado.
              </p>
            </div>

            <div className="rounded-3xl border border-white/12 bg-white/6 p-6 backdrop-blur-sm lg:text-right">
              <strong className="font-heading text-tech block text-5xl font-semibold tracking-[-0.05em]">
                {medicalTeam.length}
              </strong>
              <span className="mt-2 block text-sm leading-relaxed font-semibold text-white/72">
                médicos especialistas no Corpo Médico INNEURO
              </span>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-surface py-14 sm:py-18 lg:py-24">
        <Container>
          <section className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <p className="text-brand text-xs font-bold tracking-[0.18em] uppercase">
                Conhecimento e responsabilidade
              </p>
              <h2 className="font-heading text-ink mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                Excelência que começa pelas pessoas
              </h2>
            </div>
            <p className="text-muted text-base leading-relaxed sm:text-lg">
              A qualidade de um exame não depende apenas da tecnologia
              utilizada. A interpretação médica é parte essencial do processo.
              Na INNEURO, nossa equipe técnica reúne especialistas que atuam na
              análise das imagens e na elaboração dos laudos, com atenção e
              responsabilidade em cada etapa.
            </p>
          </section>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {teamHighlights.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="border-border-light rounded-3xl border bg-white p-7 shadow-[0_16px_45px_rgba(3,37,27,0.04)]"
                >
                  <span className="bg-mint text-brand grid h-12 w-12 place-items-center rounded-2xl">
                    <Icon aria-hidden="true" size={23} />
                  </span>
                  <h3 className="font-heading text-ink mt-5 text-xl font-semibold">
                    {item.title}
                  </h3>
                  <p className="text-muted mt-3 leading-relaxed">
                    {item.description}
                  </p>
                </article>
              );
            })}
          </div>

          <blockquote className="bg-brand-dark relative mt-8 overflow-hidden rounded-[2rem] px-7 py-10 text-white sm:px-12 sm:py-12 lg:px-16">
            <div
              className="hero-grid absolute inset-0 opacity-15"
              aria-hidden="true"
            />
            <p className="font-heading relative max-w-4xl text-2xl leading-snug font-semibold tracking-[-0.03em] sm:text-3xl">
              “Por trás de cada imagem existe conhecimento, experiência e
              responsabilidade médica.”
            </p>
          </blockquote>

          <section className="pt-16 sm:pt-20" aria-labelledby="team-title">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div className="max-w-3xl">
                <p className="text-brand text-xs font-bold tracking-[0.18em] uppercase">
                  Profissionais da INNEURO
                </p>
                <h2
                  id="team-title"
                  className="font-heading text-ink mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl"
                >
                  Corpo Médico INNEURO
                </h2>
                <p className="text-muted mt-4 leading-relaxed">
                  Conheça os profissionais que integram o corpo médico da
                  INNEURO.
                </p>
              </div>
              <p className="text-brand shrink-0 text-sm font-bold">
                {medicalTeam.length} médicos especialistas
              </p>
            </div>

            <div className="mt-9 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {medicalTeam.map((member) => {
                const portraitAvailable = hasTeamPortrait(member.image);
                return (
                  <article
                    key={member.id}
                    className="border-border-light group overflow-hidden rounded-[2rem] border bg-white shadow-[0_16px_50px_rgba(3,37,27,0.045)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(3,37,27,0.09)]"
                  >
                    <div className="bg-brand-dark relative aspect-[4/5] overflow-hidden">
                      {portraitAvailable ? (
                        <Image
                          src={member.image}
                          alt={member.imageAlt}
                          fill
                          sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.015]"
                        />
                      ) : (
                        <div
                          className="relative grid h-full place-items-center overflow-hidden"
                          role="img"
                          aria-label={`Foto de ${member.name} ainda não disponível`}
                        >
                          <div
                            className="hero-grid absolute inset-0 opacity-25"
                            aria-hidden="true"
                          />
                          <div
                            className="absolute h-52 w-52 rounded-full border border-white/10 shadow-[0_0_0_42px_rgba(33,199,122,0.035),0_0_0_84px_rgba(33,199,122,0.02)]"
                            aria-hidden="true"
                          />
                          <span className="font-heading text-mint relative text-6xl font-semibold tracking-[-0.06em]">
                            {member.initials}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-6 sm:p-7">
                      <h3 className="font-heading text-ink min-h-[3.5rem] text-2xl leading-tight font-semibold tracking-[-0.025em]">
                        {member.name}
                      </h3>
                      <p className="text-brand mt-4 text-sm font-bold">
                        CRM {member.crm}/{member.crmState} • RQE {member.rqe}
                      </p>
                      <div className="border-border-light mt-5 border-t pt-5">
                        <p className="text-ink font-semibold">
                          {member.specialty || "Médico Especialista"}
                        </p>
                        {member.subspecialties.length > 0 ? (
                          <ul className="mt-3 flex flex-wrap gap-2">
                            {member.subspecialties.map((subspecialty) => (
                              <li
                                key={subspecialty}
                                className="bg-mint text-brand-dark rounded-full px-3 py-1.5 text-xs font-semibold"
                              >
                                {subspecialty}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <p className="text-muted mt-2 text-sm font-semibold">
                          {member.role}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="bg-mint mt-16 rounded-[2rem] p-8 sm:mt-20 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div className="max-w-2xl">
              <h2 className="font-heading text-brand-dark text-3xl font-semibold tracking-[-0.04em]">
                Precisa realizar um exame?
              </h2>
              <p className="text-brand-dark/72 mt-3 leading-relaxed">
                Conte com a estrutura, a tecnologia e a experiência do corpo
                médico da INNEURO em todas as etapas do seu exame.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 lg:mt-0 lg:shrink-0">
              <Button href="/contato#pre-agendamento" size="lg">
                <CalendarPlus aria-hidden="true" size={18} /> Agendar exame
              </Button>
              <Button href="/exames" variant="outline" size="lg">
                Conhecer nossos exames{" "}
                <ArrowRight aria-hidden="true" size={17} />
              </Button>
            </div>
          </section>
        </Container>
      </section>
    </main>
  );
}
