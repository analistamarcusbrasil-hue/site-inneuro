"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

type Item = {
  id: string;
  stable_key: string;
  sort_order: number;
  active: boolean;
  version: {
    title: string;
    description: string | null;
    category: string;
    question_type: string;
    required: boolean;
    allow_na: boolean;
    options: Array<{ label: string; value: string }>;
  };
};

const categories = [
  "EXPERIENCIA_GERAL",
  "AGENDAMENTO",
  "RECEPCAO",
  "TEMPO_ESPERA",
  "PROFISSIONAIS",
  "EXECUCAO_EXAME",
  "SEGURANCA_CONFORTO",
  "COMUNICACAO",
  "INFRAESTRUTURA",
  "LIMPEZA",
  "ENFERMAGEM",
  "ATENDIMENTO_EXAME",
  "RESOLUCAO",
  "NPS",
  "DIAGNOSTICO",
  "DESTAQUE",
];
const types = [
  "STAR_5",
  "NPS_10",
  "NUMBER_SCALE",
  "YES_NO",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "SHORT_TEXT",
  "LONG_TEXT",
  "AUDIO",
];

export function SurveyQuestionBuilder({ initial }: { initial: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [selected, setSelected] = useState(initial[0]?.id ?? "new");
  const [busy, setBusy] = useState(false);
  const current = items.find((item) => item.id === selected);
  async function action(body: Record<string, unknown>) {
    setBusy(true);
    const response = await fetch("/api/admin/pesquisas/perguntas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!response.ok)
      return window.alert("Não foi possível salvar a alteração.");
    router.refresh();
  }
  function patchCurrent(patch: Partial<Item["version"]>) {
    setItems((value) =>
      value.map((item) =>
        item.id === selected
          ? { ...item, version: { ...item.version, ...patch } }
          : item,
      ),
    );
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[280px_1fr_340px]">
      <aside className="border-border-light rounded-3xl border bg-white p-4">
        <button
          onClick={() => setSelected("new")}
          className="bg-brand flex min-h-11 w-full items-center justify-center gap-2 rounded-full font-bold text-white"
        >
          <Plus size={17} />
          Nova pergunta
        </button>
        <ul className="mt-4 space-y-2">
          {items.map((item, index) => (
            <li key={item.id}>
              <button
                onClick={() => setSelected(item.id)}
                className={`flex w-full items-center gap-2 rounded-2xl p-3 text-left text-sm ${selected === item.id ? "bg-mint text-brand" : "bg-slate-50 text-slate-600"}`}
              >
                <GripVertical size={16} />
                <span className="line-clamp-2 flex-1">
                  {index + 1}. {item.version.title}
                </span>
                <span
                  className={`size-2 rounded-full ${item.active ? "bg-emerald-500" : "bg-slate-300"}`}
                />
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="border-border-light rounded-3xl border bg-white p-6">
        <h2 className="font-heading text-brand-dark text-xl font-semibold">
          Prévia
        </h2>
        <div className="mt-8 rounded-3xl bg-emerald-950 p-7 text-white">
          <p className="text-xs font-bold tracking-widest text-emerald-200 uppercase">
            Pergunta
          </p>
          <h3 className="font-heading mt-3 text-2xl font-semibold">
            {current?.version.title ?? "Nova pergunta"}
          </h3>
          <p className="mt-2 text-sm text-emerald-100">
            {current?.version.description ??
              "Configure o enunciado no painel ao lado."}
          </p>
          <div className="mt-7 grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <span
                key={value}
                className="grid aspect-square place-items-center rounded-2xl bg-white/10 font-bold"
              >
                {value}
              </span>
            ))}
          </div>
        </div>
      </section>
      <aside className="border-border-light rounded-3xl border bg-white p-5">
        <h2 className="font-heading text-brand-dark text-xl font-semibold">
          Propriedades
        </h2>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-bold">
            Enunciado
            <textarea
              value={current?.version.title ?? ""}
              onChange={(e) => patchCurrent({ title: e.target.value })}
              className="border-border-light mt-2 min-h-24 w-full rounded-xl border p-3 font-normal"
            />
          </label>
          <label className="block text-sm font-bold">
            Descrição
            <input
              value={current?.version.description ?? ""}
              onChange={(e) => patchCurrent({ description: e.target.value })}
              className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
            />
          </label>
          <label className="block text-sm font-bold">
            Categoria
            <select
              value={current?.version.category ?? "reception"}
              onChange={(e) => patchCurrent({ category: e.target.value })}
              className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
            >
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold">
            Tipo
            <select
              value={current?.version.question_type ?? "STAR_5"}
              onChange={(e) => patchCurrent({ question_type: e.target.value })}
              className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
            >
              {types.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="flex gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={current?.version.required ?? true}
              onChange={(e) => patchCurrent({ required: e.target.checked })}
            />
            Obrigatória
          </label>
          <label className="flex gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={current?.version.allow_na ?? false}
              onChange={(e) => patchCurrent({ allow_na: e.target.checked })}
            />
            Permitir “não se aplica”
          </label>
          {current &&
          ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "YES_NO"].includes(
            current.version.question_type,
          ) ? (
            <label className="block text-sm font-bold">
              Alternativas
              <textarea
                value={current.version.options
                  .map((option) => option.label)
                  .join("\n")}
                onChange={(event) =>
                  patchCurrent({
                    options: event.target.value
                      .split("\n")
                      .map((label) => label.trim())
                      .filter(Boolean)
                      .map((label) => ({
                        label,
                        value: label
                          .toLocaleLowerCase("pt-BR")
                          .normalize("NFD")
                          .replace(/[\u0300-\u036f]/g, "")
                          .replace(/[^a-z0-9]+/g, "_"),
                      })),
                  })
                }
                className="border-border-light mt-2 min-h-28 w-full rounded-xl border p-3 font-normal"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Uma alternativa por linha.
              </span>
            </label>
          ) : null}
          {current ? (
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold">Regra condicional</p>
              <select
                id="survey-rule-source"
                className="border-border-light mt-3 min-h-11 w-full rounded-xl border bg-white px-3 text-sm"
              >
                <option value="">Pergunta de origem</option>
                {items
                  .filter((item) => item.id !== current.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.version.title}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const source = (
                    document.getElementById(
                      "survey-rule-source",
                    ) as HTMLSelectElement
                  ).value;
                  if (source)
                    action({
                      action: "rule",
                      sourceId: source,
                      targetId: current.id,
                      operator: "LTE",
                      comparisonValue: 3,
                    });
                }}
                className="mt-2 min-h-10 w-full rounded-full bg-white text-xs font-bold text-emerald-800"
              >
                Exibir quando nota ≤ 3
              </button>
            </div>
          ) : null}
          <button
            disabled={busy}
            onClick={() =>
              action({
                action: "save",
                id: current?.id,
                version: current?.version ?? {
                  title: "Nova pergunta",
                  category: "EXPERIENCIA_GERAL",
                  question_type: "STAR_5",
                  required: true,
                  allow_na: false,
                  options: [],
                },
              })
            }
            className="bg-brand flex min-h-11 w-full items-center justify-center gap-2 rounded-full font-bold text-white disabled:opacity-50"
          >
            <Save size={17} />
            Salvar nova versão
          </button>
          {current ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() =>
                  action({ action: "reorder", id: current.id, direction: "up" })
                }
                className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-slate-100 text-sm font-bold"
              >
                <ArrowUp size={16} /> Subir
              </button>
              <button
                onClick={() =>
                  action({
                    action: "reorder",
                    id: current.id,
                    direction: "down",
                  })
                }
                className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-slate-100 text-sm font-bold"
              >
                <ArrowDown size={16} /> Descer
              </button>
              <button
                onClick={() => action({ action: "duplicate", id: current.id })}
                className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-slate-100 text-sm font-bold"
              >
                <Copy size={16} />
                Duplicar
              </button>
              <button
                onClick={() => action({ action: "delete", id: current.id })}
                className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-rose-50 text-sm font-bold text-rose-700"
              >
                <Trash2 size={16} />
                Excluir
              </button>
              <button
                onClick={() =>
                  action({
                    action: "toggle",
                    id: current.id,
                    active: !current.active,
                  })
                }
                className="col-span-2 min-h-11 rounded-full bg-amber-50 text-sm font-bold text-amber-800"
              >
                {current.active ? "Desativar" : "Ativar"}
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
