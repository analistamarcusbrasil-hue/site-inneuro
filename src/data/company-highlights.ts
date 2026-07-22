import type { CompanyHighlight } from "@/types/company-highlight";

// Cadastre aqui somente fotografias, textos e destinos oficiais aprovados.
// Sem conteúdo validado, a seção exibe somente uma composição visual neutra.
export const companyHighlights: CompanyHighlight[] = [];

export const publishedCompanyHighlights = companyHighlights.filter(
  (highlight) => highlight.published,
);
