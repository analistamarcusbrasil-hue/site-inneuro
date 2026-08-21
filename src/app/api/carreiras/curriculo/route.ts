import { NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateSession } from "@/lib/careers/auth";
import { safeCareersDestination } from "@/lib/careers/auth-validation";
import { isCareersPortalEnabled } from "@/lib/careers/feature-flag";
import {
  CANDIDATE_RESUME_BUCKET,
  CANDIDATE_RESUME_MAX_BYTES,
  hasPdfMagicNumber,
} from "@/lib/careers/profile";
import {
  parseResumeText,
  RESUME_PARSER_VERSION,
  type ResumeExtraction,
} from "@/lib/careers/resume-extraction";
import { extractCandidateResumePdf } from "@/lib/careers/resume-pdf";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const requestSchema = z.object({
  storagePath: z.string().min(1).max(500),
  originalName: z.string().min(1).max(255),
  sizeBytes: z.number().int().min(1).max(CANDIDATE_RESUME_MAX_BYTES),
  next: z.string().max(500).optional(),
});

function jsonError(status: number) {
  return NextResponse.json({ error: "resume_upload_failed" }, { status });
}

export async function POST(request: Request) {
  if (!isCareersPortalEnabled()) return jsonError(404);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return jsonError(403);

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError(400);

  const { supabase, user, account } = await getCandidateSession();
  if (!supabase || !user || !account) return jsonError(401);
  const expectedPrefix = `${user.id}/`;
  const pathSuffix = parsed.data.storagePath.slice(expectedPrefix.length);
  if (
    !parsed.data.storagePath.startsWith(expectedPrefix) ||
    !/^\d{13}-[0-9a-f-]{36}\.pdf$/i.test(pathSuffix)
  ) {
    return jsonError(400);
  }

  let committed = false;
  const cleanupNewUpload = async () => {
    if (committed) return;
    const storage = createSupabaseAdminClient() ?? supabase;
    await storage.storage
      .from(CANDIDATE_RESUME_BUCKET)
      .remove([parsed.data.storagePath])
      .catch(() => undefined);
  };

  try {
    const { data: storedFile, error: downloadError } = await supabase.storage
      .from(CANDIDATE_RESUME_BUCKET)
      .download(parsed.data.storagePath);
    if (
      downloadError ||
      !storedFile ||
      storedFile.size !== parsed.data.sizeBytes ||
      storedFile.size > CANDIDATE_RESUME_MAX_BYTES
    ) {
      await cleanupNewUpload();
      return jsonError(400);
    }

    const fileBytes = new Uint8Array(await storedFile.arrayBuffer());
    if (!hasPdfMagicNumber(fileBytes.slice(0, 5))) {
      await cleanupNewUpload();
      return jsonError(400);
    }

    let extraction: {
      data: ResumeExtraction;
      textHash: string | null;
      totalPages: number | null;
      warnings: string[];
      status: "ready" | "partial" | "failed";
    };
    try {
      extraction = await extractCandidateResumePdf(fileBytes);
    } catch {
      extraction = {
        data: parseResumeText(""),
        textHash: null,
        totalPages: null,
        warnings: [
          "Não foi possível ler o texto deste PDF. Complete o perfil manualmente.",
        ],
        status: "failed",
      };
    }

    const originalName =
      parsed.data.originalName
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim()
        .slice(0, 255) || "curriculo.pdf";
    const { data: replacementData, error: replacementError } =
      await supabase.rpc("replace_candidate_resume", {
        p_original_name: originalName,
        p_storage_path: parsed.data.storagePath,
        p_size_bytes: parsed.data.sizeBytes,
        p_extraction_status: extraction.status,
        p_extracted_data: extraction.data,
        p_warnings: extraction.warnings,
        p_parser_version: RESUME_PARSER_VERSION,
        p_text_sha256: extraction.textHash,
        p_total_pages: extraction.totalPages,
      });
    const replacement = Array.isArray(replacementData)
      ? replacementData[0]
      : replacementData;
    if (replacementError || !replacement?.review_id) {
      await cleanupNewUpload();
      return jsonError(500);
    }
    committed = true;

    if (
      replacement.old_storage_path &&
      replacement.old_storage_path !== parsed.data.storagePath
    ) {
      const storage = createSupabaseAdminClient() ?? supabase;
      await storage.storage
        .from(CANDIDATE_RESUME_BUCKET)
        .remove([replacement.old_storage_path])
        .catch(() => undefined);
    }

    const safeNext = parsed.data.next
      ? safeCareersDestination(parsed.data.next)
      : null;
    const redirectUrl =
      extraction.status === "failed"
        ? "/carreiras/perfil?error=resume-analysis-failed"
        : `/carreiras/perfil/revisar-curriculo/${replacement.review_id}${
            safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""
          }`;
    return NextResponse.json({ redirectUrl });
  } catch {
    await cleanupNewUpload();
    return jsonError(500);
  }
}
