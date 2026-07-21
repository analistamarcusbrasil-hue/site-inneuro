import Link from "next/link";
import { Container } from "@/components/layout/container";
import { NewsCarousel } from "@/components/news/news-carousel";
import { publishedNews } from "@/data/news";

export function NewsHighlightsSection() {
  if (!publishedNews.length) return null;
  return (
    <section
      className="bg-surface py-16 sm:py-20 lg:py-28"
      aria-labelledby="news-highlights-title"
    >
      <Container>
        <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-brand text-xs font-bold tracking-[.14em] uppercase">
              Conteúdo editorial
            </p>
            <h2
              id="news-highlights-title"
              className="font-heading text-ink mt-3 text-3xl font-semibold sm:text-4xl"
            >
              Destaques INNEURO
            </h2>
            <p className="text-muted mt-3 max-w-2xl text-lg">
              Informação, cuidado e novidades para você acompanhar de perto.
            </p>
          </div>
          <Link
            href="/noticias"
            className="text-brand inline-flex min-h-12 items-center text-sm font-bold"
          >
            Ver todas as notícias
          </Link>
        </div>
        <NewsCarousel items={publishedNews} />
      </Container>
    </section>
  );
}
