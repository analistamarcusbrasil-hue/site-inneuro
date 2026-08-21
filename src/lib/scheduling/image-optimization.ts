const PREVIEW_MAX_DIMENSION = 2200;
const PREVIEW_QUALITY = 0.84;
const PREVIEW_THRESHOLD = 2 * 1024 * 1024;

export type OptimizedSchedulingImage = {
  file: File;
  width: number;
  height: number;
};

export async function createSchedulingImagePreview(
  original: File,
): Promise<OptimizedSchedulingImage | null> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(original.type))
    return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(original, {
      imageOrientation: "from-image",
    });
  } catch {
    return null;
  }

  try {
    const scale = Math.min(
      1,
      PREVIEW_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    if (scale === 1 && original.size <= PREVIEW_THRESHOLD) return null;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", PREVIEW_QUALITY),
    );
    if (!blob || blob.size <= 0 || blob.size >= original.size) return null;
    const baseName = original.name.replace(/\.[^.]+$/, "").slice(0, 140);
    return {
      file: new File([blob], `${baseName}-visualizacao.webp`, {
        type: "image/webp",
        lastModified: Date.now(),
      }),
      width,
      height,
    };
  } finally {
    bitmap.close();
  }
}
