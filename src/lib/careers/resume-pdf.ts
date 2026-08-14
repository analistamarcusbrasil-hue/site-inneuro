import "server-only";
import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import {
  countExtractedResumeFields,
  parseResumeText,
  RESUME_TEXT_MAX_CHARACTERS,
} from "./resume-extraction";

export async function extractCandidateResumePdf(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes);
  try {
    const result = await extractText(pdf, { mergePages: true });
    const text = result.text.slice(0, RESUME_TEXT_MAX_CHARACTERS);
    const data = parseResumeText(text);
    const extractedFields = countExtractedResumeFields(data);
    const warnings: string[] = [];
    if (!text.trim()) warnings.push("O PDF não possui texto selecionável.");
    if (result.totalPages > 30) {
      warnings.push("O currículo é extenso; revise cuidadosamente os dados.");
    }
    if (extractedFields === 0) {
      warnings.push("Nenhuma informação profissional pôde ser identificada.");
    } else if (extractedFields < 3) {
      warnings.push(
        "Poucas informações foram identificadas; complete os campos ausentes manualmente.",
      );
    }
    return {
      data,
      textHash: createHash("sha256").update(text).digest("hex"),
      totalPages: result.totalPages,
      warnings,
      status:
        extractedFields > 0
          ? warnings.length
            ? "partial"
            : "ready"
          : "failed",
    } as const;
  } finally {
    await pdf.cleanup();
  }
}
