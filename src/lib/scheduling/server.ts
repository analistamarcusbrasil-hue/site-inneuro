import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  allowedMimeTypes,
  getSafeExtension,
  isAllowedMimeType,
  isDocumentKind,
  MAX_FILE_SIZE,
  MAX_REQUEST_SIZE,
  normalizeMimeType,
  REQUEST_TTL_MS,
  SCHEDULING_BUCKET,
  type AllowedMimeType,
  type DocumentKind,
  type ServiceType,
  type SchedulingFileDescriptor,
  UPLOAD_SESSION_TTL_MS,
  validateFileDescriptor,
} from "@/lib/scheduling/shared";

type PreparedDocument = SchedulingFileDescriptor & {
  path: string;
};

type UploadSession = {
  version: 2;
  expiresAt: string;
  protocol: string;
  accessToken: string;
  serviceType: ServiceType;
  authorizationPending: boolean;
  documents: PreparedDocument[];
};

export type StoredDocument = {
  id: string;
  kind: DocumentKind;
  name: string;
  path: string;
  mimeType: AllowedMimeType;
  size: number;
};

export type SchedulingManifest = {
  version: 1 | 2;
  protocol: string;
  patientName: string;
  birthDate: string;
  phone: string;
  attendance: "Particular" | "Convênio" | "SUS";
  insuranceName: string | null;
  exam: string;
  preferredPeriod: string;
  observations: string | null;
  documents: StoredDocument[];
  serviceType?: ServiceType;
  exams?: Array<{ id: string; name: string; modality: string | null }>;
  preferredDates?: string[];
  preferredPeriods?: string[];
  email?: string | null;
  cpf?: string | null;
  city?: string | null;
  responsibleName?: string | null;
  insuranceCardNumber?: string | null;
  insuranceCardExpiry?: string | null;
  insuranceHolderName?: string | null;
  susCardNumber?: string | null;
  susAuthorizationNumber?: string | null;
  regulationNumber?: string | null;
  susRequestNumber?: string | null;
  sisregCode?: string | null;
  originCity?: string | null;
  requestingUnit?: string | null;
  requestingProfessional?: string | null;
  authorizationDate?: string | null;
  authorizationExpiry?: string | null;
  authorizationPending?: boolean;
  createdAt: string;
  expiresAt: string;
};

export type SchedulingDatabaseInput = {
  patientName: string;
  cpf: string | null;
  birthDate: string;
  phone: string;
  email: string | null;
  city: string | null;
  responsibleName: string | null;
  serviceType: ServiceType;
  insuranceId: string | null;
  insuranceName: string | null;
  insuranceCardNumber: string | null;
  insuranceCardExpiry: string | null;
  insuranceHolderName: string | null;
  susCardNumber: string | null;
  susAuthorizationNumber: string | null;
  regulationNumber: string | null;
  susRequestNumber: string | null;
  sisregCode: string | null;
  originCity: string | null;
  requestingUnit: string | null;
  requestingProfessional: string | null;
  authorizationDate: string | null;
  authorizationExpiry: string | null;
  authorizationPending: boolean;
  preferredDates: string[];
  preferredPeriods: string[];
  observations: string | null;
  exams: Array<{ id: string; name: string; modality: string | null }>;
};

type ExpiredManifest = {
  version: 1;
  protocol: string;
  expired: true;
  expiresAt: string;
};

type ExpirationMarker = {
  tokenHash: string;
  expiresAt: string;
};

type PendingUploadMarker = ExpirationMarker & {
  paths: string[];
};

const allowedBucketTypes = [...allowedMimeTypes, "application/json"];
const protocolAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function getServerSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SCHEDULING_NOT_CONFIGURED");
  return secret;
}

export function getSchedulingAdminClient() {
  const client = createSupabaseAdminClient();
  if (!client) throw new Error("SCHEDULING_NOT_CONFIGURED");
  return client;
}

