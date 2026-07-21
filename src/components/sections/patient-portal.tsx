import {
  Check,
  Cloud,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Share2,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";

const benefits = [
  "Consulta de laudos",
  "Visualização de imagens",
  "Acesso a exames anteriores",
  "Disponibilidade online",
  "Compartilhamento facilitado com profissionais de saúde",
] as const;

export function PatientPortal() {
  return (
    <section
      aria-labelledby="patient-portal-title"
      className="bg-surface py-16 sm:py-20 lg:py-28"
    >
      <Container>
        <div className="border-border-light relative overflow-hidden rounded-[2rem] border bg-white p-7 sm:p-10 lg:p-14">
          <div className="portal-grid absolute inset-0" aria-hidden="true" />
          <div className="relative grid items-center gap-12 lg:grid-cols-[1fr_.9fr] lg:gap-16">
            <div className="max-w-2xl">
              <Badge>Portal do Paciente</Badge>
              <h2
                id="patient-portal-title"
                className="font-heading text-ink mt-5 text-3xl leading-tight font-semibold tracking-[-0.045em] sm:text-4xl lg:text-5xl"
              >
                Seus exames sempre disponíveis.
              </h2>
              <p className="text-muted mt-5 text-lg leading-relaxed">
                Acesse seus laudos, imagens e histórico de exames armazenados em
                nuvem pelo Portal do Paciente da INNEURO.
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <li
                    key={benefit}
                    className="text-ink flex items-start gap-3 text-sm leading-relaxed"
                  >
                    <span className="bg-mint text-brand mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full">
                      <Check aria-hidden="true" size={12} strokeWidth={2.5} />
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
              <div className="mt-9">
                {siteConfig.patientPortalUrl ? (
                  <a
                    href={siteConfig.patientPortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Acessar Portal do Paciente — abre em nova aba"
                    className="bg-brand hover:bg-brand-dark focus-visible:ring-tech inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    Acessar Portal do Paciente{" "}
                    <ExternalLink aria-hidden="true" size={16} />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    title="Portal do Paciente indisponível no momento"
                    className="bg-border-light text-muted inline-flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-full px-6 text-sm font-bold opacity-75"
                  >
                    Acessar Portal do Paciente{" "}
                    <ExternalLink aria-hidden="true" size={16} />
                  </button>
                )}
                <p className="text-muted mt-4 text-sm">
                  Você será direcionado ao ambiente externo da Proradis.
                </p>
              </div>
            </div>

            <div className="portal-visual" aria-hidden="true">
              <div className="portal-cloud">
                <Cloud size={58} strokeWidth={1.25} />
              </div>
              <div className="portal-document portal-document-one">
                <FileText size={24} />
                <span />
                <span />
                <span />
              </div>
              <div className="portal-document portal-document-two">
                <ImageIcon size={25} />
                <div className="portal-image-frame">
                  <i />
                  <i />
                </div>
              </div>
              <div className="portal-share">
                <Share2 size={18} />
              </div>
              <div className="portal-orbit portal-orbit-one" />
              <div className="portal-orbit portal-orbit-two" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
