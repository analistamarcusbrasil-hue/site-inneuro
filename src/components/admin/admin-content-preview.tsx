"use client";

import { useState } from "react";
import { Monitor, Smartphone, Tablet, X } from "lucide-react";
import type { CmsModuleFormConfig } from "@/lib/cms/modules";
import { SimpleRichText } from "@/components/content/simple-rich-text";

type PreviewValue = string | boolean;
type MediaOption = { id: string; label: string; url: string };

const devices = {
  desktop: { label: "Desktop", width: "100%", icon: Monitor },
  tablet: { label: "Tablet", width: "768px", icon: Tablet },
  mobile: { label: "Celular", width: "390px", icon: Smartphone },
} as const;

function text(
  values: Record<string, PreviewValue>,
  name: string,
  fallback: string,
) {
  return String(values[name] || fallback);
}

export function AdminContentPreview({
  module,
  values,
  selectedMedia,
  media,
  onClose,
}: {
  module: CmsModuleFormConfig;
  values: Record<string, PreviewValue>;
  selectedMedia: Record<string, string>;
  media: MediaOption[];
  onClose: () => void;
}) {
  const [device, setDevice] = useState<keyof typeof devices>("desktop");
  const imageId =
    selectedMedia.desktop_media_id ||
    selectedMedia.cover_media_id ||
    selectedMedia.logo_media_id ||
    selectedMedia.thumbnail_media_id;
  const image = media.find((item) => item.id === imageId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6"
    >
      <div className="bg-surface mx-auto min-h-full max-w-[1500px] rounded-3xl shadow-2xl">
        <header className="border-border-light sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-3xl border-b bg-white p-4 sm:px-6">
          <div>
            <h2
              id="preview-title"
              className="font-heading text-lg font-semibold"
            >
              Veja como ficará no site
            </h2>
            <p className="text-muted text-xs">
              Esta prévia ainda não publica nenhuma alteração.
            </p>
          </div>
          <div className="flex items-center gap-1">
            {Object.entries(devices).map(([key, item]) => {
              const Icon = item.icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDevice(key as keyof typeof devices)}
                  aria-pressed={device === key}
                  className={`grid min-h-11 grid-cols-[auto_1fr] items-center gap-2 rounded-full px-3 text-xs font-bold ${device === key ? "bg-brand text-white" : "text-muted hover:bg-mint"}`}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={onClose}
              className="text-brand-dark hover:bg-mint ml-2 grid size-11 place-items-center rounded-full"
            >
              <X aria-hidden="true" />
              <span className="sr-only">Fechar prévia</span>
            </button>
          </div>
        </header>

        <div className="overflow-x-auto p-3 sm:p-6">
          <div
            className="mx-auto min-h-[680px] overflow-hidden rounded-2xl bg-white shadow-[0_15px_60px_rgba(3,37,27,.12)] transition-[width]"
            style={{ width: devices[device].width, maxWidth: "100%" }}
          >
            <div className="bg-brand-dark flex min-h-16 items-center px-5 text-sm font-bold tracking-[.15em] text-white">
              INNEURO
            </div>
            <PreviewBody
              module={module}
              values={values}
              imageUrl={image?.url}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewBody({
  module,
  values,
  imageUrl,
}: {
  module: CmsModuleFormConfig;
  values: Record<string, PreviewValue>;
  imageUrl?: string;
}) {
  if (module.key === "carrossel") {
    return (
      <section className="bg-brand-dark relative aspect-[12/5] min-h-[420px] overflow-hidden text-white">
        {imageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
        ) : null}
        <div className="from-brand-dark via-brand-dark/45 absolute inset-0 bg-gradient-to-t to-transparent" />
        <div className="absolute inset-x-0 bottom-0 max-w-3xl p-7 sm:p-12">
          <p className="text-tech text-xs font-bold tracking-widest uppercase">
            {text(values, "category", "Categoria")}
          </p>
          <h1 className="font-heading mt-3 text-3xl font-semibold sm:text-5xl">
            {text(values, "title", "Título principal")}
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-white/80">
            {text(values, "description", "O texto de apoio aparecerá aqui.")}
          </p>
          {values.cta_label ? (
            <span className="bg-tech text-brand-dark mt-6 inline-flex rounded-full px-5 py-3 text-sm font-bold">
              {String(values.cta_label)}
            </span>
          ) : null}
        </div>
      </section>
    );
  }

  if (module.key === "noticias") {
    return (
      <article>
        <header className="bg-brand-dark px-6 py-14 text-white sm:px-12 sm:py-20">
          <p className="text-tech text-xs font-bold tracking-widest uppercase">
            {text(values, "category", "Notícia")}
          </p>
          <h1 className="font-heading mt-3 max-w-4xl text-3xl font-semibold sm:text-5xl">
            {text(values, "title", "Título da notícia")}
          </h1>
          <p className="mt-5 max-w-3xl text-white/75">
            {text(values, "summary", "O resumo da notícia aparecerá aqui.")}
          </p>
        </header>
        <div className="mx-auto max-w-4xl px-6 py-10 sm:px-12">
          {imageUrl ? (
            <div
              className="mb-10 aspect-[3/2] rounded-3xl bg-cover bg-center"
              style={{ backgroundImage: `url(${imageUrl})` }}
            />
          ) : null}
          <div className="text-ink text-base leading-8 sm:text-lg">
            <SimpleRichText
              content={text(
                values,
                "content_text",
                "O texto completo da notícia aparecerá aqui.",
              )}
            />
          </div>
        </div>
      </article>
    );
  }

  if (module.key === "convenios") {
    return (
      <section className="bg-surface px-5 py-14 sm:px-10">
        <h1 className="font-heading text-brand-dark text-3xl font-semibold">
          Convênios e parcerias
        </h1>
        <div className="border-border-light mt-8 flex min-h-44 max-w-sm flex-col items-center justify-center rounded-3xl border bg-white p-6 text-center">
          {imageUrl ? (
            <div
              className="h-20 w-full bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${imageUrl})` }}
            />
          ) : (
            <strong>{text(values, "name", "Nome do convênio")}</strong>
          )}
          <p className="text-muted mt-4 text-xs font-bold uppercase">
            {values.kind === "parceria" ? "Parceria" : "Convênio"}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-surface px-5 py-14 sm:px-10">
      <div className="border-border-light max-w-xl overflow-hidden rounded-3xl border bg-white">
        {imageUrl ? (
          <div
            className="aspect-[3/2] bg-cover bg-center"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
        ) : null}
        <div className="p-6">
          <p className="text-brand text-xs font-bold uppercase">
            {text(
              values,
              module.key === "redes-sociais" ? "network" : "modality",
              module.label,
            )}
          </p>
          <h1 className="font-heading mt-2 text-2xl font-semibold">
            {text(
              values,
              module.key === "redes-sociais" ? "title" : "name",
              `Novo ${module.singular}`,
            )}
          </h1>
          <p className="text-muted mt-4 leading-relaxed">
            {text(
              values,
              module.key === "redes-sociais" ? "callout" : "description",
              "O texto aparecerá aqui.",
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
