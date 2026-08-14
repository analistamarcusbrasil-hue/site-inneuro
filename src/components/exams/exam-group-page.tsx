import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ExamCard } from "@/components/exams/exam-card";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import type { ExamGroup } from "@/lib/exams/groups";

export function ExamGroupPage({
  group,
  groups,
}: {
  group: ExamGroup;
  groups: ExamGroup[];
}) {
  const otherGroups = groups.filter((item) => item.slug !== group.slug);
  const countLabel = `${group.exams.length} ${group.exams.length === 1 ? "exame" : "exames"}`;

  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Exames INNEURO"
        title={group.name}
        description={group.shortDescription}
      />
      <section className="bg-surface py-10 sm:py-12 lg:py-16">
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
              {group.name}
            </span>
          </nav>

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow mb-2">Portfólio da categoria</p>
              <h2 className="font-heading text-ink text-3xl font-semibold sm:text-4xl">
                Exames e serviços
              </h2>
            </div>
            <p className="text-brand text-sm font-bold">{countLabel}</p>
          </div>

          {group.exams.length ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {group.exams.map((exam) => (
                <ExamCard key={exam.slug} exam={exam} />
              ))}
            </div>
          ) : (
            <div className="border-border-light mt-8 rounded-3xl border border-dashed bg-white p-8 text-center sm:p-10">
              <h2 className="font-heading text-ink text-2xl font-semibold">
                Categoria em atualização
              </h2>
              <p className="text-muted mx-auto mt-3 max-w-2xl leading-relaxed">
                Os exames desta categoria estão sendo atualizados. Entre em
                contato com a INNEURO para mais informações.
              </p>
            </div>
          )}

          {otherGroups.length ? (
            <section className="border-border-light mt-12 border-t pt-10">
              <h2 className="font-heading text-ink text-2xl font-semibold">
                Outras categorias de exames
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {otherGroups.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/exames/${item.slug}`}
                    className="border-border-light hover:border-brand/35 focus-visible:ring-tech flex min-h-20 items-center justify-between gap-4 rounded-2xl border bg-white px-5 py-4 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span>
                      <span className="text-ink block text-sm font-bold">
                        {item.name}
                      </span>
                      <span className="text-muted mt-1 block text-xs">
                        {item.exams.length}{" "}
                        {item.exams.length === 1 ? "exame" : "exames"}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="text-brand shrink-0"
                      size={17}
                    />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </Container>
      </section>
    </main>
  );
}
