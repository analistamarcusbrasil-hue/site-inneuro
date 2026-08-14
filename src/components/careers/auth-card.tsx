import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";

export function CareersAuthCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-surface min-h-screen pt-28 pb-16 sm:pt-36 sm:pb-24"
    >
      <Container>
        <section className="border-border-light mx-auto w-full max-w-lg rounded-[2rem] border bg-white p-6 shadow-[0_18px_50px_rgba(3,37,27,0.08)] sm:p-9">
          <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
            {eyebrow}
          </p>
          <h1 className="font-heading text-brand-dark mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            {title}
          </h1>
          <p className="text-muted mt-3 text-sm leading-relaxed">
            {description}
          </p>
          <div className="mt-7">{children}</div>
        </section>
      </Container>
    </main>
  );
}
