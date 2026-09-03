import { cn } from "@/lib/utils";

export function AdminSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-xl bg-slate-200/70", className)}
    />
  );
}
