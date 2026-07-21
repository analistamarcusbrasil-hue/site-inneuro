import {
  ArrowUpRight,
  CalendarCheck,
  ClipboardList,
  FileCheck2,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { QuickAction, QuickActionIcon } from "@/types/quick-action";

const icons: Record<QuickActionIcon, LucideIcon> = {
  calendar: CalendarCheck,
  preparations: ClipboardList,
  results: FileCheck2,
  whatsapp: MessageCircle,
};

type QuickActionCardProps = {
  action: QuickAction;
};

function CardContent({ action }: QuickActionCardProps) {
  const Icon = icons[action.icon];

  return (
    <>
      <span
        className={cn(
          "grid h-12 w-12 place-items-center rounded-2xl transition-colors",
          action.featured ? "bg-brand text-white" : "bg-mint text-brand",
        )}
      >
        <Icon aria-hidden="true" size={22} strokeWidth={1.8} />
      </span>
      <div className="mt-8">
        <h3 className="font-heading text-ink text-xl font-semibold tracking-[-0.025em]">
          {action.title}
        </h3>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          {action.description}
        </p>
      </div>
      <span
        className={cn(
          "mt-auto grid h-9 w-9 place-items-center self-end rounded-full border transition-[color,background-color,transform]",
          action.featured
            ? "border-brand/20 text-brand bg-white"
            : "border-border-light text-brand",
        )}
        aria-hidden="true"
      >
        <ArrowUpRight size={17} />
      </span>
    </>
  );
}

const baseClasses =
  "group flex min-h-64 w-full flex-col rounded-3xl border p-6 text-left transition-[border-color,background-color,transform] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tech focus-visible:ring-offset-4 sm:p-7";

export function QuickActionCard({ action }: QuickActionCardProps) {
  const classes = cn(
    baseClasses,
    action.featured
      ? "border-tech/45 bg-mint/55 hover:border-tech"
      : "border-border-light bg-white hover:-translate-y-1 hover:border-brand/35",
  );

  if (action.disabled) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title={action.disabledReason}
        className={cn(classes, "cursor-not-allowed opacity-58")}
      >
        <CardContent action={action} />
      </button>
    );
  }

  if (action.external) {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${action.title} — abre em uma nova aba`}
        className={classes}
      >
        <CardContent action={action} />
      </a>
    );
  }

  return (
    <Link href={action.href} className={classes}>
      <CardContent action={action} />
    </Link>
  );
}
