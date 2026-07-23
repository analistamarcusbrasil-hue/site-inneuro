import Link from "next/link";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

export function LegalPage({
  eyebrow,
  title,
  description,
  sections,
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: LegalSection[];
}) {
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero eyebrow={eyebrow} title={title} description={description} />
      <section className="bg-surface py-14 sm:py-20 lg:py-24">
        <Container className="max-w-4xl">
          <div className="border-border-light rounded-3xl border bg-white p-6 sm:p-9">
            <p className="bg-mint text-brand-dark rounded-2xl p-4 text-sm leading-relaxed">
              Este texto descreve o funcionamento técnico atual do site e deve
              ser revisado pela assessoria jurídica da INNEURO antes da adoção
              como documento jurídico definitivo.
            </p>
            <div className="mt-8 space-y-9">
              {sections.map((section) => (
                <section key={section.title}>
                  <h2 className="font-heading text-ink text-2xl font-semibold">
                    {section.title}
                  </h2>
                  {section.paragraphs?.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-muted mt-3 leading-relaxed"
                    >
                      {paragraph}
                    </p>
                  ))}
                  {section.items ? (
                    <ul className="text-muted mt-4 list-disc space-y-2 pl-6 leading-relaxed">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
            <div className="border-border-light mt-10 border-t pt-6">
              <Link
                href="/contato"
                className="text-brand inline-flex min-h-11 items-center font-bold"
              >
                Consultar canais oficiais da INNEURO
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
