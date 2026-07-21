import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "border-brand/15 bg-mint text-brand inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold tracking-[0.08em] uppercase",
        className,
      )}
      {...props}
    />
  );
}
