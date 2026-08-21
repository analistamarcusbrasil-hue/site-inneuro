"use client";

import {
  CheckCircle2,
  FileText,
  ImageIcon,
  RefreshCw,
  UploadCloud,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { formatFileSize, type DocumentKind } from "@/lib/scheduling/shared";

type UploadStatus = "idle" | "uploading" | "complete";

type DocumentUploadFieldProps = {
  kind: DocumentKind;
  label: string;
  description: string;
  required: boolean;
  file: File | null;
  error?: string;
  progress: number;
  status: UploadStatus;
  onChange: (file: File | null) => void;
};

function LocalImagePreview({ file, label }: { file: File; label: string }) {
  const [previewUrl] = useState(() => URL.createObjectURL(file));

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  return (
    <Image
      src={previewUrl}
      alt={`Prévia de ${label.toLowerCase()}`}
      fill
      unoptimized
      className="object-cover"
    />
  );
}

export function DocumentUploadField({
  kind,
  label,
  description,
  required,
  file,
  error,
  progress,
  status,
  onChange,
}: DocumentUploadFieldProps) {
  const inputId = useId();
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-ink text-sm font-semibold">
          {label}{" "}
          {required ? (
            <span aria-hidden="true" className="text-error">
              *
            </span>
          ) : null}
        </label>
        <span className="text-muted text-[0.68rem]">Até 15 MB</span>
      </div>
      <p id={descriptionId} className="text-muted mt-1 text-xs leading-relaxed">
        {description}
      </p>

      <input
        id={inputId}
        name={kind}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        required={required}
        className="peer sr-only"
        aria-invalid={Boolean(error)}
        aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`}
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />

      {file ? (
        <div
          className={`mt-3 overflow-hidden rounded-2xl border bg-white ${
            error ? "border-error" : "border-border-light"
          }`}
        >
          <div className="flex min-w-0 items-center gap-3 p-3">
            <div className="bg-mint relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl">
              {file.type.startsWith("image/") ? (
                <LocalImagePreview
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  file={file}
                  label={label}
                />
              ) : file.type === "application/pdf" ? (
                <FileText aria-hidden="true" className="text-brand" size={24} />
              ) : (
                <ImageIcon
                  aria-hidden="true"
                  className="text-brand"
                  size={24}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-ink truncate text-sm font-semibold">
                {file.name}
              </p>
              <p className="text-muted mt-1 text-xs">
                {formatFileSize(file.size)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <label
                htmlFor={inputId}
                aria-label={`Substituir ${label.toLowerCase()}`}
                className="text-brand-dark peer-focus-visible:ring-tech hover:bg-mint grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full peer-focus-visible:ring-2"
              >
                <RefreshCw aria-hidden="true" size={17} />
              </label>
              <button
                type="button"
                aria-label={`Remover ${label.toLowerCase()}`}
                onClick={() => onChange(null)}
                className="text-muted hover:bg-error/10 hover:text-error focus-visible:ring-tech grid min-h-11 min-w-11 place-items-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
          </div>

          {status === "uploading" ? (
            <div
              className="border-border-light border-t px-3 py-2"
              aria-live="polite"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Enviando documento…</span>
                <span className="text-brand font-semibold">{progress}%</span>
              </div>
              <div className="bg-border-light mt-2 h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-tech h-full rounded-full transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}

          {status === "complete" ? (
            <p className="border-border-light text-brand flex items-center gap-2 border-t px-3 py-2 text-xs font-semibold">
              <CheckCircle2 aria-hidden="true" size={15} /> Documento enviado
              com segurança.
            </p>
          ) : null}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`peer-focus-visible:ring-tech mt-3 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-5 text-center transition-colors peer-focus-visible:ring-2 ${
            error
              ? "border-error bg-error/5"
              : "border-brand/25 hover:border-brand/50 hover:bg-mint/40 bg-white"
          }`}
        >
          <UploadCloud aria-hidden="true" className="text-brand" size={24} />
          <span className="text-ink mt-2 text-sm font-semibold">
            Escolher arquivo ou tirar foto
          </span>
          <span className="text-muted mt-1 text-xs">PDF, JPG, PNG ou WebP</span>
        </label>
      )}

      {error ? (
        <p id={errorId} role="alert" className="text-error mt-2 text-sm">
          <span aria-hidden="true">Erro: </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
