import type { Metadata } from "next";
import { ArrowLeft, CalendarPlus, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExamGroupPage } from "@/components/exams/exam-group-page";
import { InternalHero } from "@/components/layout/internal-hero";
import { Container } from "@/components/layout/container";
import { hasIndexableExamContent } from "@/data/exames";
import { exames as staticExams } from "@/data/exames";
import { modalities as staticModalities } from "@/data/modalidades";
import {
  getPublicExams,
  getPublicInstitutionalContent,
  getPublicPreparationBySlug,
} from "@/lib/cms/public-content";
import { createExamGroups, findExamGroup } from "@/lib/exams/groups";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
import { createPageMetadata } from "@/lib/metadata";

type ExamPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  const groupSlugs = createExamGroups(staticExams, staticModalities).map(
    (group) => group.slug,
  );
  const examSlugs = staticExams
    .filter((exam) => exam.active)
    .map((exam) => exam.slug);
  return [...new Set([...groupSlugs, ...examSlugs])].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: ExamPageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = await getPublicExams();
  const group = findExamGroup(
    createExamGroups(content.exams, content.modalities),
    slug,
  );
  if (group) {
    return createPageMetadata({
      title: `${group.name} | INNEURO`,
      description: `Conheça os exames e serviços de ${group.name} disponíveis na INNEURO.`,
      path: `/exames/${group.slug}`,
    });
  }
  const exam = content.exams.find((item) => item.slug === slug) ?? null;
  if (!exam) return {};
  return createPageMetadata({
    title: `${exam.name} em Macapá | INNEURO`,
    description: exam.shortDescription,
    path: `/exames/${exam.slug}`,
    index: hasIndexableExamContent(exam),
  });
}

export default async function ExamPage({ params }: ExamPageProps) {
  const { slug } = await params;
  const content = await getPublicExams();
  const groups = createExamGroups(content.exams, content.modalities);
  const group = findExamGroup(groups, slug);
  if (group) return <ExamGroupPage group={group} groups={groups} />;

  const exam = content.exams.find((item) => item.slug === slug) ?? null;
  if (!exam) notFound();
  const [service, institutional] = await Promise.all([
    getPublicPreparationBySlug(slug),
    getPublicInstitutionalContent(),
  ]);
  const whatsappNumber = normalizeWhatsAppNumber(
    institutional.config.whatsapp.primary.number,
  );
  const fields = [
    ["Para que serve", exam.purpose],
    ["Como é realizado", exam.howPerformed],
    ["Orientações gerais", exam.generalGuidance],
    ["Documentos", exam.documents ?? service?.documents?.join(" · ")],
  ] as const;

  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow={exam.modality}
        title={exam.name}
        description={exam.shortDescription}
      />
      <section className="bg-surface py-14 sm:py-18 lg:py-24">
        <Container>
          <nav
            aria-label="Breadcrumb"
            className="text-muted mb-8 flex flex-wrap items-center gap-2 text-sm"
          >
            <Link href="/" className="hover:text-brand">
              Início
            </Link>
            <span aria-hidden="true">/</span>
            <Link href="/exames" className="hover:text-brand">
              Exames
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="text-ink">
              {exam.name}
            </span>
          </nav>
          <div className="grid gap-5 md:grid-cols-2">
            {fields
              .filter(([, content]) => content)
              .map(([title, content]) => (
                <section
                  key={title}
                  className="border-border-light rounded-3xl border bg-white p-7"
                >
                  <h2 className="font-heading text-ink text-xl font-semibold">
                    {title}
                  </h2>
                  <p className="text-muted mt-4 leading-relaxed">{content}</p>
                </section>
              ))}
          </div>
          {exam.preparationSlug && (
            <section className="border-border-light mt-5 rounded-3xl border bg-white p-7">
              <h2 className="font-heading text-ink text-xl font-semibold">
                Preparo
              </h2>
              <Link
                href={`/preparos/${exam.preparationSlug}`}
                className="text-brand mt-4 inline-flex min-h-11 items-center text-sm font-bold"
              >
                Consultar preparo
              </Link>
            </section>
          )}
          {service?.schedules.length ? (
            <section className="border-border-light mt-5 rounded-3xl border bg-white p-7">
              <h2 className="font-heading text-ink text-xl font-semibold">
                Horários da modalidade
              </h2>
              <p className="text-brand mt-2 text-sm font-bold">
                {service.attendanceLabel}
              </p>
              <ul className="text-muted mt-4 space-y-2 text-sm">
                {service.schedules.map((schedule, index) => (
                  <li key={`${schedule.days}-${index}`}>
                    <strong>{schedule.days}:</strong>{" "}
                    {schedule.periods
                      .map((period) => `${period.start} às ${period.end}`)
                      .join(" · ")}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="border-border-light mt-5 rounded-3xl border bg-white p-7">
            <h2 className="font-heading text-ink text-xl font-semibold">
              Convênios
            </h2>
            <p className="text-muted mt-3 text-sm leading-relaxed">
              A cobertura varia conforme o plano, o produto contratado e o
              procedimento solicitado.
            </p>
            <Link
              href="/convenios"
              className="text-brand mt-3 inline-flex min-h-11 items-center text-sm font-bold"
            >
              Consultar convênios e confirmar cobertura
            </Link>
          </section>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/contato?exame=${encodeURIComponent(exam.name)}#pre-agendamento`}
              className="bg-brand focus-visible:ring-tech inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-bold text-white focus-visible:ring-2 focus-visible:outline-none"
            >
              <CalendarPlus aria-hidden="true" size={18} /> Agendar exame
            </Link>
            {whatsappNumber ? (
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-brand/25 text-brand-dark focus-visible:ring-tech inline-flex min-h-12 items-center gap-2 rounded-full border px-6 text-sm font-bold focus-visible:ring-2 focus-visible:outline-none"
              >
                <MessageCircle aria-hidden="true" size={18} /> Falar pelo
                WhatsApp
              </a>
            ) : (
              <button
                disabled
                aria-disabled="true"
                className="border-border-light text-muted inline-flex min-h-12 cursor-not-allowed items-center gap-2 rounded-full border px-6 text-sm font-bold opacity-65"
              >
                <MessageCircle aria-hidden="true" size={18} /> Falar pelo
                WhatsApp
              </button>
            )}
          </div>
          <Link
            href="/exames"
            className="text-brand mt-12 inline-flex min-h-11 items-center gap-2 text-sm font-bold"
          >
            <ArrowLeft aria-hidden="true" size={17} /> Todos os exames
          </Link>
        </Container>
      </section>
    </main>
  );
}
