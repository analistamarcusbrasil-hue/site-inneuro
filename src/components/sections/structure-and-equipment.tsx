import { Magnet, Radiation, ScanLine } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { SectionHeader } from "@/components/sections/section-header";

const modalities = [
  {
    name: "Ressonância Magnética",
    href: "/exames/ressonancia-magnetica",
    icon: Magnet,
  },
  {
    name: "Tomografia Computadorizada",
    href: "/exames/tomografia-computadorizada",
    icon: ScanLine,
  },
  {
    name: "Raios X",
    href: "/exames/raios-x",
    icon: Radiation,
  },
] as const;

export function StructureAndEquipment() {
  return (
    <section
      aria-label="Estrutura e equipamentos"
      className="bg-white py-16 sm:py-20 lg:py-24"
    >
      <Container>
        <div className="grid items-end gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <SectionHeader
            eyebrow="Estrutura e equipamentos"
            title="Tecnologia aplicada ao diagnóstico por imagem."
            description="Conheça as modalidades e encontre informações para cada etapa do seu exame."
          />

          <div className="grid gap-4 sm:grid-cols-3">
            {modalities.map(({ name, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group border-border-light hover:border-brand/35 focus-visible:ring-brand bg-surface flex min-h-52 flex-col justify-between overflow-hidden rounded-3xl border p-6 transition-colors focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
              >
                <span className="bg-brand-dark text-tech relative grid size-14 place-items-center overflow-hidden rounded-2xl">
                  <span
                    aria-hidden="true"
                    className="border-tech/25 absolute -inset-3 rounded-full border"
                  />
                  <Icon aria-hidden="true" size={25} strokeWidth={1.6} />
                </span>
                <span className="font-heading text-ink mt-8 text-lg leading-tight font-semibold">
                  {name}
                </span>
                <span className="text-brand mt-3 text-sm font-bold">
                  Ver informações
                </span>
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
