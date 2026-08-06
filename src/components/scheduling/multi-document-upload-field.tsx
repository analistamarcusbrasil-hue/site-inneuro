"use client";

import { CheckCircle2, FileText, UploadCloud, X } from "lucide-react";
import { useId } from "react";
import { formatFileSize, type DocumentKind } from "@/lib/scheduling/shared";

export type SelectedSchedulingFile = {
  id: string;
  kind: DocumentKind;
  file: File;
};

type Props = {
  kind: DocumentKind;
  label: string;
  description: string;
  required?: boolean;
  multiple?: boolean;
  files: SelectedSchedulingFile[];
  error?: string;
  progress: Record<string, number>;
  disabled?: boolean;
  onAdd: (kind: DocumentKind, files: File[]) => void;
  onRemove: (id: string) => void;
};

export function MultiDocumentUploadField({
  kind,
  label,
  description,
  required = false,
  multiple = false,
  files,
  error,
  progress,
  disabled,
  onAdd,
  onRemove,
}: Props) {
  const inputId = useId();
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-ink text-sm font-semibold">
          {label}{" "}
          {required ? (
            <span className="text-error" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        <span className="text-muted text-[.68rem]">Até 10 MB por arquivo</span>
      </div>
      <p id={descriptionId} className="text-muted mt-1 text-xs leading-relaxed">
        {description}
      </p>
      <input
        id={inputId}
        type="file"
        multiple={multiple}
        disabled={disabled}
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="peer sr-only"
        aria-invalid={Boolean(error)}
        aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`}
        onChange={(event) => {
          onAdd(kind, Array.from(event.target.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      <label
        htmlFor={inputId}
        className={`peer-focus-visible:ring-tech mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-4 text-center transition-colors peer-focus-visible:ring-2 ${error ? "border-error bg-error/5" : "border-brand/25 hover:border-brand/50 hover:bg-mint/40 bg-white"}`}
      >
        <UploadCloud aria-hidden="true" className="text-brand" size={22} />
        <span className="text-ink mt-2 text-sm font-semibold">
          {multiple
            ? "Escolher arquivos ou tirar fotos"
            : "Escolher arquivo ou tirar foto"}
        </span>
        <span className="text-muted mt-1 text-xs">PDF, JPG, PNG ou WebP</span>
      </label>
      {files.length ? (
        <ul
          className="mt-3 space-y-2"
          aria-label={`Arquivos de ${label.toLowerCase()}`}
        >
          {files.map((item) => {
            const currentProgress = progress[item.id];
            return (
              <li
                key={item.id}
                className="border-border-light flex min-w-0 items-center gap-3 rounded-2xl border bg-white p-3"
              >
                <span className="bg-mint text-brand grid h-10 w-10 shrink-0 place-items-center rounded-xl">
                  <FileText aria-hidden="true" size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink block truncate text-sm font-semibold">
                    {item.file.name}
                  </span>
                  <span className="text-muted mt-0.5 block text-xs">
                    {currentProgress === 100 ? (
                      <>
                        <CheckCircle2 className="mr-1 inline" size={13} />
                        Enviado com segurança
                      </>
                    ) : currentProgress !== undefined ? (
                      `Enviando… ${currentProgress}%`
                    ) : (
                      formatFileSize(item.file.size)
                    )}
                  </span>
                  {currentProgress !== undefined && currentProgress < 100 ? (
                    <span className="bg-border-light mt-1.5 block h-1 overflow-hidden rounded-full">
                      <span
                        className="bg-tech block h-full"
                        style={{ width: `${currentProgress}%` }}
                      />
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remover ${item.file.name}`}
                  className="text-muted hover:bg-error/10 hover:text-error focus-visible:ring-tech grid h-10 w-10 shrink-0 place-items-center rounded-full focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                >
                  <X aria-hidden="true" size={17} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-error mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
