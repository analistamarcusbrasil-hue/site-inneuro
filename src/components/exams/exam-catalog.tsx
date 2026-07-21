"use client";

import {
  ArrowRight,
  CalendarPlus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { exames } from "@/data/exames";
import { modalities } from "@/data/modalidades";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function ExamCatalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialModality = searchParams.get("modalidade") ?? "todos";
  const [query, setQuery] = useState("");
  const [modality, setModality] = useState(
    modalities.some((item) => item.slug === initialModality)
      ? initialModality
      : "todos",
  );

  const filteredExams = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    return exames.filter((exam) => {
      const matchesModality =
        modality === "todos" || exam.modalitySlug === modality;
      const searchable = normalize(
        `${exam.name} ${exam.modality} ${exam.shortDescription}`,
      );
      return (
        exam.active && matchesModality && searchable.includes(normalizedQuery)
      );
    });
  }, [modality, query]);

  function selectModality(value: string) {
    setModality(value);
    router.replace(
      value === "todos" ? "/exames" : `/exames?modalidade=${value}`,
      { scroll: false },
    );
  }

  function clearFilters() {
    setQuery("");
    selectModality("todos");
  }

  return (
    <div>
      <div className="border-border-light grid gap-4 rounded-3xl border bg-white p-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <label className="text-ink text-sm font-semibold">
          Pesquisar exames
          <span className="relative mt-2 block">
            <Search
              aria-hidden="true"
              className="text-muted absolute top-1/2 left-4 -translate-y-1/2"
              size={19}
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Digite nome ou modalidade"
              className="border-border-light bg-surface focus:border-brand focus:ring-tech/25 min-h-12 w-full rounded-2xl border pr-4 pl-12 text-base outline-none focus:ring-2"
            />
          </span>
        </label>
        <label className="text-ink text-sm font-semibold lg:min-w-72">
          Filtrar por modalidade
          <span className="relative mt-2 block">
            <SlidersHorizontal
              aria-hidden="true"
              className="text-muted absolute top-1/2 left-4 -translate-y-1/2"
              size={18}
            />
            <select
              value={modality}
              onChange={(event) => selectModality(event.target.value)}
              className="border-border-light bg-surface focus:border-brand focus:ring-tech/25 min-h-12 w-full appearance-none rounded-2xl border pr-10 pl-12 text-base outline-none focus:ring-2"
            >
              <option value="todos">Todas as modalidades</option>
              {modalities
                .filter((item) => item.active)
                .map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
            </select>
          </span>
        </label>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p role="status" className="text-muted text-sm font-semibold">
          {filteredExams.length}{" "}
          {filteredExams.length === 1 ? "resultado" : "resultados"}
        </p>
        {(query || modality !== "todos") && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-brand focus-visible:ring-tech inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold focus-visible:ring-2 focus-visible:outline-none"
          >
            <X aria-hidden="true" size={16} /> Limpar filtros
          </button>
        )}
      </div>

      {filteredExams.length > 0 ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredExams.map((exam) => (
            <article
              key={exam.slug}
              className="border-border-light hover:border-brand/35 flex min-h-72 flex-col rounded-3xl border bg-white p-6 transition-colors sm:p-7"
            >
              <p className="text-brand text-xs font-bold tracking-[0.12em] uppercase">
                {exam.modality}
              </p>
              <h2 className="font-heading text-ink mt-4 text-2xl font-semibold tracking-[-0.035em]">
                {exam.name}
              </h2>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                {exam.shortDescription}
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-7">
                <Link
                  href={`/exames/${exam.slug}`}
                  className="bg-brand hover:bg-brand-dark focus-visible:ring-tech inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-white focus-visible:ring-2 focus-visible:outline-none"
                >
                  Ver detalhes <ArrowRight aria-hidden="true" size={16} />
                </Link>
                <Link
                  href="/#agendamento"
                  className="border-brand/25 text-brand-dark hover:bg-mint focus-visible:ring-tech inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-bold focus-visible:ring-2 focus-visible:outline-none"
                >
                  <CalendarPlus aria-hidden="true" size={16} /> Agendar
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="border-border-light mt-6 rounded-3xl border border-dashed bg-white p-10 text-center">
          <h2 className="font-heading text-ink text-2xl font-semibold">
            Nenhum resultado encontrado.
          </h2>
          <p className="text-muted mt-3">
            Revise a pesquisa ou visualize todas as modalidades.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="bg-brand focus-visible:ring-tech mt-6 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-white focus-visible:ring-2 focus-visible:outline-none"
          >
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}
