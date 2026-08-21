"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CANDIDATE_RESUME_BUCKET,
  CANDIDATE_RESUME_MAX_BYTES,
  formatFileSize,
  hasPdfMagicNumber,
  type CandidateResume,
} from "@/lib/careers/profile";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type UploadState =
  | "idle"
  | "preparing"
  | "uploading"
  | "uploaded"
  | "processing"
  | "success"
  | "error";

type CurrentResume = CandidateResume & { signedUrl: string | null };

export function CandidateResumeUpload({
  candidateId,
  currentResume,
  next,
}: {
  candidateId: string;
  currentResume: CurrentResume | null;
  next?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState("");
  const busy = !["idle", "error"].includes(state);

  function resetError(nextFile: File | null) {
    setFile(nextFile);
    setProgress(0);
    setMessage("");
    setState("idle");
  }

  async function validateFile(selected: File) {
    if (!selected.size) return "Escolha um currículo em PDF.";
    if (selected.size > CANDIDATE_RESUME_MAX_BYTES) {
      return "O currículo deve ter no máximo 10 MB.";
    }
    if (
      selected.type !== "application/pdf" ||
      !selected.name.toLowerCase().endsWith(".pdf")
    ) {
      return "Envie somente um arquivo PDF válido.";
    }
    const signature = new Uint8Array(await selected.slice(0, 5).arrayBuffer());
    return hasPdfMagicNumber(signature)
      ? null
      : "Envie somente um arquivo PDF válido.";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || !file || !supabase) return;
    busyRef.current = true;
    setMessage("");
    setProgress(0);
    setState("preparing");

    let storagePath: string | null = null;
    try {
      const validationError = await validateFile(file);
      if (validationError) throw new Error(validationError);

      storagePath = `${candidateId}/${Date.now()}-${crypto.randomUUID()}.pdf`;
      const { data: signedUpload, error: signedUploadError } =
        await supabase.storage
          .from(CANDIDATE_RESUME_BUCKET)
          .createSignedUploadUrl(storagePath);
      if (signedUploadError || !signedUpload?.signedUrl) {
        throw new Error("Não foi possível enviar o currículo.");
      }

      await new Promise<void>((resolve, reject) => {
        const upload = new XMLHttpRequest();
        upload.open("PUT", signedUpload.signedUrl);
        upload.setRequestHeader("x-upsert", "false");
        upload.upload.addEventListener("progress", (progressEvent) => {
          if (!progressEvent.lengthComputable) return;
          const percentage = Math.min(
            100,
            Math.round((progressEvent.loaded / progressEvent.total) * 100),
          );
          setProgress(percentage);
          setState(percentage === 100 ? "uploaded" : "uploading");
        });
        upload.addEventListener("load", () => {
          if (upload.status >= 200 && upload.status < 300) resolve();
          else reject(new Error("Não foi possível enviar o currículo."));
        });
        upload.addEventListener("error", () =>
          reject(new Error("Não foi possível enviar o currículo.")),
        );
        upload.addEventListener("abort", () =>
          reject(new Error("Não foi possível enviar o currículo.")),
        );
        const body = new FormData();
        body.append("cacheControl", "3600");
        body.append("", file);
        setState("uploading");
        upload.send(body);
      });

      setProgress(100);
      setState("processing");
      const response = await fetch("/api/carreiras/curriculo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath,
          originalName: file.name,
          sizeBytes: file.size,
          next,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        redirectUrl?: string;
      } | null;
      if (!response.ok || !result?.redirectUrl) {
        throw new Error("Não foi possível enviar o currículo.");
      }

      storagePath = null;
      setState("success");
      setMessage("Currículo enviado com sucesso.");
      router.push(result.redirectUrl);
      router.refresh();
    } catch (error) {
      if (storagePath) {
        await supabase.storage
          .from(CANDIDATE_RESUME_BUCKET)
          .remove([storagePath])
          .catch(() => undefined);
      }
      setState("error");
      setMessage(
        error instanceof Error && error.message.startsWith("O currículo")
          ? error.message
          : error instanceof Error && error.message.startsWith("Envie somente")
            ? error.message
            : "Não foi possível enviar o currículo.",
      );
      busyRef.current = false;
    }
  }

  return (
    <div className="border-brand/20 mt-6 rounded-2xl border bg-white p-5">
      <div>
        <p className="text-brand-dark text-sm font-bold tracking-wide uppercase">
          Currículo atual
        </p>
        {currentResume ? (
          <div className="border-border-light mt-3 rounded-2xl border p-4">
            <p className="text-ink font-bold">{currentResume.original_name}</p>
            <p className="text-muted mt-1 text-xs">
              PDF · {formatFileSize(currentResume.size_bytes)} · Atualizado em{" "}
              {new Date(currentResume.created_at).toLocaleDateString("pt-BR")}
            </p>
            {currentResume.signedUrl ? (
              <a
                className="text-brand mt-3 inline-flex min-h-10 items-center text-sm font-bold hover:underline"
                href={currentResume.signedUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir PDF
              </a>
            ) : null}
          </div>
        ) : (
          <p className="text-muted mt-3 text-sm font-bold">
            Nenhum currículo enviado
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-5">
        <input
          ref={inputRef}
          className="sr-only"
          name="resume"
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(event) => resetError(event.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="border-brand/30 text-brand-dark hover:bg-mint min-h-11 rounded-full border px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {currentResume ? "Substituir currículo" : "Escolher PDF"}
          </button>
          <button
            type="submit"
            disabled={busy || !file}
            className="bg-brand hover:bg-brand-dark min-h-11 rounded-full px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar currículo
          </button>
        </div>
        {file && !busy ? (
          <p className="text-muted mt-3 text-sm">
            Arquivo selecionado: <strong>{file.name}</strong>
          </p>
        ) : null}
        <p className="text-muted mt-3 text-xs">
          Até 10 MB. O arquivo permanece privado e acessível somente por você e
          gestores autorizados.
        </p>

        {busy ? (
          <div className="mt-5" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-sm font-bold">
              <span>
                {state === "preparing"
                  ? "Preparando envio..."
                  : state === "processing"
                    ? "Processando currículo..."
                    : state === "success"
                      ? "Currículo enviado com sucesso."
                      : state === "uploaded"
                        ? "Upload concluído."
                        : "Enviando currículo..."}
              </span>
              {!["preparing", "processing", "success"].includes(state) ? (
                <span>{progress}%</span>
              ) : null}
            </div>
            <div
              className="bg-border-light mt-3 h-3 overflow-hidden rounded-full"
              role="progressbar"
              aria-label="Progresso do envio do currículo"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="bg-brand h-full rounded-full transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
        {message ? (
          <p
            className={`mt-4 rounded-xl p-3 text-sm font-bold ${
              state === "error"
                ? "bg-error/10 text-error"
                : "bg-mint text-brand-dark"
            }`}
            role={state === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
