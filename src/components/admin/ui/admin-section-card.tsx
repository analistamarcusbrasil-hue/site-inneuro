import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminSectionCard({
  title,
  description,
  action,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "border-border-light rounded-2xl border bg-white p-4 sm:p-5 lg:p-6",
        className,
      )}
      {...props}
    >
      {title || description || action ? (
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-heading text-ink text-lg font-semibold">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-muted mt-1 max-w-3xl text-sm leading-6">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
