export const SCHEDULING_BUCKET = "scheduling-documents";
export const MAX_FILE_SIZE = 15 * 1024 * 1024;
export const MAX_PREVIEW_SIZE = 3 * 1024 * 1024;
export const MAX_REQUEST_SIZE = 35 * 1024 * 1024;
export const REQUEST_TTL_MS = 48 * 60 * 60 * 1000;
export const UPLOAD_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export const documentKinds = [
  "photoId",
  "medicalOrder",
  "susAuthorization",
  "susCard",
  "insuranceCardFront",
  "insuranceCardBack",
  "insuranceAuthorization",
  "other",
] as const;
export type DocumentKind = (typeof documentKinds)[number];

export const documentLabels: Record<DocumentKind, string> = {
  photoId: "Documento com foto",
  medicalOrder: "Pedido médico",
  susAuthorization: "Autorização da regulação",
  susCard: "Cartão SUS",
  insuranceCardFront: "Carteirinha do convênio — frente",
  insuranceCardBack: "Carteirinha do convênio — verso",
  insuranceAuthorization: "Autorização ou guia do convênio",
  other: "Outro documento",
};

export const schedulingModalities = [
  { id: "CONSULTATION", label: "Consultas" },
  { id: "CT", label: "Tomografia" },
  { id: "MRI", label: "Ressonância Magnética" },
  { id: "ERGOMETRIC_TEST", label: "Teste Ergométrico" },
  { id: "EEG", label: "Eletroencefalograma" },
  { id: "MAPA", label: "MAPA" },
  { id: "XRAY", label: "Raio-X" },
  { id: "MAMMOGRAPHY", label: "Mamografia" },
] as const;
export type SchedulingModality = (typeof schedulingModalities)[number]["id"];

export type SchedulingExamInput = {
  modality: SchedulingModality;
  description: string;
  examId: string | null;
  order: number;
};

export function getSchedulingModalityLabel(value: SchedulingModality) {
  return schedulingModalities.find((item) => item.id === value)?.label ?? value;
}

export function inferSchedulingModality(
  value: string,
): SchedulingModality | null {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  if (normalized.includes("consulta")) return "CONSULTATION";
  if (normalized.includes("tomografia")) return "CT";
  if (normalized.includes("ressonancia")) return "MRI";
  if (normalized.includes("teste ergometrico")) return "ERGOMETRIC_TEST";
  if (normalized.includes("eletroencefalograma")) return "EEG";
  if (/\bmapa\b/.test(normalized)) return "MAPA";
  if (normalized.includes("raio") || normalized.includes("raios"))
    return "XRAY";
  if (normalized.includes("mamografia")) return "MAMMOGRAPHY";
  return null;
}

export function isValidCpf(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calculateDigit = (length: number) => {
    const sum = digits
      .slice(0, length)
      .split("")
      .reduce(
        (total, digit, index) => total + Number(digit) * (length + 1 - index),
        0,
      );
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return (
    calculateDigit(9) === Number(digits[9]) &&
    calculateDigit(10) === Number(digits[10])
  );
}

export const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedMimeType = (typeof allowedMimeTypes)[number];

export type SchedulingFileDescriptor = {
  id: string;
  kind: DocumentKind;
  name: string;
  size: number;
  type: string;
  preview?: {
    name: string;
    size: number;
    type: string;
  } | null;
};

export type PreparedUpload = {
  id: string;
  kind: DocumentKind;
  signedUrl: string;
  role: "original" | "preview";
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

export const serviceTypes = ["PARTICULAR", "INSURANCE", "SUS"] as const;
export type ServiceType = (typeof serviceTypes)[number];

export const preferredPeriods = [
  "MORNING",
  "AFTERNOON",
  "EVENING",
  "ANY",
] as const;
export type PreferredPeriod = (typeof preferredPeriods)[number];

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

export function resolveSchedulingMimeType(name: string, reportedType: string) {
  const normalized = normalizeMimeType(reportedType);
  if (isAllowedMimeType(normalized)) return normalized;
  if (normalized && normalized !== "application/octet-stream") return null;
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return (Object.entries(mimeExtensions).find(([, extensions]) =>
    extensions.includes(extension),
  )?.[0] ?? null) as AllowedMimeType | null;
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
  const normalizedType = resolveSchedulingMimeType(file.name, file.type);
  if (!isDocumentKind(file.kind)) return "Tipo de documento inválido.";
  if (!normalizedType)
    return "Formato não permitido. Use PDF, JPG, PNG ou WebP.";
  if (!Number.isSafeInteger(file.size) || file.size <= 0)
    return "O arquivo selecionado está vazio ou inválido.";
  if (file.size > MAX_FILE_SIZE)
    return "Este arquivo é muito grande. Tente fotografar ou digitalizar novamente.";
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!mimeExtensions[normalizedType].includes(extension))
    return "A extensão do arquivo não corresponde ao formato informado.";
  return null;
}

export function normalizeSchedulingPhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  if (/^(\d)\1+$/.test(national)) return null;
  if (!/^[1-9]\d(?:[2-5]\d{7}|9\d{8})$/.test(national)) return null;
  return national;
}

export function normalizeSchedulingEmail(value: unknown) {
  const email = String(value ?? "")
    .trim()
    .toLowerCase();
  if (
    !email ||
    email.length > 254 ||
    /[\r\n]/.test(email) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    return null;
  return email;
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
