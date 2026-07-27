"use client";

import { useEffect, useState } from "react";
import { Crop, ImageUp, ZoomIn } from "lucide-react";
import { uploadMediaAction } from "@/app/admin/actions";

type MediaKind = "photo" | "thumbnail" | "logo";
type ImageInfo = {
  file: File;
  url: string;
  width: number;
  height: number;
};

const recommendations = {
  photo: {
    label: "Banner da página inicial",
    size: "1920 × 800 px",
    width: 1920,
    height: 800,
    maxBytes: 2 * 1024 * 1024,
  },
  thumbnail: {
    label: "Card, notícia ou equipamento",
    size: "1200 × 800 px",
    width: 1200,
    height: 800,
    maxBytes: 2 * 1024 * 1024,
  },
  logo: {
    label: "Logo de convênio ou parceria",
    size: "PNG com fundo transparente",
    width: 1200,
    height: 800,
    maxBytes: 2 * 1024 * 1024,
  },
} as const;

async function readImage(file: File) {
  const url = URL.createObjectURL(file);
  const dimensions = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      const image = new Image();
      image.onload = () =>
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = reject;
      image.src = url;
    },
  );
  return { file, url, ...dimensions };
}

async function cropToWebp(
  info: ImageInfo,
  kind: Exclude<MediaKind, "logo">,
  zoom: number,
  positionX: number,
  positionY: number,
) {
  const target = recommendations[kind];
  const bitmap = await createImageBitmap(info.file);
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext("2d");
  if (!context) return info.file;

  const coverScale = Math.max(
    target.width / bitmap.width,
    target.height / bitmap.height,
  );
  const scale = coverScale * zoom;
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  const x = -Math.max(0, drawWidth - target.width) * (positionX / 100);
  const y = -Math.max(0, drawHeight - target.height) * (positionY / 100);
  context.drawImage(bitmap, x, y, drawWidth, drawHeight);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.84),
  );
  if (!blob) return info.file;
  const baseName = info.file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

