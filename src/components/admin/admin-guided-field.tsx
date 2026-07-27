"use client";

import { useRef } from "react";
import { Bold, Heading2, Italic, Link2, List, ListOrdered } from "lucide-react";
import type { CmsField } from "@/lib/cms/modules";

type FieldValue = string | boolean;

const formattingActions = [
  {
    label: "Negrito",
    icon: Bold,
    prefix: "**",
    suffix: "**",
    fallback: "texto",
  },
  {
    label: "Itálico",
    icon: Italic,
    prefix: "_",
    suffix: "_",
    fallback: "texto",
  },
  {
    label: "Título",
    icon: Heading2,
    prefix: "\n## ",
    suffix: "\n",
    fallback: "Título",
  },
  {
    label: "Lista",
    icon: List,
    prefix: "\n- ",
    suffix: "",
    fallback: "Item da lista",
  },
  {
    label: "Lista numerada",
    icon: ListOrdered,
    prefix: "\n1. ",
    suffix: "",
    fallback: "Item da lista",
  },
  {
    label: "Link",
    icon: Link2,
    prefix: "[",
    suffix: "](https://)",
    fallback: "texto do link",
  },
] as const;

export function AdminGuidedField({
  field,
  value,
  onChange,
}: {
  field: CmsField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputId = `field-${field.name}`;
  const helpId = `${inputId}-help`;
  const textValue = typeof value === "string" ? value : "";
  const count = textValue.length;
  const overRecommended = Boolean(
    field.recommendedMax && count > field.recommendedMax,
  );
  const base =
    "border-border-light mt-2 min-h-12 w-full rounded-xl border bg-white px-4 font-normal outline-none transition focus:border-brand";

  function insertFormatting(
    prefix: string,
    suffix = prefix,
    fallback = "texto",
  ) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textValue.slice(start, end) || fallback;
    const next = `${textValue.slice(0, start)}${prefix}${selected}${suffix}${textValue.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length,
      );
    });
  }

  function handleFormatting(event: React.MouseEvent<HTMLButtonElement>) {
    const index = Number(event.currentTarget.dataset.action);
    const action = formattingActions[index];
    if (action) insertFormatting(action.prefix, action.suffix, action.fallback);
  }

  if (field.type === "checkbox") {
    return (
      <div className="border-border-light rounded-xl border bg-white p-4">
        <label
          htmlFor={inputId}
          className="flex min-h-8 items-center gap-3 text-sm font-bold"
        >
          <input
            id={inputId}
            name={field.name}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            className="size-5 accent-[#087a4d]"
          />
          {field.label}
        </label>
        <p id={helpId} className="text-muted mt-2 text-xs leading-relaxed">
          {field.help}{" "}
          <span className="block">Onde aparece: {field.location}</span>
        </p>
      </div>
    );
  }

  return (
    <div className={field.fullWidth ? "md:col-span-2" : undefined}>
      <div className="flex items-start justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-bold">
          {field.label}
          {field.required ? <span className="text-error"> *</span> : null}
        </label>
        {field.recommendedMax ? (
          <span
            className={`shrink-0 text-xs font-bold ${overRecommended ? "text-warning" : "text-muted"}`}
            aria-live="polite"
          >
            {count}/{field.recommendedMax} recomendado
          </span>
        ) : field.maxLength && field.type !== "number" ? (
          <span className="text-muted shrink-0 text-xs">
            {count}/{field.maxLength}
          </span>
        ) : null}
      </div>

      {field.richText ? (
        <div className="border-border-light mt-2 overflow-hidden rounded-xl border bg-white">
          <div
            className="border-border-light bg-surface flex flex-wrap gap-1 border-b p-2"
            aria-label="Formatar texto"
          >
            {formattingActions.map(({ label, icon: Icon }, index) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={label}
                data-action={index}
                onClick={handleFormatting}
                className="text-brand-dark hover:bg-mint grid size-10 place-items-center rounded-lg"
              >
                <Icon size={17} aria-hidden="true" />
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            id={inputId}
            name={field.name}
            required={field.required}
            value={textValue}
            onChange={(event) => onChange(event.target.value)}
            maxLength={field.maxLength}
            rows={12}
            placeholder={field.example}
            aria-describedby={helpId}
            className="min-h-64 w-full resize-y px-4 py-3 font-normal outline-none"
          />
        </div>
      ) : field.type === "textarea" ? (
        <textarea
          id={inputId}
          name={field.name}
          required={field.required}
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
          maxLength={field.maxLength}
          rows={5}
          placeholder={field.example}
          aria-describedby={helpId}
          className={`${base} py-3`}
        />
      ) : field.type === "select" ? (
        <select
          id={inputId}
          name={field.name}
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={helpId}
          className={base}
        >
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={inputId}
          name={field.name}
          type={field.type ?? "text"}
          required={field.required}
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
          maxLength={field.maxLength}
          placeholder={field.example}
          aria-describedby={helpId}
          className={base}
        />
      )}

      <p id={helpId} className="text-muted mt-2 text-xs leading-relaxed">
        {field.help}
        {field.example ? (
          <span className="block">Exemplo: {field.example}</span>
        ) : null}
        <span className="block">Onde aparece: {field.location}</span>
        {overRecommended ? (
          <span className="text-warning mt-1 block font-bold">
            O texto está acima do tamanho recomendado e pode ficar cortado em
            telas menores.
          </span>
        ) : null}
      </p>
    </div>
  );
}
