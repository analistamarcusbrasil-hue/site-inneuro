import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { getPublishedNews, publishedNews } from "@/data/news";

export function generateStaticParams() {
  return publishedNews.map((item) => ({ slug: item.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const item = getPublishedNews((await params).slug);
  if (!item) return { robots: { index: false, follow: false } };
  return { title: `${item.title} | INNEURO`, description: item.excerpt };
}
export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const item = getPublishedNews((await params).slug);
  if (!item) notFound();
  return (
    <main id="main-content" tabIndex={-1} className="bg-surface">
      <Container className="py-14 sm:py-20">
        <nav aria-label="Breadcrumb" className="text-muted text-sm">
          <Link href="/">Início</Link> / <Link href="/noticias">Notícias</Link>{" "}
          / <span aria-current="page">{item.title}</span>
        </nav>
        <article className="mx-auto mt-10 max-w-4xl">
          <p className="text-brand text-xs font-bold tracking-[.14em] uppercase">
            {item.category}
          </p>
          <h1 className="font-heading text-ink mt-4 text-4xl font-semibold sm:text-5xl">
            {item.title}
          </h1>
          <time
            dateTime={item.publishedAt}
            className="text-muted mt-4 block text-sm"
          >
            {new Intl.DateTimeFormat("pt-BR").format(
              new Date(`${item.publishedAt}T12:00:00`),
            )}
          </time>
          <div className="relative mt-8 aspect-video overflow-hidden rounded-[2rem]">
            <Image
              src={item.image}
              alt={item.imageAlt}
              fill
              priority
              sizes="(max-width: 960px) 100vw, 896px"
              className="object-cover"
            />
          </div>
          <div className="text-muted mt-8 space-y-5 text-lg leading-relaxed">
            {item.body?.map((block, index) =>
              block.type === "heading" ? (
                <h2
                  key={index}
                  className="font-heading text-ink text-2xl font-semibold"
                >
                  {block.content}
                </h2>
              ) : block.type === "paragraph" ? (
                <p key={index}>{block.content}</p>
              ) : null,
            )}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(item.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-brand inline-flex min-h-12 items-center rounded-full px-6 text-sm font-bold text-white"
            >
              Compartilhar por WhatsApp
            </a>
            <Link
              href="/noticias"
              className="border-brand/25 text-brand-dark inline-flex min-h-12 items-center rounded-full border px-6 text-sm font-bold"
            >
              Voltar para notícias
            </Link>
          </div>
        </article>
      </Container>
    </main>
  );
}
