import type { Metadata } from "next";
import { candidateLogoutAction } from "@/app/carreiras/actions";
import { Container } from "@/components/layout/container";
import { requireCandidateSession } from "@/lib/careers/auth";

export const metadata: Metadata = {
  title: "Área do candidato | Carreiras INNEURO",
};

export default async function CandidateProfilePage() {
  const { user, account } = await requireCandidateSession();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-surface min-h-screen pt-28 pb-16 sm:pt-36 sm:pb-24"
    >
      <Container>
        <section className="border-border-light mx-auto max-w-3xl rounded-[2rem] border bg-white p-7 shadow-[0_18px_50px_rgba(3,37,27,0.08)] sm:p-10">
          <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
            Área privada do candidato
          </p>
          <h1 className="font-heading text-brand-dark mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Olá, {account.full_name}.
          </h1>
          <p className="text-muted mt-4 leading-relaxed">
            Sua conta de acesso está pronta. O perfil profissional, o envio de
            currículo, as vagas e as candidaturas serão disponibilizados em
            próximas fases.
          </p>
          <dl className="border-border-light mt-8 grid gap-5 rounded-2xl border p-5 sm:grid-cols-2">
            <div>
              <dt className="text-muted text-xs font-bold tracking-[0.1em] uppercase">
                Nome
              </dt>
              <dd className="text-ink mt-2 font-semibold">
                {account.full_name}
              </dd>
            </div>
            <div>
              <dt className="text-muted text-xs font-bold tracking-[0.1em] uppercase">
                E-mail
              </dt>
              <dd className="text-ink mt-2 font-semibold break-all">
                {user.email}
              </dd>
            </div>
          </dl>
          <p className="bg-mint text-brand-dark mt-6 rounded-2xl p-4 text-sm font-semibold">
            Nenhum currículo ou dado profissional é solicitado nesta fase.
          </p>
          <form action={candidateLogoutAction} className="mt-8">
            <button className="border-brand/30 text-brand-dark hover:bg-mint focus-visible:ring-tech min-h-11 rounded-full border px-6 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
              Sair da conta
            </button>
          </form>
        </section>
      </Container>
    </main>
  );
}
