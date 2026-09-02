"use client";

import { useMemo, useState } from "react";
import { saveJobMatchMatrixAction } from "@/app/admin/(protected)/rh/vagas/[id]/aderencia/actions";
import {
  matchCriterionKindLabels,
  matchCriterionPriorityLabels,
  type MatchMatrixCriterion,
} from "@/lib/careers/matching";

export function MatchMatrixEditor({
  jobId,
  criteria,
}: {
  jobId: string;
  criteria: MatchMatrixCriterion[];
}) {
  const [draft, setDraft] = useState(criteria);
  const total = useMemo(
    () =>
      draft
        .filter((criterion) => criterion.active && criterion.kind === "scoring")
        .reduce((sum, criterion) => sum + criterion.weight, 0),
    [draft],
  );

  function update(
    key: MatchMatrixCriterion["key"],
    values: Partial<MatchMatrixCriterion>,
  ) {
    setDraft((current) =>
      current.map((criterion) =>
        criterion.key === key ? { ...criterion, ...values } : criterion,
      ),
    );
  }

  return (
    <form
      action={saveJobMatchMatrixAction}
      onSubmit={(event) => {
        if (
          total !== 100 ||
          !window.confirm(
            "Salvar uma nova versão da matriz e recalcular as candidaturas desta vaga? O histórico anterior será preservado.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="job_id" value={jobId} />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {draft.map((criterion) => (
          <fieldset
            key={criterion.key}
            className="border-border-light text-ink rounded-2xl border p-4 text-sm"
          >
            <legend className="sr-only">{criterion.label}</legend>
            <label className="flex min-h-8 items-start gap-3 font-bold">
              <input
                type="checkbox"
                name={`active_${criterion.key}`}
                checked={criterion.active}
                onChange={(event) =>
                  update(criterion.key, {
                    active: event.target.checked,
                    weight: event.target.checked ? criterion.weight : 0,
                  })
                }
                className="accent-brand mt-0.5 size-4"
              />
              <span>{criterion.label}</span>
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-muted grid gap-1 text-xs font-bold">
                Uso
                <select
                  name={`kind_${criterion.key}`}
                  value={criterion.kind}
                  disabled={!criterion.active}
                  onChange={(event) => {
                    const kind = event.target
                      .value as MatchMatrixCriterion["kind"];
                    update(criterion.key, {
                      kind,
                      weight: kind === "minimum" ? 0 : criterion.weight,
                    });
                  }}
                  className="border-border-light text-ink min-h-10 rounded-xl border bg-white px-3 font-normal disabled:bg-slate-100"
                >
                  {Object.entries(matchCriterionKindLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
                {!criterion.active ? (
                  <input
                    type="hidden"
                    name={`kind_${criterion.key}`}
                    value={criterion.kind}
                  />
                ) : null}
              </label>
              <label className="text-muted grid gap-1 text-xs font-bold">
                Prioridade
                <select
                  name={`priority_${criterion.key}`}
                  value={criterion.priority}
                  onChange={(event) =>
                    update(criterion.key, {
                      priority: event.target
                        .value as MatchMatrixCriterion["priority"],
                    })
                  }
                  className="border-border-light text-ink min-h-10 rounded-xl border bg-white px-3 font-normal"
                >
                  {Object.entries(matchCriterionPriorityLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <label className="text-muted mt-3 grid gap-1 text-xs font-bold">
              Peso
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  name={`weight_${criterion.key}`}
                  value={criterion.weight}
                  onChange={(event) =>
                    update(criterion.key, {
                      weight: Math.max(
                        0,
                        Math.min(100, Number(event.target.value)),
                      ),
                    })
                  }
                  min={0}
                  max={100}
                  step={1}
                  readOnly={!criterion.active || criterion.kind === "minimum"}
                  required
                  className="border-border-light focus:border-brand text-ink min-h-10 min-w-0 flex-1 rounded-xl border px-4 font-normal outline-none read-only:bg-slate-100"
                />
                <span aria-hidden="true">%</span>
              </span>
            </label>
          </fieldset>
        ))}
      </div>
      <div className="border-border-light mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
        <div>
          <p
            role="status"
            className={`text-sm font-bold ${total === 100 ? "text-brand-dark" : "text-error"}`}
          >
            Soma dos critérios ativos de pontuação: {total}%
          </p>
          <p className="text-muted mt-1 max-w-2xl text-xs leading-relaxed">
            Requisitos mínimos ficam separados da nota. Dados não identificados
            pedem análise humana e não geram rejeição automática.
          </p>
        </div>
        <button
          disabled={total !== 100}
          className="bg-brand hover:bg-brand-dark min-h-11 rounded-full px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Salvar nova versão
        </button>
      </div>
    </form>
  );
}
