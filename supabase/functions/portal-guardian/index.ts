import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type ClaimedDocument = {
  document_id: string;
  storage_path: string;
  preview_storage_path: string | null;
  file_size: number;
  preview_file_size: number | null;
  purge_reason: string;
};

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
};

function hasServiceRoleClaim(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;
  const token = authorization.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return false;
  try {
    const normalized = parts[1].replaceAll("-", "+").replaceAll("_", "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const claims = JSON.parse(atob(`${normalized}${padding}`)) as {
      role?: unknown;
      exp?: unknown;
    };
    return (
      claims.role === "service_role" &&
      typeof claims.exp === "number" &&
      claims.exp * 1000 > Date.now()
    );
  } catch {
    return false;
  }
}

function safeCode(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    return String((error as { code?: unknown }).code ?? "guardian_error").slice(
      0,
      120,
    );
  }
  return "guardian_error";
}

type GuardianClient = SupabaseClient;

async function listBucketFiles(
  client: GuardianClient,
  bucket: string,
  prefix = "",
  depth = 0,
  result: string[] = [],
): Promise<string[]> {
  if (depth > 8 || result.length >= 5_000) return result;
  for (let offset = 0; result.length < 5_000; offset += 1_000) {
    const listed = await client.storage.from(bucket).list(prefix, {
      limit: 1_000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (listed.error) throw listed.error;
    const items = listed.data ?? [];
    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) result.push(path);
      else if (item.name !== ".emptyFolderPlaceholder") {
        await listBucketFiles(client, bucket, path, depth + 1, result);
      }
      if (result.length >= 5_000) break;
    }
    if (items.length < 1_000) break;
  }
  return result;
}

