import "server-only";
import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import {
  assessResumeText,
  countExtractedResumeFields,
  parseResumeText,
  RESUME_TEXT_MAX_CHARACTERS,
} from "./resume-extraction";

export async function extractCandidateResumePdf(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes);
  try {
    const result = await extractText(pdf, { mergePages: true });
    const text = result.text.slice(0, RESUME_TEXT_MAX_CHARACTERS);
    const assessment = assessResumeText(text);
    const data = parseResumeText(
      assessment.quality === "image_only" ? "" : text,
    );
    const extractedFields = countExtractedResumeFields(data);
    const warnings: string[] = [];
    if (assessment.quality === "image_only") {
      warnings.push(
        "Este PDF parece ser uma imagem ou digitalização e não possui texto selecionável. Envie uma versão textual ou preencha o perfil manualmente.",
      );
    } else if (assessment.quality === "insufficient") {
      warnings.push(
        "O PDF contém pouco texto selecionável. Revise os dados identificados e complete o que estiver faltando.",
      );
    }
    if (result.totalPages > 30) {
      warnings.push("O currículo é extenso; revise cuidadosamente os dados.");
    }
    if (extractedFields === 0 && assessment.quality !== "image_only") {
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
        assessment.quality === "image_only"
          ? "failed"
          : extractedFields > 0
            ? warnings.length
              ? "partial"
              : "ready"
            : "failed",
    } as const;
  } finally {
    await pdf.cleanup();
  }
}
