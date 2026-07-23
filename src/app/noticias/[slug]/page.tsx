import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import { getPublicNewsBySlug } from "@/lib/cms/public-content";
import { createPageMetadata } from "@/lib/metadata";

type PageProps = { params: Promise<{ slug: string }> };

function contentParagraphs(content: unknown) {
  if (!Array.isArray(content)) return [];
  return content.flatMap((block) => {
    if (
      block &&
      typeof block === "object" &&
      "text" in block &&
      typeof block.text === "string"
    ) {
      const textContent = String(block.text);
      return textContent
        .split(/\r?\n{2,}/)
        .map((text: string) => text.trim())
        .filter(Boolean);
    }
    return [];
  });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicNewsBySlug(slug);
  if (!item)
    return createPageMetadata({
      title: "Notícia não encontrada | INNEURO",
      description: "Publicação indisponível.",
      path: `/noticias/${slug}`,
      index: false,
    });
  return createPageMetadata({
    title: item.seoTitle || `${item.title} | INNEURO`,
    description: item.seoDescription || item.summary,
    path: `/noticias/${item.slug}`,
  });
}

export default async function NewsDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const item = await getPublicNewsBySlug(slug);
  if (!item) notFound();
  const paragraphs = contentParagraphs(item.content);

  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow={item.category ?? "Notícia"}
        title={item.title}
        description={item.summary}
      />
      <article className="bg-surface py-12 sm:py-16 lg:py-20">
        <Container className="max-w-4xl">
          {item.coverUrl ? (
            <figure className="mb-10">
              <div className="relative aspect-[16/9] overflow-hidden rounded-3xl bg-white">
                <Image
                  src={item.coverUrl}
                  alt={item.coverAlt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 896px, 100vw"
                  className="object-cover"
                />
              </div>
            </figure>
          ) : null}
          <div className="text-ink space-y-6 font-sans text-base leading-8 sm:text-lg">
            {(paragraphs.length ? paragraphs : [item.summary]).map(
              (paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ),
            )}
          </div>
        </Container>
      </article>
    </main>
  );
}
