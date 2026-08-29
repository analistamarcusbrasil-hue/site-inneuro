import { CloudSun, Construction, HeartHandshake } from "lucide-react";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { requireAdminPermission } from "@/lib/cms/auth";
export default async function ClimatePage() {
  await requireAdminPermission("surveys.view");
  return (
    <>
      <AdminPageHeading
        eyebrow="Experiência e Pesquisas"
        title="Pesquisa de Clima"
        description="Um espaço futuro para acompanhar a experiência da equipe com responsabilidade e privacidade."
      />
      <section className="relative overflow-hidden rounded-[2rem] bg-emerald-950 p-8 text-white md:p-12">
        <CloudSun className="absolute -top-10 -right-10 size-52 text-white/5" />
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-300 px-4 py-2 text-xs font-extrabold text-amber-950">
          <Construction size={16} />
          Em desenvolvimento
        </span>
        <h2 className="font-heading mt-7 max-w-xl text-3xl font-semibold md:text-4xl">
          Escuta interna, segura e útil para quem faz a INNEURO acontecer.
        </h2>
        <p className="mt-4 max-w-2xl text-emerald-100">
          O módulo será disponibilizado após definição dos fluxos de anonimato,
          governança e análise. Nenhuma resposta está sendo coletada nesta
          etapa.
        </p>
        <div className="mt-9 flex items-center gap-3 rounded-2xl bg-white/10 p-4 text-sm">
          <HeartHandshake className="text-emerald-200" />
          <span>
            Privacidade e confiança serão requisitos centrais desde o início.
          </span>
        </div>
      </section>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          "Liderança",
          "Comunicação",
          "Reconhecimento",
          "Ambiente",
          "Engajamento",
          "Segurança psicológica",
        ].map((label) => (
          <article
            key={label}
            className="border-border-light rounded-2xl border bg-white p-5"
          >
            <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">
              Futuro indicador
            </p>
            <h2 className="font-heading text-brand-dark mt-2 text-xl font-semibold">
              {label}
            </h2>
          </article>
        ))}
      </section>
    </>
  );
}
