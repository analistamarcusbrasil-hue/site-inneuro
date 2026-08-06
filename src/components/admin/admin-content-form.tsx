"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Eye, ImagePlus, Save, Send, X } from "lucide-react";
import type { CmsModuleFormConfig } from "@/lib/cms/modules";
import { saveContentAction, type SaveContentResult } from "@/app/admin/actions";
import { AdminGuidedField } from "@/components/admin/admin-guided-field";
import { AdminContentPreview } from "@/components/admin/admin-content-preview";
import { AdminMediaUploadForm } from "@/components/admin/admin-media-upload-form";

type MediaOption = { id: string; label: string; url: string };
type FieldValue = string | boolean;

function initialFieldValue(
  name: string,
  type: string | undefined,
  initial: Record<string, unknown>,
) {
  if (name === "content_text" && Array.isArray(initial.content))
    return String((initial.content[0] as { text?: string })?.text ?? "");
  if (name === "search_terms_text" && Array.isArray(initial.search_terms))
    return initial.search_terms.map(String).join("\n");
  if (name === "override_days_text" && Array.isArray(initial.override_days))
    return initial.override_days.map(String).join("\n");
  if (
    name === "override_periods_text" &&
    Array.isArray(initial.override_periods)
  )
    return initial.override_periods.map(String).join("\n");
  if (name === "documents_text" && Array.isArray(initial.documents))
    return initial.documents.map(String).join("\n");
  if (
    name === "safety_questions_text" &&
    Array.isArray(initial.safety_questions)
  )
    return initial.safety_questions.map(String).join("\n");
  if (name === "schedules_text" && Array.isArray(initial.schedules))
    return initial.schedules
      .map((item) => {
        const schedule = item as {
          label?: string;
          days?: string;
          periods?: { start?: string; end?: string }[];
        };
        const periods = (schedule.periods ?? [])
          .map((period) => `${period.start ?? ""}-${period.end ?? ""}`)
          .join("; ");
        return `${schedule.label ?? ""} | ${schedule.days ?? ""} | ${periods}`;
      })
      .join("\n");
  if (
    name === "preparation_groups_text" &&
    Array.isArray(initial.preparation_groups)
  )
    return initial.preparation_groups
      .map((item) => {
        const group = item as {
          title?: string;
          appliesTo?: string[];
          instructions?: string[];
          warning?: string;
        };
        return [
          group.title ?? "",
          (group.appliesTo ?? []).join("; "),
          (group.instructions ?? []).join("; "),
          group.warning ?? "",
        ].join(" | ");
      })
      .join("\n");
  if (type === "date" && initial[name])
    return String(initial[name]).slice(0, 10);
  if (type === "checkbox") return Boolean(initial[name]);
  return String(initial[name] ?? "");
}

const mediaFieldConfig = {
  carrossel: [
    {
      name: "desktop_media_id",
      label: "Imagem principal",
      recommendation: "Banner: 1920 × 800 px (proporção 12:5).",
    },
    {
      name: "mobile_media_id",
      label: "Imagem para celular (opcional)",
      recommendation:
        "Use a mesma imagem se o enquadramento funcionar bem em telas estreitas.",
    },
  ],
  noticias: [
    {
      name: "cover_media_id",
      label: "Imagem de capa",
      recommendation: "Card ou notícia: 1200 × 800 px (proporção 3:2).",
    },
  ],
  convenios: [
    {
      name: "logo_media_id",
      label: "Logo",
      recommendation:
        "PNG com fundo transparente. O arquivo deve ter até 2 MB.",
    },
  ],
  "redes-sociais": [
    {
      name: "thumbnail_media_id",
      label: "Miniatura",
      recommendation: "Card: 1200 × 800 px (proporção 3:2).",
    },
  ],
  equipamentos: [
    {
      name: "cover_media_id",
      label: "Foto principal",
      recommendation: "Card: 1200 × 800 px (proporção 3:2).",
    },
  ],
  exames: [
    {
      name: "cover_media_id",
      label: "Imagem do exame (opcional)",
      recommendation: "Card ou notícia: 1200 × 800 px (proporção 3:2).",
    },
  ],
  preparos: [],
} satisfies Record<
  string,
  { name: string; label: string; recommendation: string }[]
>;

