import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminEmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border-light flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed bg-white p-6 text-center",
        className,
      )}
    >
      <span className="bg-surface text-muted grid size-12 place-items-center rounded-xl">
        {icon ?? <Inbox aria-hidden="true" className="size-6" />}
      </span>
      <h3 className="font-heading text-ink mt-4 text-base font-semibold">
        {title}
      </h3>
      {description ? (
        <p className="text-muted mt-2 max-w-md text-sm leading-6">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
