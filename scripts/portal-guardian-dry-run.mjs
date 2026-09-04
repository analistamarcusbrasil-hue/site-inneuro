import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase não configurado para o dry run.");
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const now = Date.now();
const isoDaysAgo = (days) => new Date(now - days * 86_400_000).toISOString();
const closed = "(CONCLUIDO,NAO_AGENDAVEL,CANCELADO)";

async function countOpenAtLeast(days) {
  const result = await client
    .from("appointment_requests")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .is("completed_at", null)
    .not("workflow_status", "in", closed)
    .lte("created_at", isoDaysAgo(days));
  if (result.error) throw result.error;
  return result.count ?? 0;
}

async function listAll(bucket, prefix = "", depth = 0, result = []) {
  if (depth > 8 || result.length >= 10_000) return result;
  for (let offset = 0; result.length < 10_000; offset += 1000) {
    const listed = await client.storage
      .from(bucket)
      .list(prefix, { limit: 1000, offset });
    if (listed.error) throw listed.error;
    for (const item of listed.data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) result.push(path);
      else if (item.name !== ".emptyFolderPlaceholder")
        await listAll(bucket, path, depth + 1, result);
    }
    if ((listed.data ?? []).length < 1000) break;
  }
  return result;
}

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

const [
  age15,
  age17,
  age19,
  age20,
  completed,
  documents,
  resumes,
  media,
  schedulingFiles,
  resumeFiles,
  mediaFiles,
] = await Promise.all([
  countOpenAtLeast(15),
  countOpenAtLeast(17),
  countOpenAtLeast(19),
  countOpenAtLeast(20),
  allRows(
    "appointment_requests",
    "id,completed_at,created_at,workflow_status,deleted_at",
  ),
  allRows(
    "appointment_request_documents",
    "appointment_request_id,storage_path,preview_storage_path,file_size,preview_file_size",
  ),
  allRows("candidate_resumes", "storage_path,size_bytes"),
  allRows("media_assets", "storage_path,size_bytes"),
  listAll("scheduling-documents"),
  listAll("candidate-resumes"),
  listAll("site-media"),
]);

const completedById = new Map(completed.map((row) => [row.id, row]));
const purgeCutoff = now - 7 * 86_400_000;
const purgeDocuments = documents.filter((document) => {
  const request = completedById.get(document.appointment_request_id);
  return (
    request?.completed_at && Date.parse(request.completed_at) <= purgeCutoff
  );
});
const schedulingReferences = new Set(
  documents.flatMap((row) =>
    [row.storage_path, row.preview_storage_path].filter(Boolean),
  ),
);
const resumeReferences = new Set(resumes.map((row) => row.storage_path));
const mediaReferences = new Set(media.map((row) => row.storage_path));
const storageHealth = (files, references, isCandidate = () => true) => ({
  objects: files.length,
  orphan_suspected: files.filter(
    (path) => isCandidate(path) && !references.has(path),
  ).length,
  broken_references: [...references].filter((path) => !files.includes(path))
    .length,
});
const sum = (rows, selector) =>
  rows.reduce((total, row) => total + selector(row), 0);
const output = {
  generated_at: new Date(now).toISOString(),
  mode: "DRY_RUN_READ_ONLY",
  scheduling: {
    open_15_plus: age15,
    open_17_plus: age17,
    open_19_plus: age19,
    auto_close_eligible_20_plus: age20,
    documents_purge_eligible: purgeDocuments.length,
    bytes_purge_eligible: sum(
      purgeDocuments,
      (row) => Number(row.file_size ?? 0) + Number(row.preview_file_size ?? 0),
    ),
  },
  resumes: {
    total: resumes.length,
    already_small_under_1mb: resumes.filter(
      (row) => Number(row.size_bytes) < 1_048_576,
    ).length,
    optimization_eligible_1mb_plus: resumes.filter(
      (row) => Number(row.size_bytes) >= 1_048_576,
    ).length,
    high_priority_3mb_plus: resumes.filter(
      (row) => Number(row.size_bytes) >= 3_145_728,
    ).length,
    bytes_current: sum(resumes, (row) => Number(row.size_bytes ?? 0)),
  },
  storage: {
    scheduling: storageHealth(
      schedulingFiles,
      schedulingReferences,
      (path) => path.startsWith("uploads/") || path.startsWith("corrections/"),
    ),
    resumes: storageHealth(resumeFiles, resumeReferences),
    media: storageHealth(mediaFiles, mediaReferences),
    metadata_bytes: {
      scheduling: sum(
        documents,
        (row) =>
          Number(row.file_size ?? 0) + Number(row.preview_file_size ?? 0),
      ),
      resumes: sum(resumes, (row) => Number(row.size_bytes ?? 0)),
      media: sum(media, (row) => Number(row.size_bytes ?? 0)),
    },
  },
};
console.log(JSON.stringify(output, null, 2));
