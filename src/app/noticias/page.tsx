import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import { NewsCard } from "@/components/news/news-card";
import { getPublicNews } from "@/lib/cms/public-content";
import { createPageMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const news = await getPublicNews(1);
  return createPageMetadata({
    title: "Notícias da INNEURO | Macapá",
    description:
      "Acompanhe publicações e informações oficiais da INNEURO em Macapá, Amapá.",
    path: "/noticias",
    index: news.length > 0,
  });
}

export default async function NewsPage() {
  const news = await getPublicNews();

  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Notícias"
        title="Publicações da INNEURO."
        description="Acompanhe informações publicadas nos canais oficiais da clínica."
      />
      <section className="bg-surface py-14 sm:py-20 lg:py-24">
        <Container>
          {news.length ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {news.map((item) => (
                <NewsCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <p className="border-border-light text-muted rounded-3xl border border-dashed bg-white p-8 text-center">
              Ainda não há publicações disponíveis nesta página.
            </p>
          )}
        </Container>
      </section>
    </main>
  );
}
