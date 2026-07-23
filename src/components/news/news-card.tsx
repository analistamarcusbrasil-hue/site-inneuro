import Image from "next/image";
import Link from "next/link";
import type { PublicNews } from "@/lib/cms/public-content";

export function NewsCard({ item }: { item: PublicNews }) {
  return (
    <article className="border-border-light group overflow-hidden rounded-3xl border bg-white">
      <Link
        href={`/noticias/${item.slug}`}
        className="focus-visible:ring-brand block h-full rounded-3xl focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
      >
        {item.coverUrl ? (
          <div className="bg-surface relative aspect-[16/9] overflow-hidden">
            <Image
              src={item.coverUrl}
              alt={item.coverAlt}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
        ) : null}
        <div className="p-5 sm:p-6">
          <p className="text-brand text-xs font-bold tracking-wide uppercase">
            {item.category ?? "Notícia"}
          </p>
          <h3 className="font-heading text-brand-dark mt-2 text-xl font-semibold">
            {item.title}
          </h3>
          <p className="text-muted mt-3 line-clamp-3 text-sm leading-relaxed">
            {item.summary}
          </p>
          <span className="text-brand mt-5 inline-flex text-sm font-bold">
            Ler publicação
          </span>
        </div>
      </Link>
    </article>
  );
}
