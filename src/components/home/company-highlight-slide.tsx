import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CompanyHighlight } from "@/types/company-highlight";

type CompanyHighlightSlideProps = {
  item: CompanyHighlight;
  position: number;
  total: number;
  priority: boolean;
};

export function CompanyHighlightSlide({
  item,
  position,
  total,
  priority,
}: CompanyHighlightSlideProps) {
  return (
    <article
      aria-label={`Slide ${position} de ${total}: ${item.title}`}
      className="bg-brand-dark relative overflow-hidden rounded-[1.75rem] text-white"
    >
      <div className="relative aspect-[4/3] sm:aspect-video">
        <Image
          src={item.image}
          alt={item.imageAlt}
          fill
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          sizes="(max-width: 1024px) calc(100vw - 2rem), 70vw"
          className="object-cover"
          style={{ objectPosition: item.focalPosition ?? "center" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#03251b] via-[#03251b]/35 to-transparent"
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-10">
        <p className="text-mint text-xs font-bold tracking-[0.14em] uppercase">
          {item.category}
        </p>
        <h3 className="font-heading mt-2 max-w-3xl text-2xl leading-tight font-semibold sm:text-4xl">
          {item.title}
        </h3>
        <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
          {item.description}
        </p>
        {item.href ? (
          <Link
            href={item.href}
            className="focus-visible:ring-tech text-brand-dark mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            Saiba mais <ArrowUpRight aria-hidden="true" size={17} />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
