"use client";

import { CalendarClock, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { clinicalServices } from "@/data/clinical-services";

const filters = [
  ["todos", "Todos"],
  ["tomografia-computadorizada", "Tomografia"],
  ["raios-x", "Raios X"],
  ["mapeamento-cerebral", "Mapeamento Cerebral"],
  ["ressonancia-magnetica", "Ressonância Magnética"],
] as const;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function searchableText(service: (typeof clinicalServices)[number]) {
  return [
    service.name,
    ...service.searchTerms,
    ...service.preparationGroups.flatMap((group) => [
      group.title,
      ...group.appliesTo,
      ...group.instructions,
    ]),
  ].join(" ");
}

export function PreparationCatalog() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const results = useMemo(
    () =>
      clinicalServices.filter(
        (service) =>
          service.validatedByClinic &&
          (filter === "todos" || service.slug === filter) &&
          normalize(searchableText(service)).includes(normalize(query)),
      ),
    [filter, query],
  );

  return (
    <div>
      <div className="border-border-light rounded-3xl border bg-white p-5">
        <label className="text-ink text-sm font-semibold">
          Pesquisar por exame, contraste, região ou orientação
          <span className="relative mt-2 block">
            <Search
              aria-hidden="true"
              className="text-muted absolute top-1/2 left-4 -translate-y-1/2"
              size={18}
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="border-border-light bg-surface focus:border-brand focus:ring-brand/25 min-h-12 w-full rounded-2xl border pr-4 pl-12 outline-none focus:ring-2"
            />
          </span>
        </label>
        <div
          className="mt-4 flex flex-wrap gap-2"
          aria-label="Filtrar preparos"
        >
          {filters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className="border-border-light aria-pressed:bg-brand min-h-11 rounded-full border px-4 text-sm font-bold aria-pressed:text-white"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-warning/25 mt-6 rounded-3xl border bg-white p-6 text-sm leading-relaxed">
        <p>
          <strong className="text-warning">Atenção:</strong> As orientações
          podem variar conforme o exame, uso de contraste, idade e condição
          clínica. Em caso de dúvida, confirme o preparo com a equipe da
          INNEURO.
        </p>
        <p className="mt-3 font-semibold">
          Não suspenda medicamentos de uso contínuo sem orientação do
          profissional responsável.
        </p>
      </div>

      {results.length ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {results.map((service) => (
            <article
              key={service.slug}
              className="border-border-light flex flex-col rounded-3xl border bg-white p-7"
            >
              <span className="bg-mint text-brand-dark w-fit rounded-full px-3 py-1 text-xs font-bold">
                {service.attendanceLabel}
              </span>
              <h2 className="font-heading text-ink mt-4 text-2xl font-semibold">
                {service.name}
              </h2>
              <div className="text-muted mt-5 flex items-start gap-2 text-sm">
                <CalendarClock
                  aria-hidden="true"
                  className="text-brand shrink-0"
                  size={18}
                />
                <span>
                  {service.schedules
                    .map(
                      (item) =>
                        `${item.days}: ${item.periods.map((period) => `${period.start} às ${period.end}`).join(" e ")}`,
                    )
                    .join(" · ")}
                </span>
              </div>
              <p className="text-muted mt-5 text-sm">
                {service.preparationGroups
                  .map((group) => group.title)
                  .join(" · ")}
              </p>
              <p className="text-muted mt-3 text-xs">
                Última revisão: 21/07/2026
              </p>
              <Link
                href={`/preparos/${service.slug}`}
                className="bg-brand mt-6 inline-flex min-h-11 w-fit items-center rounded-full px-5 text-sm font-bold text-white"
              >
                Ver horários e preparo
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="border-border-light mt-6 rounded-3xl border border-dashed bg-white p-10 text-center">
          <h2 className="font-heading text-ink text-2xl font-semibold">
            Nenhum preparo encontrado.
          </h2>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("todos");
            }}
            className="text-brand mt-5 inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold"
          >
            <X aria-hidden="true" size={16} /> Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}
