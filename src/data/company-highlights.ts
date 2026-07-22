import type { CompanyHighlight } from "@/types/company-highlight";

// Cadastre aqui somente fotografias, textos e destinos oficiais aprovados.
// A seção permanece oculta enquanto não houver conteúdo validado.
export const companyHighlights: CompanyHighlight[] = [];

export const publishedCompanyHighlights = companyHighlights.filter(
  (highlight) => highlight.published,
);