export function AdminContentForm({
  module,
  initial = {},
  media = [],
  canPublish,
}: {
  module: CmsModuleFormConfig;
  initial?: Record<string, unknown>;
  media?: MediaOption[];
  canPublish: boolean;
}) {
  const router = useRouter();
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        module.fields.map((field) => [
          field.name,
          initialFieldValue(field.name, field.type, initial),
        ]),
      ) as Record<string, FieldValue>,
    [initial, module.fields],
  );
  const [values, setValues] = useState(initialValues);
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savingIntent, setSavingIntent] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<SaveContentResult | null>(null);
  const submittingRef = useRef(false);
  const [selectedMedia, setSelectedMedia] = useState<Record<string, string>>(
    Object.fromEntries(
      mediaFieldConfig[module.key].map((field) => [
        field.name,
        String(initial[field.name] ?? ""),
      ]),
    ),
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function updateValue(name: string, value: FieldValue) {
    setValues((current) => ({ ...current, [name]: value }));
    setDirty(true);
  }

  function changedLabels() {
    const labels = module.fields
      .filter((field) => values[field.name] !== initialValues[field.name])
      .map((field) => field.label);
    const mediaChanged = mediaFieldConfig[module.key].some(
      (field) =>
        selectedMedia[field.name] !== String(initial[field.name] ?? ""),
    );
    if (mediaChanged) labels.push("Imagem");
    return labels;
  }

  function confirmSubmission(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const intent = submitter?.value ?? "draft";
    if (intent === "publish" || intent === "schedule") {
      const changes = changedLabels();
      const message = [
        intent === "schedule"
          ? "Confirmar o agendamento desta publicação?"
          : "Publicar no site agora?",
        "",
        changes.length
          ? `Alterações: ${changes.join(", ")}.`
          : "Nenhuma alteração foi detectada nos campos.",
        intent === "schedule"
          ? "O conteúdo ficará visível automaticamente na data escolhida."
          : "O conteúdo ficará visível para o público após a confirmação.",
      ].join("\n");
      if (!window.confirm(message)) {
        event.preventDefault();
        return;
      }
    }
  }

  async function submitContent(formData: FormData) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const intent = String(formData.get("intent") || "draft");
    setSavingIntent(intent);
    setSaveResult(null);
    try {
      const result = await saveContentAction(formData);
      if (result.ok) {
        setDirty(false);
        setSaveResult(result);
        router.replace(`/admin/${module.key}?success=saved`);
        router.refresh();
      } else {
        setSaveResult(result);
      }
    } catch {
      setSaveResult({
        ok: false,
        code: "save",
        message:
          "A conexão foi interrompida durante o salvamento. Tente novamente.",
      });
    } finally {
      submittingRef.current = false;
      setSavingIntent(null);
    }
  }

  return (
    <>
      <form
        action={submitContent}
        onSubmit={confirmSubmission}
        className="border-border-light rounded-3xl border bg-white p-5 sm:p-7"
      >
        <input type="hidden" name="module" value={module.key} />
        <input type="hidden" name="id" value={String(initial.id ?? "")} />

        <div className="bg-mint/60 border-brand/10 mb-7 rounded-2xl border p-4 text-sm leading-relaxed">
          <strong className="text-brand-dark">Como preencher:</strong> os campos
          com * são obrigatórios. Salve sem publicar se quiser terminar depois e
          use a visualização antes de colocar o conteúdo no site.
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {module.fields.map((field) => (
            <AdminGuidedField
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={(value) => updateValue(field.name, value)}
            />
          ))}

          {mediaFieldConfig[module.key].map((field) => (
            <div key={field.name}>
              <label
                htmlFor={`media-${field.name}`}
                className="text-sm font-bold"
              >
                {field.label}
              </label>
              <select
                id={`media-${field.name}`}
                name={field.name}
                value={selectedMedia[field.name] ?? ""}
                onChange={(event) => {
                  setSelectedMedia((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }));
                  setDirty(true);
                }}
                className="border-border-light mt-2 min-h-12 w-full rounded-xl border bg-white px-4 font-normal"
              >
                <option value="">Escolha uma imagem</option>
                {media.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="text-muted mt-2 text-xs leading-relaxed">
                {field.recommendation}
              </p>
              <Link
                href="/admin/midias"
                className="text-brand mt-2 inline-flex min-h-9 items-center gap-2 text-xs font-bold"
              >
                <ImagePlus size={15} aria-hidden="true" /> Enviar uma nova
                imagem
              </Link>
            </div>
          ))}
        </div>

        {media.length && Object.values(selectedMedia).some(Boolean) ? (
          <div className="bg-surface mt-6 grid gap-4 rounded-2xl p-4 sm:grid-cols-2">
            {mediaFieldConfig[module.key].map((field) => {
              const item = media.find(
                (option) => option.id === selectedMedia[field.name],
              );
              return item ? (
                <figure key={field.name}>
                  <div
                    role="img"
                    aria-label={`Prévia de ${item.label}`}
                    className={`bg-brand-dark rounded-xl bg-contain bg-center bg-no-repeat ${module.key === "carrossel" ? "aspect-[12/5]" : "aspect-[3/2]"}`}
                    style={{ backgroundImage: `url(${item.url})` }}
                  />
                  <figcaption className="text-muted mt-2 text-xs font-bold">
                    {field.label}
                  </figcaption>
                </figure>
              ) : null;
            })}
          </div>
        ) : null}

        {module.key === "equipamentos" && media.length ? (
          <label className="mt-6 block text-sm font-bold">
            Galeria de fotos
            <select
              name="gallery_media_ids"
              multiple
              defaultValue={
                Array.isArray(initial.gallery_media_ids)
                  ? initial.gallery_media_ids.map(String)
                  : []
              }
              className="border-border-light mt-2 h-36 w-full rounded-xl border bg-white px-4 py-3 font-normal"
            >
              {media.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <span className="text-muted mt-2 block text-xs font-normal">
              Use Ctrl ou Command para selecionar mais de uma imagem.
            </span>
          </label>
        ) : null}

        {dirty ? (
          <p role="status" className="text-warning mt-6 text-sm font-bold">
            Existem alterações ainda não salvas.
          </p>
        ) : null}

        {saveResult ? (
          <p
            role={saveResult.ok ? "status" : "alert"}
            className={`mt-6 rounded-xl p-4 text-sm font-bold ${
              saveResult.ok ? "bg-mint text-brand" : "bg-error/10 text-error"
            }`}
          >
            {saveResult.message}
            {!saveResult.ok && saveResult.errorId ? (
              <span className="mt-1 block text-xs font-normal">
                Código do erro: {saveResult.errorId}
              </span>
            ) : null}
          </p>
        ) : null}

        <div className="border-border-light mt-7 flex flex-wrap gap-3 border-t pt-6">
          <button
            name="intent"
            value="draft"
            disabled={savingIntent !== null}
            className="border-brand text-brand inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-bold"
          >
            <Save size={17} aria-hidden="true" />{" "}
            {savingIntent === "draft"
              ? `Salvando ${module.singular}...`
              : "Salvar sem publicar"}
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="border-brand-dark text-brand-dark inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-bold"
          >
            <Eye size={17} aria-hidden="true" /> Visualizar
          </button>
          {canPublish ? (
            <button
              name="intent"
              value="publish"
              disabled={savingIntent !== null}
              className="bg-brand inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold text-white"
            >
              <Send size={17} aria-hidden="true" />{" "}
              {savingIntent === "publish"
                ? `Publicando ${module.singular}...`
                : "Publicar no site"}
            </button>
          ) : null}
          {canPublish &&
          module.fields.some((field) => field.name === "publish_at") ? (
            <button
              name="intent"
              value="schedule"
              disabled={savingIntent !== null}
              className="bg-brand-dark inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold text-white"
            >
              <CalendarClock size={17} aria-hidden="true" />{" "}
              {savingIntent === "schedule" ? "Agendando..." : "Agendar"}
            </button>
          ) : null}
          <Link
            href={`/admin/${module.key}`}
            className="text-muted inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold"
          >
            <X size={17} aria-hidden="true" /> Cancelar
          </Link>
        </div>
      </form>

      {mediaFieldConfig[module.key].length ? (
        <details className="border-border-light mt-5 rounded-3xl border bg-white p-5">
          <summary className="text-brand cursor-pointer text-sm font-bold">
            Enviar uma nova imagem sem sair desta tela
          </summary>
          <AdminMediaUploadForm />
        </details>
      ) : null}

      {previewOpen ? (
        <AdminContentPreview
          module={module}
          values={values}
          selectedMedia={selectedMedia}
          media={media}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
