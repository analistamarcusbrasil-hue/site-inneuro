"use client";

import { useState } from "react";
import { sendCareerApplicationCommunicationAction } from "@/app/admin/(protected)/rh/vagas/[id]/candidaturas/actions";
import {
  adminCareerCommunicationTemplates,
  careerCommunicationTemplateLabels,
  type AdminCareerCommunicationTemplate,
} from "@/lib/careers/communications/types";

const fieldClass =
  "border-border-light mt-2 min-h-11 w-full rounded-xl border bg-white px-4 font-normal";

export function CareerCommunicationForm({
  applicationId,
  returnPath,
  idempotencyKey,
}: {
  applicationId: string;
  returnPath: string;
  idempotencyKey: string;
}) {
  const [template, setTemplate] =
    useState<AdminCareerCommunicationTemplate>("UNDER_REVIEW");
  const interview = ["INTERVIEW_INVITE", "INTERVIEW_REMINDER"].includes(
    template,
  );

  return (
    <form
      action={sendCareerApplicationCommunicationAction}
      className="grid gap-4"
    >
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <label className="text-ink text-sm font-bold">
        Tipo de comunicação
        <select
          name="template"
          value={template}
          onChange={(event) =>
            setTemplate(event.target.value as AdminCareerCommunicationTemplate)
          }
          className={fieldClass}
        >
          {adminCareerCommunicationTemplates.map((item) => (
            <option key={item} value={item}>
              {careerCommunicationTemplateLabels[item]}
            </option>
          ))}
        </select>
      </label>

      {template === "NEXT_STAGE" ? (
        <>
          <label className="text-ink text-sm font-bold">
            Próxima etapa
            <input
              name="next_stage"
              required
              maxLength={160}
              className={fieldClass}
            />
          </label>
          <label className="text-ink text-sm font-bold">
            Data, quando aplicável
            <input name="event_date" maxLength={80} className={fieldClass} />
          </label>
        </>
      ) : null}

      {interview ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-ink text-sm font-bold">
            Data da entrevista
            <input
              name="interview_date"
              type="date"
              required
              className={fieldClass}
            />
          </label>
          <label className="text-ink text-sm font-bold">
            Horário
            <input
              name="interview_time"
              type="time"
              required
              className={fieldClass}
            />
          </label>
          <label className="text-ink text-sm font-bold">
            Local
            <input
              name="location"
              required
              maxLength={240}
              className={fieldClass}
            />
          </label>
        </div>
      ) : null}

      {template === "CUSTOM_MESSAGE" ? (
        <>
          <label className="text-ink text-sm font-bold">
            Assunto
            <input
              name="subject"
              required
              maxLength={160}
              className={fieldClass}
            />
          </label>
          <label className="text-ink text-sm font-bold">
            Texto
            <textarea
              name="message"
              required
              maxLength={4000}
              rows={6}
              className={`${fieldClass} py-3`}
            />
          </label>
        </>
      ) : null}

      {template === "NEXT_STAGE" || interview ? (
        <label className="text-ink text-sm font-bold">
          Orientações
          <textarea
            name="instructions"
            maxLength={2000}
            rows={4}
            className={`${fieldClass} py-3`}
          />
        </label>
      ) : null}

      <p className="text-muted text-xs">
        O destinatário é obtido da candidatura. Não é possível informar HTML ou
        escolher outro e-mail.
      </p>
      <button className="bg-brand hover:bg-brand-dark min-h-11 rounded-full px-5 text-sm font-bold text-white">
        Enviar comunicação
      </button>
    </form>
  );
}