export function AdminMediaUploadForm() {
  const [kind, setKind] = useState<MediaKind>("photo");
  const [image, setImage] = useState<ImageInfo | null>(null);
  const [zoom, setZoom] = useState(1);
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(50);
  const [processing, setProcessing] = useState(false);

  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  const recommendation = recommendations[kind];
  const warnings: string[] = [];
  if (image) {
    if (
      kind !== "logo" &&
      (image.width < recommendation.width ||
        image.height < recommendation.height)
    )
      warnings.push(
        `A imagem é menor que ${recommendation.size} e pode perder nitidez.`,
      );
    if (image.file.size > recommendation.maxBytes)
      warnings.push(
        "O arquivo original tem mais de 2 MB. Ele será otimizado antes do envio.",
      );
    if (kind === "logo" && image.file.type !== "image/png")
      warnings.push(
        "Para preservar fundo transparente, prefira uma logo em PNG.",
      );
    if (kind !== "logo") {
      const ratio = image.width / image.height;
      const expected = recommendation.width / recommendation.height;
      if (Math.abs(ratio - expected) > 0.08)
        warnings.push(
          "A proporção é diferente da recomendada. Ajuste o enquadramento abaixo.",
        );
    }
  }

  async function submit(formData: FormData) {
    if (!image) return;
    setProcessing(true);
    try {
      const processed =
        kind === "logo"
          ? image.file
          : await cropToWebp(image, kind, zoom, positionX, positionY);
      formData.set("file", processed);
      formData.set("kind", kind);
      await uploadMediaAction(formData);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <form
      action={submit}
      className="border-border-light mt-4 space-y-5 rounded-3xl border bg-white p-5"
    >
      <div>
        <label htmlFor="media-kind" className="block text-sm font-bold">
          Onde a imagem será usada?
        </label>
        <select
          id="media-kind"
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as MediaKind);
            setZoom(1);
            setPositionX(50);
            setPositionY(50);
          }}
          className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3"
        >
          <option value="photo">Banner da página inicial</option>
          <option value="thumbnail">Card, notícia ou equipamento</option>
          <option value="logo">Logo de convênio ou parceria</option>
        </select>
        <p className="text-muted mt-2 text-xs">
          Recomendação: {recommendation.size}. Formatos aceitos: JPG, PNG e
          WebP. Tamanho recomendado: até 2 MB.
        </p>
      </div>

      <label className="block text-sm font-bold">
        Escolha uma imagem
        <input
          name="file-original"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (image) URL.revokeObjectURL(image.url);
            setImage(await readImage(file));
            setZoom(1);
            setPositionX(50);
            setPositionY(50);
          }}
          className="mt-2 block w-full text-sm"
        />
      </label>

      {image ? (
        <div className="bg-surface rounded-2xl p-4">
          <div
            className={`relative mx-auto overflow-hidden rounded-xl bg-white ${kind === "photo" ? "aspect-[12/5]" : kind === "thumbnail" ? "aspect-[3/2]" : "aspect-video"}`}
          >
            <div
              role="img"
              aria-label="Prévia do recorte da imagem"
              className={`absolute inset-0 bg-center bg-no-repeat ${kind === "logo" ? "bg-contain" : "bg-cover"}`}
              style={{
                backgroundImage: `url(${image.url})`,
                backgroundPosition: `${positionX}% ${positionY}%`,
                transform: kind === "logo" ? undefined : `scale(${zoom})`,
              }}
            />
          </div>
          <p className="text-muted mt-3 text-xs">
            Arquivo: {image.width} × {image.height} px ·{" "}
            {(image.file.size / 1024 / 1024).toFixed(2)} MB
          </p>

          {kind !== "logo" ? (
            <div className="mt-4 grid gap-4">
              <label className="text-xs font-bold">
                <span className="flex items-center gap-2">
                  <ZoomIn size={15} aria-hidden="true" /> Zoom
                </span>
                <input
                  type="range"
                  min="1"
                  max="2"
                  step="0.05"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="mt-2 w-full accent-[#087a4d]"
                />
              </label>
              <label className="text-xs font-bold">
                <span className="flex items-center gap-2">
                  <Crop size={15} aria-hidden="true" /> Posição horizontal
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={positionX}
                  onChange={(event) => setPositionX(Number(event.target.value))}
                  className="mt-2 w-full accent-[#087a4d]"
                />
              </label>
              <label className="text-xs font-bold">
                Posição vertical
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={positionY}
                  onChange={(event) => setPositionY(Number(event.target.value))}
                  className="mt-2 w-full accent-[#087a4d]"
                />
              </label>
            </div>
          ) : null}

          {warnings.length ? (
            <ul className="border-warning/25 text-warning mt-4 space-y-1 rounded-xl border bg-white p-3 text-xs font-bold">
              {warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          ) : (
            <p className="bg-mint text-brand mt-4 rounded-xl p-3 text-xs font-bold">
              A imagem está pronta para envio.
            </p>
          )}
        </div>
      ) : null}

      {[
        [
          "alt_text",
          "Descrição da imagem",
          "Descreva o que aparece na imagem para acessibilidade.",
        ],
        [
          "caption",
          "Legenda (opcional)",
          "Texto que pode acompanhar a imagem.",
        ],
        [
          "credit",
          "Crédito (opcional)",
          "Informe o autor ou a origem da imagem.",
        ],
        [
          "license",
          "Licença ou autorização (opcional)",
          "Registre a autorização de uso quando aplicável.",
        ],
      ].map(([name, label, help]) => (
        <label key={name} className="block text-sm font-bold">
          {label}
          {name === "alt_text" ? <span className="text-error"> *</span> : null}
          <input
            name={name}
            required={name === "alt_text"}
            maxLength={name === "caption" ? 500 : 240}
            className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
          />
          <span className="text-muted mt-1 block text-xs font-normal">
            {help}
          </span>
        </label>
      ))}

      <p className="text-muted text-xs leading-relaxed">
        Fotos e miniaturas são recortadas na proporção escolhida e convertidas
        para WebP automaticamente. Logos são preservadas para manter a
        transparência. SVG não é enviado pelo painel por segurança; exporte-o
        como PNG transparente.
      </p>
      <button
        disabled={!image || processing}
        className="bg-brand inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ImageUp size={17} aria-hidden="true" />{" "}
        {processing ? "Preparando imagem..." : "Enviar imagem"}
      </button>
    </form>
  );
}
