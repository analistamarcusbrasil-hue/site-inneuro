import type { InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminSearchInput({
  className,
  "aria-label": ariaLabel = "Buscar",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("relative block min-w-0", className)}>
      <span className="sr-only">{ariaLabel}</span>
      <Search
        aria-hidden="true"
        className="text-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
      />
      <input
        type="search"
        aria-label={ariaLabel}
        className="border-border-light text-ink placeholder:text-muted/80 focus:border-brand focus:ring-brand/15 min-h-11 w-full rounded-xl border bg-white pr-4 pl-10 text-sm transition outline-none focus:ring-2"
        {...props}
      />
    </label>
  );
}