export async function ensureSchedulingBucket(admin: SupabaseClient) {
  const { data } = await admin.storage.getBucket(SCHEDULING_BUCKET);
  if (!data) {
    const { error } = await admin.storage.createBucket(SCHEDULING_BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: allowedBucketTypes,
    });
    if (error) throw new Error("SCHEDULING_STORAGE_UNAVAILABLE");
    return;
  }

  if (
    data.public ||
    data.file_size_limit !== MAX_FILE_SIZE ||
    JSON.stringify([...(data.allowed_mime_types ?? [])].sort()) !==
      JSON.stringify([...allowedBucketTypes].sort())
  ) {
    const { error } = await admin.storage.updateBucket(SCHEDULING_BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: allowedBucketTypes,
    });
    if (error) throw new Error("SCHEDULING_STORAGE_UNAVAILABLE");
  }
}

export function createProtocol(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += protocolAlphabet[randomInt(protocolAlphabet.length)];
  }
  return `INN-${date}-${code}`;
}

export function createAccessToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function signPayload(payload: string) {
  return createHmac("sha256", getServerSecret())
    .update(payload)
    .digest("base64url");
}

export function createUploadSessionToken(session: UploadSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString(
    "base64url",
  );
  return `${payload}.${signPayload(payload)}`;
}

export function readUploadSessionToken(token: string): UploadSession | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = signPayload(payload);
  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    signatureBytes.length !== expectedBytes.length ||
    !timingSafeEqual(signatureBytes, expectedBytes)
  ) {
    return null;
  }
  try {
    const value = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (
      value?.version !== 2 ||
      typeof value.protocol !== "string" ||
      typeof value.accessToken !== "string" ||
      !["PARTICULAR", "INSURANCE", "SUS"].includes(value.serviceType) ||
      typeof value.authorizationPending !== "boolean" ||
      !Array.isArray(value.documents) ||
      Date.parse(value.expiresAt) <= Date.now()
    ) {
      return null;
    }
    return value as UploadSession;
  } catch {
    return null;
  }
}

export function prepareDocuments(
  files: SchedulingFileDescriptor[],
  protocol: string,
) {
  const seen = new Set<string>();
  const documents: PreparedDocument[] = [];
  let totalSize = 0;

  for (const file of files) {
    const error = validateFileDescriptor(file);
    if (error) throw new Error(error);
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(file.id) || seen.has(file.id))
      throw new Error("Revise os arquivos selecionados.");
    seen.add(file.id);
    const mimeType = normalizeMimeType(file.type) as AllowedMimeType;
    totalSize += file.size;
    documents.push({
      id: file.id,
      kind: file.kind,
      name: file.name.slice(0, 180),
      path: `uploads/${protocol}/${randomUUID()}.${getSafeExtension(file.name, mimeType)}`,
      size: file.size,
      type: mimeType,
    });
  }

  if (totalSize > MAX_REQUEST_SIZE)
    throw new Error("O total dos arquivos pode ter no máximo 25 MB.");
  return documents;
}

export function validateRequiredDocuments(
  documents: PreparedDocument[],
  serviceType: ServiceType,
  authorizationPending: boolean,
) {
  const kinds = new Set(documents.map((document) => document.kind));
  if (!kinds.has("medicalOrder")) throw new Error("Anexe o pedido médico.");
  if (
    serviceType === "SUS" &&
    !authorizationPending &&
    !kinds.has("susAuthorization")
  )
    throw new Error(
      "Anexe a autorização da regulação ou marque que ela está pendente.",
    );
  if (
    serviceType === "PARTICULAR" &&
    (kinds.has("insuranceCardFront") ||
      kinds.has("insuranceCardBack") ||
      kinds.has("susAuthorization"))
  )
    throw new Error(
      "Remova documentos de convênio ou SUS para atendimento particular.",
    );
  if (serviceType === "INSURANCE" && kinds.has("susAuthorization"))
    throw new Error(
      "Remova a autorização do SUS para atendimento por convênio.",
    );
}

function getRequestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function getRateWindow(now = Date.now()) {
  const start = now - (now % (15 * 60 * 1000));
  return new Date(start).toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

export async function consumeSchedulingRateLimit(
  admin: SupabaseClient,
  request: Request,
) {
  const ipHash = createHmac("sha256", getServerSecret())
    .update(getRequestIp(request))
    .digest("hex");
  const folder = `rate-limits/${getRateWindow()}/${ipHash}`;
  const path = `${folder}/${randomUUID()}.json`;
  const { error: uploadError } = await admin.storage
    .from(SCHEDULING_BUCKET)
    .upload(path, Buffer.from('{"attempt":true}', "utf8"), {
      contentType: "application/json",
      cacheControl: "0",
      upsert: false,
    });
  if (uploadError) throw new Error("SCHEDULING_RATE_LIMIT_UNAVAILABLE");

  const { data, error } = await admin.storage
    .from(SCHEDULING_BUCKET)
    .list(folder, { limit: 10 });
  if (error) throw new Error("SCHEDULING_RATE_LIMIT_UNAVAILABLE");
  if ((data?.length ?? 0) > 5) {
    await admin.storage.from(SCHEDULING_BUCKET).remove([path]);
    return false;
  }
  return true;
}

export function isSecureSchedulingRequest(request: Request) {
  const url = new URL(request.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
  return (
    (request.headers.get("x-forwarded-proto") ??
      url.protocol.replace(":", "")) === "https"
  );
}

export async function removeDocuments(admin: SupabaseClient, paths: string[]) {
  if (paths.length === 0) return;
  await Promise.all(
    paths.map(async (path) => {
      let result = await admin.storage.from(SCHEDULING_BUCKET).remove([path]);
      if (result.error) {
        result = await admin.storage.from(SCHEDULING_BUCKET).remove([path]);
      }
      if (result.error) throw new Error("SCHEDULING_CLEANUP_FAILED");
    }),
  );
}

function detectMimeType(bytes: Uint8Array): AllowedMimeType | null {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  )
    return "application/pdf";
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

export async function verifyUploadedDocuments(
  admin: SupabaseClient,
  documents: PreparedDocument[],
) {
  const verified: StoredDocument[] = [];
  let totalSize = 0;
  try {
    for (const document of documents) {
      if (!isDocumentKind(document.kind) || !isAllowedMimeType(document.type))
        throw new Error("Documento inválido.");
      const { data, error } = await admin.storage
        .from(SCHEDULING_BUCKET)
        .download(document.path);
      if (error || !data)
        throw new Error("Um dos documentos não foi enviado corretamente.");
      if (data.size <= 0 || data.size > MAX_FILE_SIZE)
        throw new Error("Um dos documentos ultrapassa o limite de 10 MB.");
      totalSize += data.size;
      if (totalSize > MAX_REQUEST_SIZE)
        throw new Error("O total dos arquivos ultrapassa 25 MB.");
      const bytes = new Uint8Array(await data.slice(0, 16).arrayBuffer());
      const detectedType = detectMimeType(bytes);
      if (!detectedType || detectedType !== normalizeMimeType(document.type))
        throw new Error(
          "O conteúdo real de um dos arquivos não corresponde ao formato permitido.",
        );
      verified.push({
        id: document.id,
        kind: document.kind,
        name: document.name,
        path: document.path,
        mimeType: detectedType,
        size: data.size,
      });
    }
    return verified;
  } catch (error) {
    await removeDocuments(
      admin,
      documents.map((document) => document.path),
    );
    throw error;
  }
}

function manifestPath(tokenHash: string) {
  return `requests/${tokenHash}/manifest.json`;
}

function expirationMarkerPath(tokenHash: string, expiresAt: string) {
  return `expirations/${expiresAt.slice(0, 10)}/${tokenHash}.json`;
}

function pendingUploadMarkerPath(tokenHash: string, expiresAt: string) {
  return `pending-uploads/${expiresAt.slice(0, 10)}/${tokenHash}.json`;
}

async function uploadJson(
  admin: SupabaseClient,
  path: string,
  value: unknown,
  upsert: boolean,
) {
  const { error } = await admin.storage
    .from(SCHEDULING_BUCKET)
    .upload(path, Buffer.from(JSON.stringify(value), "utf8"), {
      contentType: "application/json",
      cacheControl: "0",
      upsert,
    });
  if (error) throw new Error("SCHEDULING_MANIFEST_WRITE_FAILED");
}

async function downloadJson<T>(
  admin: SupabaseClient,
  path: string,
): Promise<T | null> {
  const { data, error } = await admin.storage
    .from(SCHEDULING_BUCKET)
    .download(path);
  if (error || !data || data.size > 256 * 1024) return null;
  try {
    return JSON.parse(await data.text()) as T;
  } catch {
    return null;
  }
}

export async function saveSchedulingManifest(
  admin: SupabaseClient,
  accessToken: string,
  manifest: SchedulingManifest,
) {
  const tokenHash = hashAccessToken(accessToken);
  const requestPath = manifestPath(tokenHash);
  await uploadJson(admin, requestPath, manifest, false);
  const marker: ExpirationMarker = { tokenHash, expiresAt: manifest.expiresAt };
  try {
    await uploadJson(
      admin,
      expirationMarkerPath(tokenHash, manifest.expiresAt),
      marker,
      false,
    );
  } catch (error) {
    await admin.storage.from(SCHEDULING_BUCKET).remove([requestPath]);
    throw error;
  }
}

export async function saveSchedulingRequestRecord(
  admin: SupabaseClient,
  accessToken: string,
  manifest: SchedulingManifest,
  input: SchedulingDatabaseInput,
) {
  const { data: requestRecord, error: requestError } = await admin
    .from("appointment_requests")
    .insert({
      protocol: manifest.protocol,
      access_token_hash: hashAccessToken(accessToken),
      patient_name: input.patientName,
      cpf: input.cpf,
      birth_date: input.birthDate,
      phone: input.phone,
      email: input.email,
      city: input.city,
      responsible_name: input.responsibleName,
      service_type: input.serviceType,
      insurance_id: input.insuranceId,
      insurance_name: input.insuranceName,
      insurance_card_number: input.insuranceCardNumber,
      insurance_card_expiry: input.insuranceCardExpiry,
      insurance_holder_name: input.insuranceHolderName,
      sus_cns: input.susCardNumber,
      sus_authorization_number: input.susAuthorizationNumber,
      sus_regulation_number: input.regulationNumber,
      sus_request_number: input.susRequestNumber,
      sisreg_code: input.sisregCode,
      origin_city: input.originCity,
      requesting_unit: input.requestingUnit,
      requesting_professional: input.requestingProfessional,
      authorization_date: input.authorizationDate,
      authorization_expiry: input.authorizationExpiry,
      authorization_pending: input.authorizationPending,
      preferred_dates: input.preferredDates,
      preferred_periods: input.preferredPeriods,
      notes: input.observations,
      status: input.authorizationPending ? "AUTHORIZATION_PENDING" : "NEW",
      expires_at: manifest.expiresAt,
    })
    .select("id")
    .single();

  if (requestError || !requestRecord)
    throw new Error("SCHEDULING_DATABASE_WRITE_FAILED");

  const requestId = requestRecord.id as string;
  const examRows = input.exams.map((exam) => ({
    appointment_request_id: requestId,
    exam_id: exam.id,
    exam_name: exam.name,
    modality: exam.modality,
  }));
  const documentRows = manifest.documents.map((document) => ({
    appointment_request_id: requestId,
    document_type: (
      {
        photoId: "photo_id",
        medicalOrder: "medical_request",
        susAuthorization: "sus_authorization",
        insuranceCardFront: "insurance_card_front",
        insuranceCardBack: "insurance_card_back",
        other: "other",
      } as const
    )[document.kind],
    storage_path: document.path,
    file_name: document.name,
    mime_type: document.mimeType,
    file_size: document.size,
  }));

  const [
    { error: examsError },
    { error: documentsError },
    { error: historyError },
  ] = await Promise.all([
    admin.from("appointment_request_exams").insert(examRows),
    admin.from("appointment_request_documents").insert(documentRows),
    admin.from("appointment_request_history").insert({
      appointment_request_id: requestId,
      action: "Solicitação recebida pelo site",
      details: {
        status: input.authorizationPending ? "AUTHORIZATION_PENDING" : "NEW",
      },
    }),
  ]);

  if (examsError || documentsError || historyError) {
    await admin.from("appointment_requests").delete().eq("id", requestId);
    throw new Error("SCHEDULING_DATABASE_WRITE_FAILED");
  }
  return requestId;
}

export async function deleteSchedulingRequestRecord(
  admin: SupabaseClient,
  requestId: string,
) {
  await admin.from("appointment_requests").delete().eq("id", requestId);
}

function isSchedulingManifest(value: unknown): value is SchedulingManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<SchedulingManifest>;
  return (
    manifest.version === 1 &&
    typeof manifest.protocol === "string" &&
    typeof manifest.patientName === "string" &&
    typeof manifest.expiresAt === "string" &&
    Array.isArray(manifest.documents)
  );
}

function isExpiredManifest(value: unknown): value is ExpiredManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<ExpiredManifest>;
  return (
    manifest.version === 1 &&
    manifest.expired === true &&
    typeof manifest.protocol === "string"
  );
}

