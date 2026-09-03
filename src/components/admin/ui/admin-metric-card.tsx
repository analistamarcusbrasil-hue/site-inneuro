import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminBadge } from "./admin-badge";

type AdminMetricCardProps = {
  label: string;
  value: ReactNode;
  description?: string;
  icon?: ReactNode;
  href?: string;
  status?: ReactNode;
  statusVariant?: ComponentProps<typeof AdminBadge>["variant"];
  className?: string;
};

function MetricContent({
  label,
  value,
  description,
  icon,
  status,
  statusVariant,
  href,
}: Omit<AdminMetricCardProps, "className">) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        {icon ? (
          <span className="bg-mint text-brand grid size-10 shrink-0 place-items-center rounded-xl">
            {icon}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {status ? (
            <AdminBadge variant={statusVariant}>{status}</AdminBadge>
          ) : null}
          {href ? (
            <ArrowUpRight aria-hidden="true" className="text-muted size-4" />
          ) : null}
        </div>
      </div>
      <p className="text-muted mt-5 text-xs font-bold tracking-[0.08em] uppercase">
        {label}
      </p>
      <p className="font-heading text-ink mt-1 text-3xl font-semibold tabular-nums">
        {value}
      </p>
      {description ? (
        <p className="text-muted mt-2 text-sm leading-5">{description}</p>
      ) : null}
    </>
  );
}

export function AdminMetricCard({
  className,
  href,
  ...props
}: AdminMetricCardProps) {
  const classes = cn(
    "border-border-light block h-full rounded-2xl border bg-white p-5 transition-colors",
    href && "hover:border-brand/30 hover:bg-mint/20",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        <MetricContent href={href} {...props} />
      </Link>
    );
  }

  return (
    <article className={classes}>
      <MetricContent {...props} />
    </article>
  );
}
