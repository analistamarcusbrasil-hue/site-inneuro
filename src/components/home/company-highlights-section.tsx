import { Container } from "@/components/layout/container";
import { publishedCompanyHighlights } from "@/data/company-highlights";
import { CompanyHighlightsCarousel } from "./company-highlights-carousel";

export function CompanyHighlightsSection() {
  if (!publishedCompanyHighlights.length) return null;

  return (
    <section
      className="bg-surface py-12 sm:py-16 lg:py-20"
      aria-labelledby="company-highlights-title"
    >
      <Container>
        <div className="mb-6 sm:mb-8">
          <h2
            id="company-highlights-title"
            className="font-heading text-ink text-3xl font-semibold sm:text-4xl"
          >
            Destaques INNEURO
          </h2>
          <p className="text-muted mt-3 max-w-2xl text-base leading-relaxed sm:text-lg">
            Conheça nossa estrutura, serviços, campanhas e principais novidades.
          </p>
        </div>
        <CompanyHighlightsCarousel items={publishedCompanyHighlights} />
      </Container>
    </section>
  );
}
