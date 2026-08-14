import { ArrowRight, CalendarPlus } from "lucide-react";
import Link from "next/link";
import { hasExamDetails } from "@/lib/exams/groups";
import type { Exame } from "@/types/exame";

export function ExamCard({ exam }: { exam: Exame }) {
  const hasDetails = hasExamDetails(exam);

  return (
    <article className="border-border-light hover:border-brand/35 flex min-h-64 flex-col rounded-3xl border bg-white p-6 transition-colors sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-brand text-xs font-bold tracking-[0.12em] uppercase">
          {exam.modality}
        </p>
        {exam.badge ? (
          <span className="bg-mint text-brand-dark rounded-full px-2.5 py-1 text-[0.68rem] font-bold tracking-[0.1em] uppercase">
            {exam.badge}
          </span>
        ) : null}
      </div>
      <h2 className="font-heading text-ink mt-4 text-2xl font-semibold tracking-[-0.035em]">
        {exam.name}
      </h2>
      {exam.shortDescription ? (
        <p className="text-muted mt-3 text-sm leading-relaxed">
          {exam.shortDescription}
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-2 pt-7">
        {hasDetails ? (
          <Link
            href={`/exames/${exam.slug}`}
            className="bg-brand hover:bg-brand-dark focus-visible:ring-tech inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-white focus-visible:ring-2 focus-visible:outline-none"
          >
            Saiba mais <ArrowRight aria-hidden="true" size={16} />
          </Link>
        ) : null}
        <Link
          href={`/contato?exame=${encodeURIComponent(exam.name)}#pre-agendamento`}
          className="border-brand/25 text-brand-dark hover:bg-mint focus-visible:ring-tech inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border px-4 text-sm font-bold focus-visible:ring-2 focus-visible:outline-none"
        >
          <CalendarPlus aria-hidden="true" size={16} /> Pré-agendar
        </Link>
      </div>
    </article>
  );
}