async function collectStorageHealth(client: GuardianClient, dryRun: boolean) {
  const [documents, resumes, media, settings, existing] = await Promise.all([
    client
      .from("appointment_request_documents")
      .select(
        "id,storage_path,preview_storage_path,purged_at,storage_integrity_status",
      )
      .limit(10_000),
    client.from("candidate_resumes").select("storage_path").limit(10_000),
    client.from("media_assets").select("storage_path").limit(10_000),
    client
      .from("portal_guardian_settings")
      .select("orphan_observation_days")
      .eq("singleton", true)
      .single(),
    client
      .from("portal_guardian_findings")
      .select(
        "bucket_id,storage_path,finding_type,first_seen_at,occurrence_count",
      )
      .limit(10_000),
  ]);
  for (const query of [documents, resumes, media, settings, existing]) {
    if (query.error) throw query.error;
  }
  const documentRows = (documents.data ?? []) as Array<{
    id: string;
    storage_path: string;
    preview_storage_path: string | null;
    purged_at: string | null;
    storage_integrity_status: string;
  }>;
  const resumeRows = (resumes.data ?? []) as Array<{ storage_path: string }>;
  const mediaRows = (media.data ?? []) as Array<{ storage_path: string }>;
  const settingRow = settings.data as {
    orphan_observation_days: number;
  } | null;
  const existingRows = (existing.data ?? []) as Array<{
    bucket_id: string;
    storage_path: string;
    finding_type: string;
    first_seen_at: string;
    occurrence_count: number;
  }>;
  const references = new Map<string, Set<string>>([
    [
      "scheduling-documents",
      new Set(
        documentRows
          .filter((row) => !row.purged_at)
          .flatMap(
            (row) =>
              [row.storage_path, row.preview_storage_path].filter(
                Boolean,
              ) as string[],
          ),
      ),
    ],
    ["candidate-resumes", new Set(resumeRows.map((row) => row.storage_path))],
    ["site-media", new Set(mediaRows.map((row) => row.storage_path))],
  ]);
  const stored = new Map<string, Set<string>>();
  for (const bucket of references.keys()) {
    stored.set(bucket, new Set(await listBucketFiles(client, bucket)));
  }
  const previous = new Map(
    existingRows.map((item) => [
      `${item.bucket_id}:${item.storage_path}`,
      item,
    ]),
  );
  const now = new Date();
  const observationMs =
    Number(settingRow?.orphan_observation_days ?? 7) * 86_400_000;
  const rows: Array<Record<string, unknown>> = [];
  let orphanSuspected = 0;
  let orphanConfirmed = 0;
  let brokenReferences = 0;
  for (const [bucket, paths] of stored) {
    const bucketReferences = references.get(bucket) ?? new Set<string>();
    for (const path of paths) {
      if (bucketReferences.has(path)) continue;
      if (
        bucket === "scheduling-documents" &&
        !path.startsWith("uploads/") &&
        !path.startsWith("corrections/")
      ) {
        continue;
      }
      const old = previous.get(`${bucket}:${path}`);
      const confirmed = Boolean(
        old && now.getTime() - Date.parse(old.first_seen_at) >= observationMs,
      );
      if (confirmed) orphanConfirmed += 1;
      else orphanSuspected += 1;
      rows.push({
        bucket_id: bucket,
        storage_path: path,
        finding_type: confirmed ? "ORPHAN_CONFIRMED" : "ORPHAN_SUSPECTED",
        first_seen_at: old?.first_seen_at ?? now.toISOString(),
        last_seen_at: now.toISOString(),
        occurrence_count: Number(old?.occurrence_count ?? 0) + 1,
        resolved_at: null,
        metadata: { source: "SYSTEM_JOB", agent: "PORTAL_GUARDIAN" },
      });
    }
    for (const path of bucketReferences) {
      if (paths.has(path)) continue;
      brokenReferences += 1;
      const old = previous.get(`${bucket}:${path}`);
      rows.push({
        bucket_id: bucket,
        storage_path: path,
        finding_type: "BROKEN_REFERENCE",
        first_seen_at: old?.first_seen_at ?? now.toISOString(),
        last_seen_at: now.toISOString(),
        occurrence_count: Number(old?.occurrence_count ?? 0) + 1,
        resolved_at: null,
        metadata: { source: "SYSTEM_JOB", agent: "PORTAL_GUARDIAN" },
      });
    }
  }
  const activeKeys = new Set(
    rows.map((row) => `${String(row.bucket_id)}:${String(row.storage_path)}`),
  );
  for (const old of existingRows) {
    const key = `${old.bucket_id}:${old.storage_path}`;
    if (old.finding_type === "RESOLVED" || activeKeys.has(key)) continue;
    rows.push({
      bucket_id: old.bucket_id,
      storage_path: old.storage_path,
      finding_type: "RESOLVED",
      first_seen_at: old.first_seen_at,
      last_seen_at: now.toISOString(),
      occurrence_count: old.occurrence_count,
      resolved_at: now.toISOString(),
      metadata: { source: "SYSTEM_JOB", agent: "PORTAL_GUARDIAN" },
    });
  }
  if (!dryRun) {
    for (let offset = 0; offset < rows.length; offset += 200) {
      const saved = await client
        .from("portal_guardian_findings")
        .upsert(rows.slice(offset, offset + 200), {
          onConflict: "bucket_id,storage_path",
        });
      if (saved.error) throw saved.error;
    }
    const schedulingStored = stored.get("scheduling-documents") ?? new Set();
    const integrityGroups = new Map<string, string[]>();
    for (const document of documentRows) {
      if (document.purged_at) continue;
      const originalExists = schedulingStored.has(document.storage_path);
      const previewExists = document.preview_storage_path
        ? schedulingStored.has(document.preview_storage_path)
        : true;
      const status = !originalExists
        ? previewExists
          ? "MISSING_ORIGINAL"
          : "MISSING_BOTH"
        : previewExists
          ? "AVAILABLE"
          : "MISSING_PREVIEW";
      const group = integrityGroups.get(status) ?? [];
      group.push(document.id);
      integrityGroups.set(status, group);
    }
    for (const [status, ids] of integrityGroups) {
      for (let offset = 0; offset < ids.length; offset += 200) {
        const updated = await client
          .from("appointment_request_documents")
          .update({
            storage_integrity_status: status,
            storage_integrity_checked_at: now.toISOString(),
          })
          .in("id", ids.slice(offset, offset + 200));
        if (updated.error) throw updated.error;
      }
    }
  }
  return {
    orphanSuspected,
    orphanConfirmed,
    brokenReferences,
    inspectedFiles: [...stored.values()].reduce(
      (total, set) => total + set.size,
      0,
    ),
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!hasServiceRoleClaim(request)) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: "GUARDIAN_NOT_CONFIGURED" }), {
      status: 503,
      headers: jsonHeaders,
    });
  }

  let body: { dryRun?: boolean; batchSize?: number } = {};
  try {
    body = await request.json();
  } catch {
    // Corpo vazio equivale ao modo seguro de simulação.
  }
  const dryRun = body.dryRun !== false;
  const batchSize = Math.max(1, Math.min(Number(body.batchSize) || 100, 500));
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let runId: string | null = null;
  let scanned = 0;
  let affected = 0;
  let failed = 0;
  let bytesFreed = 0;

  try {
    const started = await supabase.rpc("portal_guardian_begin_job", {
      p_job_name: "portal_guardian_scheduling_lifecycle",
      p_dry_run: dryRun,
    });
    if (started.error || !started.data)
      throw started.error ?? new Error("job_start_failed");
    runId = String(started.data);

    const lifecycle = await supabase.rpc("portal_guardian_run_scheduling", {
      p_run_id: runId,
      p_dry_run: dryRun,
      p_limit: batchSize,
    });
    if (lifecycle.error) throw lifecycle.error;
    const lifecycleData = (lifecycle.data ?? {}) as {
      eligible?: number;
      closed?: number;
    };
    scanned += Number(lifecycleData.eligible ?? 0);
    affected += Number(lifecycleData.closed ?? 0);

    const claimed = await supabase.rpc(
      "portal_guardian_claim_scheduling_documents",
      {
        p_run_id: runId,
        p_dry_run: dryRun,
        p_limit: batchSize,
      },
    );
    if (claimed.error) throw claimed.error;
    const documents = (claimed.data ?? []) as ClaimedDocument[];
    scanned += documents.length;

    if (!dryRun) {
      for (const document of documents) {
        const paths = [
          document.storage_path,
          document.preview_storage_path,
        ].filter((path): path is string => Boolean(path));
        const removal = await supabase.storage
          .from("scheduling-documents")
          .remove(paths);
        const success = !removal.error;
        const finished = await supabase.rpc(
          "portal_guardian_finish_document_purge",
          {
            p_run_id: runId,
            p_document_id: document.document_id,
            p_success: success,
            p_reason: document.purge_reason,
            p_error_code: removal.error ? "storage_remove_failed" : null,
          },
        );
        if (!success || finished.error || !finished.data) {
          failed += 1;
        } else {
          affected += 1;
          bytesFreed +=
            Number(document.file_size ?? 0) +
            Number(document.preview_file_size ?? 0);
        }
      }
    }

    const storageHealth = await collectStorageHealth(supabase, dryRun);
    scanned += storageHealth.inspectedFiles;

    const status = failed > 0 ? "PARTIAL" : "SUCCESS";
    await supabase.rpc("portal_guardian_finish_job", {
      p_run_id: runId,
      p_status: status,
      p_scanned: scanned,
      p_affected: affected,
      p_failed: failed,
      p_bytes_freed: bytesFreed,
      p_summary: {
        lifecycle: lifecycle.data,
        purge_eligible: documents.length,
        storage_health: storageHealth,
      },
      p_error_code: null,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        runId,
        dryRun,
        scanned,
        affected,
        failed,
        bytesFreed,
        storageHealth,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    if (runId) {
      await supabase.rpc("portal_guardian_finish_job", {
        p_run_id: runId,
        p_status: "FAILED",
        p_scanned: scanned,
        p_affected: affected,
        p_failed: failed + 1,
        p_bytes_freed: bytesFreed,
        p_summary: {},
        p_error_code: safeCode(error),
      });
    }
    return new Response(
      JSON.stringify({ error: "GUARDIAN_JOB_FAILED", runId }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
