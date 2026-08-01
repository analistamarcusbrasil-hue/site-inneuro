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
    <section className="bg-brand-dark relative flex min-h-0 items-center overflow-hidden pt-24 pb-10 text-white sm:min-h-[clamp(360px,40vw,440px)] sm:pt-24 sm:pb-10 lg:pt-24 lg:pb-12">
      <div
        className="hero-grid absolute inset-0 opacity-25"
        aria-hidden="true"
      />
      <div className="internal-hero-ring" aria-hidden="true" />
      <Container className="relative py-2 sm:py-0">
        <Badge className="text-mint border-white/15 bg-white/8">
          {eyebrow}
        </Badge>
        <h1 className="font-heading mt-4 max-w-4xl text-[clamp(2.15rem,5vw,4rem)] leading-[1.02] font-semibold tracking-[-0.055em]">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/68 sm:text-lg">
          {description}
        </p>
      </Container>
    </section>
  );
}
