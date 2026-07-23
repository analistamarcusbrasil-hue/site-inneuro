import { Settings } from "lucide-react";

export function ConfigurationPending() {
  return (
    <main
      id="main-content"
      className="bg-surface grid min-h-screen place-items-center p-6"
    >
      <section className="border-border-light w-full max-w-xl rounded-3xl border bg-white p-8 text-center shadow-sm sm:p-12">
        <span className="bg-mint text-brand mx-auto grid size-14 place-items-center rounded-2xl">
          <Settings aria-hidden="true" />
        </span>
        <p className="text-brand mt-6 text-xs font-bold tracking-[0.14em] uppercase">
          Painel INNEURO
        </p>
        <h1 className="font-heading text-brand-dark mt-3 text-3xl font-semibold">
          Configuração administrativa pendente
        </h1>
        <p className="text-muted mt-4 leading-relaxed">
          O site público permanece disponível com os conteúdos estáticos.
          Configure as variáveis do Supabase para ativar autenticação e
          gerenciamento.
        </p>
      </section>
    </main>
  );
}
