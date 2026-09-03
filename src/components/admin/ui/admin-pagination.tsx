import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function PaginationLink({
  href,
  children,
  disabled,
}: {
  href?: string;
  children: ReactNode;
  disabled: boolean;
}) {
  const classes = cn(
    "border-border-light inline-flex min-h-10 items-center gap-1 rounded-xl border bg-white px-3 text-sm font-bold",
    disabled
      ? "text-muted cursor-not-allowed opacity-50"
      : "text-brand-dark hover:border-brand/30 hover:bg-mint/60",
  );

  return disabled || !href ? (
    <span className={classes} aria-disabled="true">
      {children}
    </span>
  ) : (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

export function AdminPagination({
  page,
  totalPages,
  previousHref,
  nextHref,
  className,
}: {
  page: number;
  totalPages: number;
  previousHref?: string;
  nextHref?: string;
  className?: string;
}) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);

  return (
    <nav
      aria-label="Paginação"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-muted text-sm" aria-live="polite">
        Página <strong className="text-ink">{safePage}</strong> de{" "}
        <strong className="text-ink">{safeTotalPages}</strong>
      </p>
      <div className="flex items-center gap-2">
        <PaginationLink href={previousHref} disabled={safePage <= 1}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          Anterior
        </PaginationLink>
        <PaginationLink href={nextHref} disabled={safePage >= safeTotalPages}>
          Próxima
          <ChevronRight aria-hidden="true" className="size-4" />
        </PaginationLink>
      </div>
    </nav>
  );
}
