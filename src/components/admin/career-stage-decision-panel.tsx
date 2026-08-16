"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, X, XCircle } from "lucide-react";
import {
  selectionStageApprovalLabels,
  selectionStageLabels,
  selectionStageNext,
  selectionStageNumbers,
  type SelectionStage,
} from "@/lib/careers/selection-processes";

function DecisionSubmitButton({
  decision,
}: {
  decision: "approve" | "reject";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        decision === "approve"
          ? "bg-brand hover:bg-brand-dark min-h-12 rounded-full px-6 font-bold text-white disabled:cursor-wait disabled:opacity-60"
          : "bg-error hover:bg-error/90 min-h-12 rounded-full px-6 font-bold text-white disabled:cursor-wait disabled:opacity-60"
      }
    >
      {pending
        ? "REGISTRANDO DECISÃO..."
        : decision === "approve"
          ? "CONFIRMAR APROVAÇÃO"
          : "CONFIRMAR REPROVAÇÃO"}
    </button>
  );
}

export function CareerStageDecisionPanel({
  action,
  applicationId,
  jobId,
  currentStage,
}: {
  action: (formData: FormData) => void | Promise<void>;
  applicationId: string;
  jobId: string;
  currentStage: SelectionStage;
}) {
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const nextStage = selectionStageNext[currentStage];
  const currentNumber = selectionStageNumbers[currentStage];
  if (!nextStage || !currentNumber) return null;
  const nextNumber = selectionStageNumbers[nextStage];

  return (
    <section className="border-brand/20 bg-mint/45 mt-6 rounded-3xl border p-5 shadow-sm sm:p-7">
      <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
        Decisão desta etapa
      </p>
      <h2 className="font-heading text-brand-dark mt-2 text-2xl font-semibold">
        Registre a decisão humana do RH
      </h2>
      <p className="text-muted mt-2 max-w-3xl text-sm leading-relaxed">
        Nenhuma decisão é automática. A ação ficará registrada com responsável,
        data, etapa e histórico da candidatura.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setDecision("approve")}
          className="bg-brand hover:bg-brand-dark focus-visible:ring-tech flex min-h-16 items-center justify-center gap-3 rounded-2xl px-6 text-center text-sm font-bold text-white shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:text-base"
        >
          <CheckCircle2 aria-hidden="true" />
          {selectionStageApprovalLabels[currentStage]}
        </button>
        <button
          type="button"
          onClick={() => setDecision("reject")}
          className="border-error/45 bg-error/5 text-error hover:bg-error/10 focus-visible:ring-error flex min-h-16 items-center justify-center gap-3 rounded-2xl border-2 px-6 text-center text-sm font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:text-base"
        >
          <XCircle aria-hidden="true" />
          REPROVAR CANDIDATO
        </button>
      </div>

      {decision ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="career-decision-title"
          className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4"
        >
          <section className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-brand text-xs font-bold tracking-widest uppercase">
                  Confirmação necessária
                </p>
                <h2
                  id="career-decision-title"
                  className="font-heading text-brand-dark mt-2 text-2xl font-semibold"
                >
                  {decision === "approve"
                    ? "Aprovar este candidato para a próxima etapa?"
                    : "Confirma o encerramento da participação deste candidato nesta vaga?"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDecision(null)}
                className="grid size-11 shrink-0 place-items-center rounded-full border"
                aria-label="Cancelar e fechar"
              >
                <X aria-hidden="true" />
              </button>
            </div>

            {decision === "approve" ? (
              <dl className="bg-surface mt-6 grid gap-4 rounded-2xl p-5 sm:grid-cols-2">
                <div>
                  <dt className="text-muted text-xs font-bold uppercase">
                    Etapa atual
                  </dt>
                  <dd className="text-brand-dark mt-1 font-bold">
                    {currentNumber} de 4 — {selectionStageLabels[currentStage]}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted text-xs font-bold uppercase">
                    Próxima
                  </dt>
                  <dd className="text-brand-dark mt-1 font-bold">
                    {nextStage === "hired"
                      ? "Resultado final — Contratado"
                      : `${nextNumber} de 4 — ${selectionStageLabels[nextStage]}`}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="bg-error/5 text-error mt-6 rounded-2xl p-4 text-sm">
                A reprovação encerra esta candidatura. Uma eventual correção
                administrativa exige fluxo especial e auditoria.
              </p>
            )}

            <form action={action} className="mt-6 grid gap-5">
              <input
                type="hidden"
                name="application_id"
                value={applicationId}
              />
              <input type="hidden" name="job_id" value={jobId} />
              <input type="hidden" name="expected_stage" value={currentStage} />
              <input
                type="hidden"
                name="decision"
                value={decision === "approve" ? "approve" : "not_approve"}
              />
              {decision === "reject" ? (
                <label className="text-ink grid gap-2 text-sm font-bold">
                  Motivo interno (opcional)
                  <textarea
                    name="internal_note"
                    maxLength={4000}
                    rows={4}
                    className="border-border-light rounded-xl border p-3 font-normal"
                    placeholder="Visível somente para RH e auditoria. Não será enviado ao candidato."
                  />
                  <span className="text-muted text-xs font-normal">
                    Esta observação nunca será incluída no e-mail do candidato.
                  </span>
                </label>
              ) : (
                <input type="hidden" name="internal_note" value="" />
              )}
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDecision(null)}
                  className="border-brand/30 text-brand-dark min-h-12 rounded-full border px-6 font-bold"
                >
                  CANCELAR
                </button>
                <DecisionSubmitButton decision={decision} />
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
