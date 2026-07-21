import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import { NewsCarousel } from "@/components/news/news-carousel";
import { publishedNews } from "@/data/news";

export const metadata: Metadata = {
  title: "Notícias | INNEURO",
  description: "Informações e novidades institucionais da INNEURO.",
  robots: publishedNews.length
    ? { index: true, follow: true }
    : { index: false, follow: true },
};

export default function NewsPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Notícias"
        title="Destaques INNEURO"
        description="Informação, cuidado e novidades para você acompanhar de perto."
      />
      <section className="bg-surface py-16 sm:py-20 lg:py-24">
        <Container>
          {publishedNews.length ? (
            <NewsCarousel items={publishedNews} />
          ) : (
            <div className="border-border-light mx-auto max-w-2xl rounded-3xl border bg-white p-8 text-center sm:p-12">
              <h2 className="font-heading text-ink text-2xl font-semibold">
                Novidades em preparação
              </h2>
              <p className="text-muted mt-4 leading-relaxed">
                A página está pronta para receber fotografias e conteúdos reais
                aprovados pela INNEURO.
              </p>
            </div>
          )}
        </Container>
      </section>
    </main>
  );
}
