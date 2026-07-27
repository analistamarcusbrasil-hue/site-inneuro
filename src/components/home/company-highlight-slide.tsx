import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import type { CompanyHighlight } from "@/types/company-highlight";

type CompanyHighlightSlideProps = {
  item: CompanyHighlight;
  position: number;
  total: number;
  priority: boolean;
  variant?: "section" | "hero";
};

export function CompanyHighlightSlide({
  item,
  position,
  total,
  priority,
  variant = "section",
}: CompanyHighlightSlideProps) {
  const compact = variant === "hero";
  return (
    <article
      aria-label={`Slide ${position} de ${total}: ${item.title}`}
      className={`bg-brand-dark relative overflow-hidden text-white ${compact ? "rounded-[1.4rem] shadow-[0_16px_42px_rgba(3,37,27,.14)] ring-1 ring-white/10" : "rounded-[1.75rem]"}`}
    >
      <div
        className={`relative ${compact ? "aspect-[4/3] md:aspect-[5/4]" : "aspect-[4/3] sm:aspect-video"}`}
      >
        {item.image ? (
          <Image
            src={item.image}
            alt={item.imageAlt}
            fill
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            sizes={
              compact
                ? "(max-width: 767px) calc(100vw - 2.5rem), (max-width: 1279px) 48vw, 560px"
                : "(max-width: 1024px) calc(100vw - 2rem), 1280px"
            }
            className="object-cover"
            style={{ objectPosition: item.focalPosition ?? "center" }}
          />
        ) : (
          <div
            role="img"
            aria-label={item.imageAlt}
            className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_70%_42%,rgba(33,199,122,.22),transparent_34%),linear-gradient(135deg,#03251b,#075b3d)]"
          >
            <div className="absolute top-1/2 right-[8%] aspect-square w-[min(62%,560px)] -translate-y-1/2 rounded-full border border-white/10">
              <span className="border-tech/35 absolute inset-[12%] rounded-full border border-dashed" />
              <span className="border-mint/20 absolute inset-[28%] rounded-full border" />
              <span className="bg-tech absolute inset-[47%] rounded-full shadow-[0_0_46px_rgba(33,199,122,.45)]" />
            </div>
            <Logo
              inverse
              className="absolute top-7 left-7 sm:top-10 sm:left-10"
            />
          </div>
        )}
        <div
          aria-hidden="true"
          className={
            compact
              ? "absolute inset-0 bg-[linear-gradient(to_top,rgba(3,37,27,.94)_0%,rgba(3,55,40,.46)_52%,rgba(9,111,76,.2)_100%),linear-gradient(110deg,rgba(3,37,27,.16),rgba(33,199,122,.12))]"
              : "absolute inset-0 bg-gradient-to-t from-[#03251b] via-[#03251b]/35 to-transparent"
          }
        />
        {item.creditLabel && item.creditUrl ? (
          <a
            href={item.creditUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-4 right-4 rounded-full bg-black/45 px-3 py-2 text-[0.62rem] font-semibold tracking-wide text-white/80 backdrop-blur-sm hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:top-5 sm:right-5"
            aria-label={`${item.creditLabel} — abre em nova aba`}
          >
            {item.creditLabel}
          </a>
        ) : null}
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 ${compact ? "p-5 md:p-5 lg:p-6" : "p-5 sm:p-8 lg:p-10"}`}
      >
        <p className="text-mint text-xs font-bold tracking-[0.14em] uppercase">
          {item.category}
        </p>
        <h3
          className={`font-heading mt-2 max-w-3xl leading-tight font-semibold ${compact ? "text-xl sm:text-2xl lg:text-3xl" : "text-2xl sm:text-4xl"}`}
        >
          {item.title}
        </h3>
        <p
          className={`mt-3 max-w-2xl text-sm leading-relaxed text-white/80 ${compact ? "line-clamp-2" : "line-clamp-3 sm:text-base"}`}
        >
          {item.description}
        </p>
        {item.href ? (
          <Link
            href={item.href}
            className={`focus-visible:ring-tech text-brand-dark inline-flex items-center gap-2 rounded-full bg-white text-sm font-bold focus-visible:ring-2 focus-visible:ring-offset-2 ${compact ? "mt-4 min-h-10 px-4" : "mt-5 min-h-12 px-5"}`}
          >
            {item.ctaLabel ?? "Saiba mais"}{" "}
            <ArrowUpRight aria-hidden="true" size={17} />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
