import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && <Badge>{eyebrow}</Badge>}
      <h2 className="font-heading text-ink mt-5 text-3xl leading-tight font-semibold tracking-[-0.04em] sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {description && (
        <p className="text-muted mt-4 text-lg leading-relaxed">{description}</p>
      )}
    </div>
  );
}