export async function purgeSchedulingRequest(
  admin: SupabaseClient,
  tokenHash: string,
  manifest: SchedulingManifest,
) {
  await removeDocuments(
    admin,
    manifest.documents.map((document) => document.path),
  );
  const tombstone: ExpiredManifest = {
    version: 1,
    protocol: manifest.protocol,
    expired: true,
    expiresAt: manifest.expiresAt,
  };
  await uploadJson(admin, manifestPath(tokenHash), tombstone, true);
  await admin.storage
    .from(SCHEDULING_BUCKET)
    .remove([expirationMarkerPath(tokenHash, manifest.expiresAt)]);
}

export async function getSchedulingRequest(accessToken: string) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(accessToken))
    return { status: "invalid" as const };
  const admin = getSchedulingAdminClient();
  await ensureSchedulingBucket(admin);
  const tokenHash = hashAccessToken(accessToken);
  const value = await downloadJson<SchedulingManifest | ExpiredManifest>(
    admin,
    manifestPath(tokenHash),
  );
  if (isExpiredManifest(value))
    return { status: "expired" as const, protocol: value.protocol };
  if (!isSchedulingManifest(value)) return { status: "invalid" as const };
  if (Date.parse(value.expiresAt) <= Date.now()) {
    await purgeSchedulingRequest(admin, tokenHash, value);
    return { status: "expired" as const, protocol: value.protocol };
  }
  return { status: "active" as const, manifest: value, tokenHash };
}

