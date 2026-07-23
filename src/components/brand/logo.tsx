import { cn } from "@/lib/utils";

type LogoProps = { inverse?: boolean; className?: string };

export function Logo({ inverse = false, className }: LogoProps) {
  return (
    <div
      className={cn("inline-flex min-h-8 items-center", className)}
      aria-label="INNEURO"
    >
      <span
        className={cn(
          "font-heading text-xl font-bold tracking-[0.16em]",
          inverse ? "text-white" : "text-brand-dark",
        )}
      >
        INNEURO
      </span>
    </div>
  );
}
