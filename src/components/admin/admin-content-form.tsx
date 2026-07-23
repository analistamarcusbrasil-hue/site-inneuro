"use client";

import { useEffect, useState } from "react";
import type { CmsModuleFormConfig } from "@/lib/cms/modules";
import { saveContentAction } from "@/app/admin/actions";

type MediaOption = { id: string; label: string; url: string };

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
  const [dirty, setDirty] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Record<string, string>>(
    Object.fromEntries(
      [
        "desktop_media_id",
        "mobile_media_id",
        "cover_media_id",
        "logo_media_id",
        "thumbnail_media_id",
      ].map((name) => [name, String(initial[name] ?? "")]),
    ),
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const mediaFields =
    module.key === "carrossel"
      ? [
          { name: "desktop_media_id", label: "Imagem desktop" },
          { name: "mobile_media_id", label: "Imagem mobile" },
        ]
      : module.key === "noticias"
        ? [{ name: "cover_media_id", label: "Imagem de capa" }]
        : module.key === "convenios"
          ? [{ name: "logo_media_id", label: "Logo" }]
          : module.key === "redes-sociais"
            ? [{ name: "thumbnail_media_id", label: "Miniatura" }]
            : [{ name: "cover_media_id", label: "Foto principal" }];

  return (
    <form
      action={saveContentAction}
      onChange={() => setDirty(true)}
      className="border-border-light rounded-3xl border bg-white p-5 sm:p-7"
    >
      <input type="hidden" name="module" value={module.key} />
      <input type="hidden" name="id" value={String(initial.id ?? "")} />
      <div className="grid gap-5 md:grid-cols-2">
        {module.fields.map((field) => {
          const value = initial[field.name];
          const base =
            "border-border-light mt-2 min-h-12 w-full rounded-xl border bg-white px-4 font-normal";
          if (field.type === "checkbox")
            return (
              <label
                key={field.name}
                className="border-border-light flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-bold"
              >
                <input
                  name={field.name}
                  type="checkbox"
                  defaultChecked={Boolean(value)}
                  className="size-5 accent-[#087a4d]"
                />
                {field.label}
              </label>
            );
          if (field.type === "textarea")
            return (
              <label
                key={field.name}
                className="text-sm font-bold md:col-span-2"
              >
                {field.label}
                <textarea
                  name={field.name}
                  required={field.required}
                  defaultValue={String(
                    field.name === "content_text" &&
                      Array.isArray(initial.content)
                      ? ((initial.content[0] as { text?: string })?.text ?? "")
                      : (value ?? ""),
                  )}
                  rows={5}
                  className={`${base} py-3`}
                />
              </label>
            );
          if (field.type === "select")
            return (
              <label key={field.name} className="text-sm font-bold">
                {field.label}
                <select
                  name={field.name}
                  defaultValue={String(
                    value ?? field.options?.[0]?.value ?? "",
                  )}
                  className={base}
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          return (
            <label key={field.name} className="text-sm font-bold">
              {field.label}
              <input
                name={field.name}
                type={field.type ?? "text"}
                required={field.required}
                defaultValue={String(value ?? "")}
                className={base}
              />
            </label>
          );
        })}
        {mediaFields.map((field) => (
          <label key={field.name} className="text-sm font-bold">
            {field.label}
            <select
              name={field.name}
              defaultValue={String(initial[field.name] ?? "")}
              onChange={(event) =>
                setSelectedMedia((current) => ({
                  ...current,
                  [field.name]: event.target.value,
                }))
              }
              className="border-border-light mt-2 min-h-12 w-full rounded-xl border bg-white px-4 font-normal"
            >
              <option value="">Nenhuma mídia selecionada</option>
              {media.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {module.key === "carrossel" && media.length ? (
        <div className="bg-surface mt-6 grid gap-4 rounded-2xl p-4 sm:grid-cols-[1fr_11rem]">
          {[
            ["desktop_media_id", "Desktop · 16:9", "aspect-video"],
            ["mobile_media_id", "Celular · 4:3", "aspect-[4/3]"],
          ].map(([name, label, ratio]) => {
            const item = media.find(
              (option) => option.id === selectedMedia[name],
            );
            return (
              <figure key={name}>
                <div
                  role="img"
                  aria-label={item ? `Prévia de ${item.label}` : label}
                  className={`${ratio} bg-brand-dark rounded-xl bg-contain bg-center bg-no-repeat`}
                  style={
                    item ? { backgroundImage: `url(${item.url})` } : undefined
                  }
                />
                <figcaption className="text-muted mt-2 text-xs font-bold">
                  {label}
                </figcaption>
              </figure>
            );
          })}
        </div>
      ) : null}
      {module.key === "equipamentos" && media.length ? (
        <label className="mt-5 block text-sm font-bold">
          Galeria
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
        <p role="status" className="text-warning mt-5 text-sm font-bold">
          Existem alterações ainda não salvas.
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          name="intent"
          value="draft"
          onClick={() => setDirty(false)}
          className="border-brand text-brand min-h-11 rounded-full border px-5 text-sm font-bold"
        >
          Salvar rascunho
        </button>
        {canPublish ? (
          <button
            name="intent"
            value="publish"
            onClick={() => setDirty(false)}
            className="bg-brand min-h-11 rounded-full px-5 text-sm font-bold text-white"
          >
            Publicar
          </button>
        ) : null}
        {canPublish &&
        module.fields.some((field) => field.name === "publish_at") ? (
          <button
            name="intent"
            value="schedule"
            onClick={() => setDirty(false)}
            className="bg-brand-dark min-h-11 rounded-full px-5 text-sm font-bold text-white"
          >
            Agendar
          </button>
        ) : null}
      </div>
    </form>
  );
}
