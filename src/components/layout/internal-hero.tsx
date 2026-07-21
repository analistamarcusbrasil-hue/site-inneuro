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
    <section className="bg-brand-dark relative overflow-hidden pt-36 pb-16 text-white sm:pt-40 sm:pb-20 lg:pt-48 lg:pb-24">
      <div
        className="hero-grid absolute inset-0 opacity-25"
        aria-hidden="true"
      />
      <div className="internal-hero-ring" aria-hidden="true" />
      <Container className="relative">
        <Badge className="text-mint border-white/15 bg-white/8">
          {eyebrow}
        </Badge>
        <h1 className="font-heading mt-6 max-w-4xl text-4xl leading-[1.02] font-semibold tracking-[-0.055em] sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/68 sm:text-xl">
          {description}
        </p>
      </Container>
    </section>
  );
}
