import "server-only";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractCandidateResumePdf } from "@/lib/careers/resume-pdf";
import {
  classifyProtectedPdf,
  hasMinimumSavings,
} from "@/lib/portal-guardian/policy";

type ResumeClaim = {
  resume_id: string;
  storage_path: string;
  size_bytes: number;
  original_name: string;
};

export type ResumeOptimizationSummary = {
  scanned: number;
  optimized: number;
  skipped: number;
  failed: number;
  bytesFreed: number;
};

async function finish(
  client: SupabaseClient,
  runId: string,
  claim: ResumeClaim,
  status: string,
  options: {
    newPath?: string;
    newSize?: number;
    sha256?: string;
    errorCode?: string;
  } = {},
) {
  return client.rpc("portal_guardian_finish_resume", {
    p_run_id: runId,
    p_resume_id: claim.resume_id,
    p_expected_path: claim.storage_path,
    p_status: status,
    p_new_path: options.newPath ?? null,
    p_new_size: options.newSize ?? null,
    p_sha256: options.sha256 ?? null,
    p_error_code: options.errorCode ?? null,
  });
}

export async function runResumeOptimizer(
  client: SupabaseClient,
  runId: string,
  batchSize = 10,
): Promise<ResumeOptimizationSummary> {
  const summary: ResumeOptimizationSummary = {
    scanned: 0,
    optimized: 0,
    skipped: 0,
    failed: 0,
    bytesFreed: 0,
  };
  const settingsResult = await client
    .from("portal_guardian_settings")
    .select("resume_min_savings_percent,resume_min_savings_bytes")
    .eq("singleton", true)
    .single();
  if (settingsResult.error) throw settingsResult.error;

  const claimed = await client.rpc("portal_guardian_claim_resumes", {
    p_run_id: runId,
    p_limit: Math.max(1, Math.min(batchSize, 25)),
  });
  if (claimed.error) throw claimed.error;
  const resumes = (claimed.data ?? []) as ResumeClaim[];
  summary.scanned = resumes.length;

  for (const resume of resumes) {
    let temporaryPath: string | null = null;
    try {
      const download = await client.storage
        .from("candidate-resumes")
        .download(resume.storage_path);
      if (download.error || !download.data)
        throw new Error("resume_download_failed");
      const original = new Uint8Array(await download.data.arrayBuffer());
      const protectedStatus = classifyProtectedPdf(original);
      if (protectedStatus) {
        const result = await finish(client, runId, resume, protectedStatus);
        if (result.error || !result.data)
          throw new Error("resume_finish_failed");
        summary.skipped += 1;
        continue;
      }

      const before = await extractCandidateResumePdf(original);
      let document: PDFDocument;
      try {
        document = await PDFDocument.load(original, {
          updateMetadata: false,
          throwOnInvalidObject: true,
        });
      } catch {
        const result = await finish(client, runId, resume, "SKIPPED_ENCRYPTED");
        if (result.error || !result.data)
          throw new Error("resume_finish_failed");
        summary.skipped += 1;
        continue;
      }
      const optimized = await document.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
        updateFieldAppearances: false,
      });
      const minPercent = Number(settingsResult.data.resume_min_savings_percent);
      const minBytes = Number(settingsResult.data.resume_min_savings_bytes);
      if (
        !hasMinimumSavings(
          original.byteLength,
          optimized.byteLength,
          minPercent,
          minBytes,
        )
      ) {
        const result = await finish(
          client,
          runId,
          resume,
          "SKIPPED_NO_BENEFIT",
        );
        if (result.error || !result.data)
          throw new Error("resume_finish_failed");
        summary.skipped += 1;
        continue;
      }

      const after = await extractCandidateResumePdf(optimized);
      if (
        before.totalPages !== after.totalPages ||
        before.textHash !== after.textHash
      ) {
        throw new Error("resume_validation_failed");
      }
      const suffix = resume.storage_path.toLowerCase().endsWith(".pdf")
        ? ".pdf"
        : "";
      temporaryPath = `${resume.storage_path.replace(/\.pdf$/i, "")}.guardian-${runId}${suffix}`;
      const upload = await client.storage
        .from("candidate-resumes")
        .upload(temporaryPath, optimized, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (upload.error) throw new Error("resume_upload_failed");
      const verification = await client.storage
        .from("candidate-resumes")
        .download(temporaryPath);
      if (verification.error || !verification.data)
        throw new Error("resume_upload_verification_failed");
      const verified = new Uint8Array(await verification.data.arrayBuffer());
      const verifiedHash = createHash("sha256").update(verified).digest("hex");
      const expectedHash = createHash("sha256").update(optimized).digest("hex");
      if (
        verified.byteLength !== optimized.byteLength ||
        verifiedHash !== expectedHash
      ) {
        throw new Error("resume_upload_verification_failed");
      }
      const finalized = await finish(client, runId, resume, "OPTIMIZED", {
        newPath: temporaryPath,
        newSize: optimized.byteLength,
        sha256: expectedHash,
      });
      if (finalized.error || !finalized.data)
        throw new Error("resume_compare_and_set_failed");
      temporaryPath = null;
      const removed = await client.storage
        .from("candidate-resumes")
        .remove([resume.storage_path]);
      if (removed.error) summary.failed += 1;
      summary.optimized += 1;
      summary.bytesFreed += original.byteLength - optimized.byteLength;
    } catch (error) {
      if (temporaryPath) {
        await client.storage.from("candidate-resumes").remove([temporaryPath]);
      }
      await finish(client, runId, resume, "FAILED", {
        errorCode:
          error instanceof Error
            ? error.message.slice(0, 120)
            : "optimization_failed",
      });
      summary.failed += 1;
    }
  }
  return summary;
}
