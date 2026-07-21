import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { NewsHighlight } from "@/types/news";

export function NewsSlide({
  item,
  position,
  total,
  priority = false,
}: {
  item: NewsHighlight;
  position: number;
  total: number;
  priority?: boolean;
}) {
  const href = item.externalUrl ?? `/noticias/${item.slug}`;
  return (
    <article
      aria-label={`${position} de ${total}: ${item.title}`}
      className="bg-brand-dark overflow-hidden rounded-[2rem] text-white"
    >
      <div className="relative aspect-[16/10] sm:aspect-video">
        <Image
          src={item.image}
          alt={item.imageAlt}
          fill
          priority={priority}
          sizes="(max-width: 1024px) 100vw, 66vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#03251b] via-[#03251b]/20 to-transparent"
          aria-hidden="true"
        />
      </div>
      <div className="p-6 sm:p-8 lg:p-10">
        <div className="text-mint flex flex-wrap gap-3 text-xs font-bold tracking-[.12em] uppercase">
          <span>{item.category}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.publishedAt}>
            {new Intl.DateTimeFormat("pt-BR").format(
              new Date(`${item.publishedAt}T12:00:00`),
            )}
          </time>
        </div>
        <h3 className="font-heading mt-4 text-2xl leading-tight font-semibold sm:text-4xl">
          {item.title}
        </h3>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
          {item.excerpt}
        </p>
        <Link
          href={href}
          target={item.externalUrl ? "_blank" : undefined}
          rel={item.externalUrl ? "noopener noreferrer" : undefined}
          className="bg-tech text-brand-dark mt-6 inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-bold"
        >
          Ler destaque <ArrowUpRight aria-hidden="true" size={17} />
        </Link>
      </div>
    </article>
  );
}
