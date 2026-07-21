import type { Metadata } from "next";
import { ArrowLeft, CalendarPlus, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InternalHero } from "@/components/layout/internal-hero";
import { Container } from "@/components/layout/container";
import { siteConfig } from "@/config/site";
import { exames } from "@/data/exames";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";

type ExamPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return exames
    .filter((exam) => exam.active)
    .map((exam) => ({ slug: exam.slug }));
}

export async function generateMetadata({
  params,
}: ExamPageProps): Promise<Metadata> {
  const { slug } = await params;
  const exam = exames.find((item) => item.slug === slug && item.active);
  if (!exam) return {};
  const canonical = siteConfig.url
    ? `${siteConfig.url}/exames/${exam.slug}`
    : undefined;
  const hasValidatedDetails = Boolean(
    exam.purpose || exam.howPerformed || exam.generalGuidance || exam.documents,
  );
  return {
    title: `${exam.name} | INNEURO`,
    description: exam.shortDescription,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: `${exam.name} | INNEURO`,
      description: exam.shortDescription,
      url: canonical,
    },
    robots: { index: hasValidatedDetails, follow: true },
  };
}

export default async function ExamPage({ params }: ExamPageProps) {
  const { slug } = await params;
  const exam = exames.find((item) => item.slug === slug && item.active);
  if (!exam) notFound();
  const whatsappNumber = normalizeWhatsAppNumber(
    siteConfig.whatsapp.primary.number,
  );
  const fields = [
    ["Para que serve", exam.purpose],
    ["Como é realizado", exam.howPerformed],
    ["Orientações gerais", exam.generalGuidance],
    ["Documentos", exam.documents],
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
                href={`/preparos?exame=${exam.preparationSlug}`}
                className="text-brand mt-4 inline-flex min-h-11 items-center text-sm font-bold"
              >
                Consultar preparo
              </Link>
            </section>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/#agendamento"
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
