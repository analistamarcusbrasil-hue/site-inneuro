import { BriefcaseBusiness, CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import { siteConfig } from "@/config/site";
import { requireCareersJobsAccess } from "@/lib/careers/jobs-access";
import {
  currentMacapaDate,
  formatJobDate,
  workModeLabels,
  type CareerJob,
} from "@/lib/careers/jobs";
import { formatCompanyUnitLocation } from "@/lib/careers/logistics";
import { createPageMetadata } from "@/lib/metadata";
import { createSupabasePublicClient } from "@/lib/supabase/server";

export const metadata = createPageMetadata({
  title: "Oportunidade profissional | Carreiras INNEURO",
  description:
    "Consulte os detalhes de uma oportunidade profissional publicada pela INNEURO.",
  path: "/carreiras/vagas",
});

function PublicJobSection({
  title,
  value,
}: {
  title: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <section className="border-border-light rounded-3xl border bg-white p-6">
      <h2 className="font-heading text-brand-dark text-xl font-semibold">
        {title}
      </h2>
      <p className="text-ink mt-4 text-sm leading-relaxed whitespace-pre-line sm:text-base">
        {value}
      </p>
    </section>
  );
}

export default async function PublicCareerJobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();
  const { isInternalPreview } = await requireCareersJobsAccess();
  const supabase = createSupabasePublicClient();
  if (!supabase) notFound();
  const today = currentMacapaDate();
  const { data, error } = await supabase
    .from("career_jobs")
    .select(
      "*, area:career_job_areas!inner(id, name, slug, is_active), unit:company_units(id, name, address, neighborhood, city, state, postal_code, active)",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .lte("opens_on", today)
    .or(`closes_on.is.null,closes_on.gte.${today}`)
    .maybeSingle();
  if (error || !data) notFound();
  const job = data as CareerJob;

  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow={
          job.area?.name?.toLocaleUpperCase("pt-BR") ?? "CARREIRAS INNEURO"
        }
        title={job.title}
        description={job.description}
      />
      <section className="bg-surface py-10 sm:py-12 lg:py-16">
        <Container className="max-w-5xl">
          {isInternalPreview ? (
            <p className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold">
              Visualização interna do RH. O portal público continua
              desabilitado.
            </p>
          ) : null}
          <section className="border-border-light rounded-3xl border bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-brand text-xs font-bold tracking-wide uppercase">
                  {job.area?.name}
                </p>
                <h1 className="font-heading text-brand-dark mt-2 text-3xl font-semibold">
                  {job.title}
                </h1>
              </div>
              <span className="bg-mint text-brand grid size-12 place-items-center rounded-2xl">
                <BriefcaseBusiness aria-hidden="true" />
              </span>
            </div>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted">Empresa</dt>
                <dd className="text-ink mt-1 font-bold">{siteConfig.name}</dd>
              </div>
              <div>
                <dt className="text-muted">Local</dt>
                <dd className="text-ink mt-1 flex items-center gap-2 font-bold">
                  <MapPin size={15} aria-hidden="true" />
                  {job.location}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Modalidade</dt>
                <dd className="text-ink mt-1 font-bold">
                  {workModeLabels[job.work_mode]}
                </dd>
              </div>
              {job.positions ? (
                <div>
                  <dt className="text-muted">Posições</dt>
                  <dd className="text-ink mt-1 font-bold">{job.positions}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted">Abertura</dt>
                <dd className="text-ink mt-1 flex items-center gap-2 font-bold">
                  <CalendarDays size={15} aria-hidden="true" />
                  {formatJobDate(job.opens_on)}
                </dd>
              </div>
            </dl>
            {job.closes_on ? (
              <p className="text-muted border-border-light mt-5 border-t pt-5 text-sm">
                Inscrições previstas até {formatJobDate(job.closes_on)}.
              </p>
            ) : null}
            {job.unit ? (
              <div className="border-border-light mt-5 border-t pt-5 text-sm">
                <p className="text-ink font-bold">{job.unit.name}</p>
                <p className="text-muted mt-1">{job.unit.address}</p>
                <p className="text-muted">
                  {formatCompanyUnitLocation(job.unit)}
                </p>
              </div>
            ) : null}
          </section>

          <div className="mt-6 grid gap-5">
            <PublicJobSection
              title="Principais atividades"
              value={job.activities}
            />
            <PublicJobSection title="Escolaridade" value={job.schooling} />
            <PublicJobSection
              title="Experiência desejável"
              value={job.desirable_experience}
            />
            <PublicJobSection
              title="Requisitos obrigatórios"
              value={job.required_requirements}
            />
            <PublicJobSection
              title="Requisitos desejáveis"
              value={job.desirable_requirements}
            />
            <PublicJobSection title="Habilidades" value={job.skills} />
            <PublicJobSection
              title="Certificações"
              value={job.certifications}
            />
            <PublicJobSection
              title="Jornada ou horário"
              value={job.work_schedule}
            />
          </div>

          <aside className="border-brand/15 bg-mint/65 text-brand-dark mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border p-5 sm:p-6">
            <div>
              <h2 className="font-heading text-xl font-semibold">
                Interesse nesta oportunidade?
              </h2>
              <p className="mt-1 text-sm">
                Revise seu perfil profissional antes de enviar a candidatura.
              </p>
            </div>
            {isInternalPreview ? (
              <span className="text-muted text-sm font-bold">
                Candidatura indisponível na visualização interna
              </span>
            ) : (
              <Link
                href={`/carreiras/vagas/${job.slug}/candidatar`}
                className="bg-brand hover:bg-brand-dark focus-visible:ring-tech inline-flex min-h-12 items-center rounded-full px-6 font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Candidatar-se
              </Link>
            )}
          </aside>
        </Container>
      </section>
    </main>
  );
}
