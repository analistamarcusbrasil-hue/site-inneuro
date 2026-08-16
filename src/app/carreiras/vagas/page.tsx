import { BriefcaseBusiness, CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import { requireCareersJobsAccess } from "@/lib/careers/jobs-access";
import {
  currentMacapaDate,
  formatJobDate,
  workModeLabels,
  type CareerJob,
} from "@/lib/careers/jobs";
import { createPageMetadata } from "@/lib/metadata";
import { createSupabasePublicClient } from "@/lib/supabase/server";

export const metadata = createPageMetadata({
  title: "Vagas | Carreiras INNEURO",
  description:
    "Consulte as oportunidades profissionais publicadas pela INNEURO.",
  path: "/carreiras/vagas",
});

export default async function PublicCareerJobsPage() {
  const { isInternalPreview } = await requireCareersJobsAccess();
  const supabase = createSupabasePublicClient();
  const today = currentMacapaDate();
  const result = supabase
    ? await supabase
        .from("career_jobs")
        .select(
          "*, area:career_job_areas!inner(id, name, slug, is_active), unit:company_units(id, name, address, neighborhood, city, state, postal_code, active)",
        )
        .eq("status", "published")
        .lte("opens_on", today)
        .or(`closes_on.is.null,closes_on.gte.${today}`)
        .order("published_at", { ascending: false })
    : { data: null, error: new Error("Supabase indisponível") };
  const jobs = result.error ? [] : ((result.data as CareerJob[] | null) ?? []);

  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="CARREIRAS INNEURO"
        title="Oportunidades profissionais"
        description="Conheça as vagas atualmente publicadas e encontre uma oportunidade alinhada à sua trajetória profissional."
      />
      <section className="bg-surface py-10 sm:py-12 lg:py-16">
        <Container>
          {isInternalPreview ? (
            <p className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold">
              Visualização interna do RH. O portal público continua
              desabilitado.
            </p>
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
                Vagas publicadas
              </p>
              <h1 className="font-heading text-ink mt-3 text-3xl font-semibold sm:text-4xl">
                Faça parte do nosso time
              </h1>
            </div>
            <span className="bg-mint text-brand-dark rounded-full px-4 py-2 text-sm font-bold">
              {jobs.length} oportunidade(s)
            </span>
          </div>

          {result.error ? (
            <p
              role="alert"
              className="bg-error/10 text-error mt-6 rounded-2xl p-4 text-sm font-bold"
            >
              Não foi possível consultar as oportunidades agora.
            </p>
          ) : null}
          {jobs.length ? (
            <div className="mt-7 grid gap-5 lg:grid-cols-2">
              {jobs.map((job) => (
                <article
                  key={job.id}
                  className="border-border-light rounded-3xl border bg-white p-6 shadow-[0_14px_40px_rgba(3,37,27,0.05)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
                        {job.vacancy_number}
                      </p>
                      <p className="text-brand text-xs font-bold tracking-wide uppercase">
                        {job.area?.name}
                      </p>
                      <h2 className="font-heading text-brand-dark mt-2 text-2xl font-semibold">
                        {job.title}
                      </h2>
                    </div>
                    <span className="bg-mint text-brand grid size-11 shrink-0 place-items-center rounded-2xl">
                      <BriefcaseBusiness size={21} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="text-muted mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    <span className="inline-flex items-center gap-2">
                      <MapPin size={16} aria-hidden="true" />
                      {job.location}
                    </span>
                    <span>{workModeLabels[job.work_mode]}</span>
                    {job.unit ? <span>{job.unit.name}</span> : null}
                  </div>
                  <p className="text-ink mt-5 line-clamp-4 text-sm leading-relaxed">
                    {job.description}
                  </p>
                  <div className="border-border-light mt-5 flex flex-wrap items-center justify-between gap-4 border-t pt-5">
                    <span className="text-muted inline-flex items-center gap-2 text-xs">
                      <CalendarDays size={15} aria-hidden="true" />
                      Publicada em{" "}
                      {job.published_at
                        ? new Date(job.published_at).toLocaleDateString("pt-BR")
                        : formatJobDate(job.opens_on)}
                    </span>
                    <Link
                      className="text-brand text-sm font-bold hover:underline"
                      href={`/carreiras/vagas/${job.slug}`}
                    >
                      Ver vaga
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="border-border-light mt-7 rounded-3xl border bg-white p-8 text-center">
              <BriefcaseBusiness
                className="text-brand mx-auto"
                aria-hidden="true"
              />
              <h2 className="font-heading text-ink mt-4 text-xl font-semibold">
                Nenhuma vaga disponível no momento
              </h2>
              <p className="text-muted mt-2 text-sm">
                Novas oportunidades serão exibidas aqui quando forem publicadas.
              </p>
            </div>
          )}
        </Container>
      </section>
    </main>
  );
}
