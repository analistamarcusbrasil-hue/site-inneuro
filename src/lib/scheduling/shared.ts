export const SCHEDULING_BUCKET = "scheduling-documents";
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_REQUEST_SIZE = 25 * 1024 * 1024;
export const REQUEST_TTL_MS = 48 * 60 * 60 * 1000;
export const UPLOAD_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export const documentKinds = [
  "photoId",
  "medicalOrder",
  "insuranceCard",
] as const;
export type DocumentKind = (typeof documentKinds)[number];

export const documentLabels: Record<DocumentKind, string> = {
  photoId: "Documento com foto",
  medicalOrder: "Pedido médico",
  insuranceCard: "Carteirinha do convênio",
};

export const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedMimeType = (typeof allowedMimeTypes)[number];

export type SchedulingFileDescriptor = {
  kind: DocumentKind;
  name: string;
  size: number;
  type: string;
};

export type PreparedUpload = {
  kind: DocumentKind;
  signedUrl: string;
};

export type PrepareUploadResponse = {
  protocol: string;
  sessionToken: string;
  uploads: PreparedUpload[];
};

export type FinalizeSchedulingResponse = {
  protocol: string;
  protectedUrl: string;
  whatsappUrl: string;
};

const mimeExtensions: Record<AllowedMimeType, readonly string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

export function normalizeMimeType(value: string) {
  return value.trim().toLowerCase() === "image/jpg"
    ? "image/jpeg"
    : value.trim().toLowerCase();
}

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (allowedMimeTypes as readonly string[]).includes(
    normalizeMimeType(value),
  );
}

export function isDocumentKind(value: string): value is DocumentKind {
  return (documentKinds as readonly string[]).includes(value);
}

export function getSafeExtension(name: string, mimeType: AllowedMimeType) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return mimeExtensions[mimeType].includes(extension)
    ? extension
    : mimeExtensions[mimeType][0];
}

export function validateFileDescriptor(file: SchedulingFileDescriptor) {
  const normalizedType = normalizeMimeType(file.type);
  if (!isDocumentKind(file.kind)) return "Tipo de documento inválido.";
  if (!isAllowedMimeType(normalizedType))
    return "Formato não permitido. Use PDF, JPG, PNG ou WebP.";
  if (!Number.isSafeInteger(file.size) || file.size <= 0)
    return "O arquivo selecionado está vazio ou inválido.";
  if (file.size > MAX_FILE_SIZE)
    return "Cada arquivo pode ter no máximo 10 MB.";
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!mimeExtensions[normalizedType].includes(extension))
    return "A extensão do arquivo não corresponde ao formato informado.";
  return null;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function sanitizeSchedulingText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
