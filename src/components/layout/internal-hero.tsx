import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";

type InternalHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function InternalHero({
  eyebrow,
  title,
  description,
}: InternalHeroProps) {
  return (
    <section className="bg-brand-dark relative flex min-h-0 items-center overflow-hidden pt-20 pb-8 text-white sm:min-h-[clamp(300px,30vw,340px)] sm:pt-20 sm:pb-8">
      <div
        className="hero-grid absolute inset-0 opacity-25"
        aria-hidden="true"
      />
      <div className="internal-hero-ring" aria-hidden="true" />
      <Container className="relative">
        <Badge className="text-mint border-white/15 bg-white/8">
          {eyebrow}
        </Badge>
        <h1 className="font-heading mt-3 max-w-4xl text-[clamp(2.05rem,4.4vw,4rem)] leading-[1.01] font-semibold tracking-[-0.055em]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-white/68 sm:text-[1.05rem]">
          {description}
        </p>
      </Container>
    </section>
  );
}