export async function createTemporaryDocumentUrl(
  accessToken: string,
  documentValue: string,
) {
  const request = await getSchedulingRequest(accessToken);
  if (request.status !== "active") return null;
  const document = request.manifest.documents.find(
    (item) => item.id === documentValue || item.kind === documentValue,
  );
  if (!document) return null;
  const admin = getSchedulingAdminClient();
  const { data, error } = await admin.storage
    .from(SCHEDULING_BUCKET)
    .createSignedUrl(document.path, 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function createPreparedUploadSession(
  admin: SupabaseClient,
  serviceType: ServiceType,
  files: SchedulingFileDescriptor[],
  authorizationPending: boolean,
) {
  const protocol = createProtocol();
  const accessToken = createAccessToken();
  const documents = prepareDocuments(files, protocol);
  validateRequiredDocuments(documents, serviceType, authorizationPending);
  const uploads = [];
  for (const document of documents) {
    const { data, error } = await admin.storage
      .from(SCHEDULING_BUCKET)
      .createSignedUploadUrl(document.path);
    if (error || !data?.signedUrl)
      throw new Error("Não foi possível preparar o envio dos documentos.");
    uploads.push({
      id: document.id,
      kind: document.kind,
      signedUrl: data.signedUrl,
    });
  }
  const session: UploadSession = {
    version: 2,
    expiresAt: new Date(Date.now() + UPLOAD_SESSION_TTL_MS).toISOString(),
    protocol,
    accessToken,
    serviceType,
    authorizationPending,
    documents,
  };
  const pendingMarker: PendingUploadMarker = {
    tokenHash: hashAccessToken(accessToken),
    expiresAt: session.expiresAt,
    paths: documents.map((document) => document.path),
  };
  await uploadJson(
    admin,
    pendingUploadMarkerPath(pendingMarker.tokenHash, pendingMarker.expiresAt),
    pendingMarker,
    false,
  );
  return { protocol, uploads, sessionToken: createUploadSessionToken(session) };
}

export function createManifestExpiration() {
  return new Date(Date.now() + REQUEST_TTL_MS).toISOString();
}

async function cleanupOldRateLimitMarkers(admin: SupabaseClient) {
  const oldestActiveWindow = getRateWindow(Date.now() - 60 * 60 * 1000);
  const { data: windows } = await admin.storage
    .from(SCHEDULING_BUCKET)
    .list("rate-limits", { limit: 100 });

  for (const windowFolder of windows ?? []) {
    if (windowFolder.id || windowFolder.name >= oldestActiveWindow) continue;
    const windowPath = `rate-limits/${windowFolder.name}`;
    const { data: ipFolders } = await admin.storage
      .from(SCHEDULING_BUCKET)
      .list(windowPath, { limit: 100 });
    for (const ipFolder of ipFolders ?? []) {
      if (ipFolder.id) continue;
      const ipPath = `${windowPath}/${ipFolder.name}`;
      const { data: markers } = await admin.storage
        .from(SCHEDULING_BUCKET)
        .list(ipPath, { limit: 100 });
      const paths = (markers ?? [])
        .filter((marker) => Boolean(marker.id))
        .map((marker) => `${ipPath}/${marker.name}`);
      await removeDocuments(admin, paths);
    }
  }
}

async function cleanupPendingUploads(admin: SupabaseClient) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: dateFolders } = await admin.storage
    .from(SCHEDULING_BUCKET)
    .list("pending-uploads", { limit: 100 });

  for (const dateFolder of dateFolders ?? []) {
    if (dateFolder.id || dateFolder.name > today) continue;
    const folder = `pending-uploads/${dateFolder.name}`;
    const { data: markers } = await admin.storage
      .from(SCHEDULING_BUCKET)
      .list(folder, { limit: 100 });
    for (const markerFile of markers ?? []) {
      if (!markerFile.id) continue;
      const markerPath = `${folder}/${markerFile.name}`;
      const marker = await downloadJson<PendingUploadMarker>(admin, markerPath);
      if (!marker || Date.parse(marker.expiresAt) > Date.now()) continue;
      const manifest = await downloadJson<SchedulingManifest | ExpiredManifest>(
        admin,
        manifestPath(marker.tokenHash),
      );
      if (!isSchedulingManifest(manifest) && !isExpiredManifest(manifest)) {
        await removeDocuments(admin, marker.paths);
      }
      await admin.storage.from(SCHEDULING_BUCKET).remove([markerPath]);
    }
  }
}

