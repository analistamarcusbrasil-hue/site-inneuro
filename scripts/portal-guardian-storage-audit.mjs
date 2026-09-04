import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase não configurado para a auditoria.");

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const now = Date.now();
const DAY = 86_400_000;

async function allRows(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = await client
      .from(table)
      .select(columns)
      .range(from, from + 999);
    if (page.error) throw page.error;
    rows.push(...(page.data ?? []));
    if ((page.data ?? []).length < 1000) return rows;
  }
}

async function listAll(bucket, prefix = "", depth = 0, result = []) {
  if (depth > 8 || result.length >= 10_000) return result;
  for (let offset = 0; result.length < 10_000; offset += 1000) {
    const listed = await client.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (listed.error) throw listed.error;
    for (const item of listed.data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) {
        result.push({
          path,
          createdAt: item.created_at ?? item.updated_at ?? null,
          bytes: Number(item.metadata?.size ?? 0),
        });
      } else if (item.name !== ".emptyFolderPlaceholder") {
        await listAll(bucket, path, depth + 1, result);
      }
    }
    if ((listed.data ?? []).length < 1000) break;
  }
  return result;
}

function requestClass(request) {
  if (!request) return "request_missing";
  if (request.deleted_at) return "soft_deleted";
  if (!request.completed_at) return "open";
  return Date.parse(request.completed_at) <= now - 7 * DAY
    ? "completed_retention_due"
    : "completed_retained";
}

function bucketCount(items, classifier) {
  return items.reduce((counts, item) => {
    const key = classifier(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

const [requests, documents, objects] = await Promise.all([
  allRows(
    "appointment_requests",
    "id,created_at,completed_at,deleted_at,workflow_status",
  ),
  allRows(
    "appointment_request_documents",
    "id,appointment_request_id,storage_path,preview_storage_path,created_at,file_size,preview_file_size,source,mime_type",
  ),
  listAll("scheduling-documents"),
]);

const requestsById = new Map(requests.map((row) => [row.id, row]));
const objectsByPath = new Map(objects.map((item) => [item.path, item]));
const references = new Set(
  documents.flatMap((row) =>
    [row.storage_path, row.preview_storage_path].filter(Boolean),
  ),
);
const controlPrefixes = [
  "requests/",
  "expirations/",
  "pending-uploads/",
  "rate-limits/",
];
const controlObjects = objects.filter((item) =>
  controlPrefixes.some((prefix) => item.path.startsWith(prefix)),
);
const unreferencedUploads = objects.filter(
  (item) => item.path.startsWith("uploads/") && !references.has(item.path),
);
const unknownObjects = objects.filter(
  (item) =>
    !item.path.startsWith("uploads/") &&
    !controlPrefixes.some((prefix) => item.path.startsWith(prefix)),
);

const broken = documents.flatMap((document) => {
  const lifecycle = requestClass(
    requestsById.get(document.appointment_request_id),
  );
  const result = [];
  if (!objectsByPath.has(document.storage_path)) {
    result.push({
      role: "original",
      lifecycle,
      source: document.source ?? "unknown",
      mime: document.mime_type ?? "unknown",
      previewAvailable: Boolean(
        document.preview_storage_path &&
        objectsByPath.has(document.preview_storage_path),
      ),
      createdMonth: String(document.created_at ?? "unknown").slice(0, 7),
    });
  }
  if (
    document.preview_storage_path &&
    !objectsByPath.has(document.preview_storage_path)
  ) {
    result.push({
      role: "preview",
      lifecycle,
      source: document.source ?? "unknown",
      mime: document.mime_type ?? "unknown",
      previewAvailable: false,
      createdMonth: String(document.created_at ?? "unknown").slice(0, 7),
    });
  }
  return result;
});

const ageClass = (item) => {
  if (!item.createdAt) return "age_unknown";
  const age = now - Date.parse(item.createdAt);
  if (age >= 7 * DAY) return "age_7d_plus";
  if (age >= 2 * DAY) return "age_48h_plus";
  return "age_under_48h";
};

const result = {
  generated_at: new Date(now).toISOString(),
  mode: "READ_ONLY_AGGREGATED_NO_PATHS",
  storage_objects: objects.length,
  database_references: references.size,
  control_plane: {
    total: controlObjects.length,
    by_kind: bucketCount(controlObjects, (item) => item.path.split("/")[0]),
    by_age: bucketCount(controlObjects, ageClass),
  },
  unreferenced_uploads: {
    total: unreferencedUploads.length,
    by_age: bucketCount(unreferencedUploads, ageClass),
    bytes: unreferencedUploads.reduce((sum, item) => sum + item.bytes, 0),
  },
  unknown_objects: unknownObjects.length,
  broken_references: {
    total: broken.length,
    by_role: bucketCount(broken, (item) => item.role),
    by_source: bucketCount(broken, (item) => item.source),
    by_mime: bucketCount(broken, (item) => item.mime),
    by_created_month: bucketCount(broken, (item) => item.createdMonth),
    preview_available: broken.filter((item) => item.previewAvailable).length,
    by_request_lifecycle: bucketCount(broken, (item) => item.lifecycle),
    matrix: bucketCount(broken, (item) => `${item.role}:${item.lifecycle}`),
  },
};

console.log(JSON.stringify(result, null, 2));
