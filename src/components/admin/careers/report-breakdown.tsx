import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CareerReportDimension } from "@/lib/careers/reports";

export function ReportBreakdown({
  title,
  dimension,
  counts,
  labels,
  filters,
}: {
  title: string;
  dimension: CareerReportDimension;
  counts: Record<string, number>;
  labels: Record<string, string>;
  filters: Record<string, string>;
}) {
  return (
    <section className="border-border-light rounded-3xl border bg-white p-5">
      <h2 className="font-heading text-brand-dark text-lg font-semibold">
        {title}
      </h2>
      {Object.keys(counts).length ? (
        <ul className="mt-4 grid gap-1 text-sm">
          {Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([key, value]) => {
              const query = new URLSearchParams({
                ...filters,
                grupo: dimension,
                valor: key,
              });
              return (
                <li key={key}>
                  <Link
                    href={`/admin/rh/relatorios?${query.toString()}`}
                    className="group hover:bg-surface focus-visible:ring-brand flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 outline-none focus-visible:ring-2"
                    aria-label={`${labels[key]}: ${value.toLocaleString("pt-BR")} candidatos`}
                  >
                    <span className="text-muted flex-1">{labels[key]}</span>
                    <strong>{value.toLocaleString("pt-BR")}</strong>
                    <ChevronRight
                      size={17}
                      className="text-muted transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
        </ul>
      ) : (
        <p className="text-muted mt-4 text-sm">Sem dados no período.</p>
      )}
    </section>
  );
}
