import Image from "next/image";
import {
  ArrowRight,
  Award,
  CalendarPlus,
  ScanSearch,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import { Button } from "@/components/ui/button";
import { medicalTeam } from "@/data/medical-team";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Equipe Médica | INNEURO",
  description:
    "Conheça a equipe médica da INNEURO e os especialistas responsáveis pelos exames de diagnóstico por imagem da clínica.",
  path: "/equipe-medica",
});

const teamHighlights = [
  {
    title: "Especialização",
    description:
      "Profissionais qualificados em diferentes áreas do diagnóstico por imagem.",
    icon: Award,
  },
  {
    title: "Precisão diagnóstica",
    description:
      "Experiência médica aliada à tecnologia para apoiar decisões clínicas seguras.",
    icon: ScanSearch,
  },
  {
    title: "Atendimento integrado",
    description:
      "Equipe trabalhando em conjunto para oferecer uma análise completa e cuidadosa.",
    icon: UsersRound,
  },
];

export default function MedicalTeamPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Corpo médico"
        title="Especialistas que transformam tecnologia em diagnósticos precisos."
        description="A INNEURO reúne médicos especializados em diagnóstico por imagem, comprometidos com precisão, segurança e excelência em cada exame."
      />

      <section className="bg-surface py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="grid gap-5 md:grid-cols-3">
            {teamHighlights.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="border-border-light rounded-3xl border bg-white p-7"
                >
                  <span className="bg-mint text-brand grid h-12 w-12 place-items-center rounded-2xl">
                    <Icon aria-hidden="true" size={23} />
                  </span>
                  <h2 className="font-heading text-ink mt-5 text-xl font-semibold">
                    {item.title}
                  </h2>
                  <p className="text-muted mt-3 leading-relaxed">
                    {item.description}
                  </p>
                </article>
              );
            })}
          </div>

          <section className="bg-brand-dark relative mt-8 overflow-hidden rounded-[2rem] px-7 py-10 text-white sm:px-10 sm:py-12 lg:px-14">
            <div
              className="hero-grid absolute inset-0 opacity-20"
              aria-hidden="true"
            />
            <div className="relative max-w-3xl">
              <p className="text-mint text-xs font-bold tracking-[0.18em] uppercase">
                Conhecimento e cuidado
              </p>
              <h2 className="font-heading mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                Excelência que começa pelas pessoas
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/72 sm:text-lg">
                Tecnologia avançada é fundamental. A experiência, o conhecimento
                e o olhar médico transformam imagens em informações importantes
                para o cuidado com cada paciente.
              </p>
            </div>
          </section>

          <section className="pt-16 sm:pt-20" aria-labelledby="team-title">
            <div className="max-w-3xl">
              <p className="text-brand text-xs font-bold tracking-[0.18em] uppercase">
                Profissionais da INNEURO
              </p>
              <h2
                id="team-title"
                className="font-heading text-ink mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl"
              >
                Corpo médico
              </h2>
              <p className="text-muted mt-4 leading-relaxed">
                Conheça os profissionais responsáveis pela análise médica dos
                exames realizados na INNEURO.
              </p>
            </div>

            {medicalTeam.length ? (
              <div className="mt-9 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {medicalTeam.map((member) => (
                  <article
                    key={member.id}
                    className="border-border-light overflow-hidden rounded-[2rem] border bg-white"
                  >
                    <div className="bg-mint relative aspect-[4/5] overflow-hidden">
                      <Image
                        src={member.image}
                        alt={member.imageAlt}
                        fill
                        sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                    <div className="p-6 sm:p-7">
                      <h3 className="font-heading text-ink text-2xl font-semibold">
                        {member.name}
                      </h3>
                      <p className="text-brand mt-2 text-sm font-bold">
                        CRM/{member.crmState} {member.crm}
                        {member.rqe ? ` • RQE ${member.rqe}` : ""}
                      </p>
                      <p className="text-ink mt-5 font-semibold">
                        {member.specialty}
                      </p>
                      {member.subspecialties?.length ? (
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
                      <p className="text-muted mt-5 text-sm font-semibold">
                        {member.role}
                      </p>
                      {member.bio ? (
                        <p className="text-muted mt-3 text-sm leading-relaxed">
                          {member.bio}
                        </p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="border-border-light mt-9 rounded-[2rem] border bg-white p-8 text-center sm:p-10">
                <span className="bg-mint text-brand mx-auto grid h-14 w-14 place-items-center rounded-2xl">
                  <Stethoscope aria-hidden="true" size={26} />
                </span>
                <h3 className="font-heading text-ink mt-5 text-2xl font-semibold">
                  Perfis em atualização
                </h3>
                <p className="text-muted mx-auto mt-3 max-w-2xl leading-relaxed">
                  Os perfis dos profissionais serão apresentados nesta página
                  após a validação dos dados institucionais.
                </p>
              </div>
            )}
          </section>

          <section className="bg-mint mt-16 rounded-[2rem] p-8 sm:mt-20 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div className="max-w-2xl">
              <h2 className="font-heading text-brand-dark text-3xl font-semibold tracking-[-0.035em]">
                Precisa realizar um exame?
              </h2>
              <p className="text-brand-dark/72 mt-3 leading-relaxed">
                Conte com a estrutura e a equipe médica da INNEURO para cuidar
                de cada detalhe do seu diagnóstico.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 lg:mt-0 lg:shrink-0">
              <Button href="/contato#pre-agendamento" size="lg">
                <CalendarPlus aria-hidden="true" size={18} /> Agendar exame
              </Button>
              <Button href="/exames" variant="outline" size="lg">
                Ver exames <ArrowRight aria-hidden="true" size={17} />
              </Button>
            </div>
          </section>
        </Container>
      </section>
    </main>
  );
}