export async function cleanupExpiredSchedulingRequests(admin: SupabaseClient) {
  await ensureSchedulingBucket(admin);
  await cleanupOldRateLimitMarkers(admin);
  await cleanupPendingUploads(admin);
  const today = new Date().toISOString().slice(0, 10);
  const { data: dateFolders } = await admin.storage
    .from(SCHEDULING_BUCKET)
    .list("expirations", { limit: 100 });
  let purged = 0;
  for (const dateFolder of dateFolders ?? []) {
    if (dateFolder.name > today || dateFolder.id) continue;
    const folder = `expirations/${dateFolder.name}`;
    const { data: markers } = await admin.storage
      .from(SCHEDULING_BUCKET)
      .list(folder, {
        limit: 100,
      });
    for (const markerFile of markers ?? []) {
      if (!markerFile.id || purged >= 100) continue;
      const markerPath = `${folder}/${markerFile.name}`;
      const marker = await downloadJson<ExpirationMarker>(admin, markerPath);
      if (!marker || Date.parse(marker.expiresAt) > Date.now()) continue;
      const manifest = await downloadJson<SchedulingManifest | ExpiredManifest>(
        admin,
        manifestPath(marker.tokenHash),
      );
      if (isSchedulingManifest(manifest)) {
        await purgeSchedulingRequest(admin, marker.tokenHash, manifest);
      } else {
        await admin.storage.from(SCHEDULING_BUCKET).remove([markerPath]);
      }
      purged += 1;
    }
  }
  return purged;
}
