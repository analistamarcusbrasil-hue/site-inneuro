import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { candidateRegistrationAction } from "@/app/carreiras/actions";
import { CareersAuthCard } from "@/components/careers/auth-card";
import { getCandidateSession } from "@/lib/careers/auth";

export const metadata: Metadata = {
  title: "Criar conta | Carreiras INNEURO",
};

export default async function CandidateRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const session = await getCandidateSession();
  if (session.user && session.account) redirect("/carreiras/perfil");
  const query = await searchParams;

  return (
    <CareersAuthCard
      eyebrow="Carreiras INNEURO"
      title="Crie sua conta"
      description="Cadastre somente seus dados de acesso. O perfil profissional será disponibilizado em uma próxima fase."
    >
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error rounded-2xl p-4 text-sm"
        >
          Não foi possível criar a conta. Revise os dados informados.
        </p>
      ) : null}
      {query.status === "check-email" ? (
        <p
          role="status"
          className="bg-mint text-brand-dark rounded-2xl p-4 text-sm font-semibold"
        >
          Verifique seu e-mail para confirmar a conta e continuar.
        </p>
      ) : null}

      <form action={candidateRegistrationAction} className="mt-5 space-y-5">
        <label className="text-ink block text-sm font-bold">
          Nome
          <input
            name="full_name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
            className="border-border-light focus:border-brand focus:ring-brand/15 mt-2 min-h-12 w-full rounded-xl border px-4 font-normal outline-none focus:ring-4"
          />
        </label>
        <label className="text-ink block text-sm font-bold">
          E-mail
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            className="border-border-light focus:border-brand focus:ring-brand/15 mt-2 min-h-12 w-full rounded-xl border px-4 font-normal outline-none focus:ring-4"
          />
        </label>
        <label className="text-ink block text-sm font-bold">
          Senha
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            className="border-border-light focus:border-brand focus:ring-brand/15 mt-2 min-h-12 w-full rounded-xl border px-4 font-normal outline-none focus:ring-4"
          />
        </label>
        <label className="text-ink block text-sm font-bold">
          Confirmar senha
          <input
            name="password_confirmation"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            className="border-border-light focus:border-brand focus:ring-brand/15 mt-2 min-h-12 w-full rounded-xl border px-4 font-normal outline-none focus:ring-4"
          />
        </label>
        <label className="text-muted flex items-start gap-3 text-sm leading-relaxed">
          <input
            name="accepted_terms"
            type="checkbox"
            required
            className="accent-brand mt-1 size-4 shrink-0"
          />
          <span>
            Li e aceito os{" "}
            <Link
              className="text-brand font-bold hover:underline"
              href="/termos-de-uso"
            >
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link
              className="text-brand font-bold hover:underline"
              href="/politica-de-privacidade"
            >
              Política de Privacidade
            </Link>
            .
          </span>
        </label>
        <button className="bg-brand hover:bg-brand-dark focus-visible:ring-tech min-h-12 w-full rounded-full px-5 font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
          Criar conta
        </button>
      </form>

      <p className="text-muted mt-6 text-center text-sm">
        Já tem uma conta?{" "}
        <Link
          className="text-brand font-bold hover:underline"
          href="/carreiras/entrar"
        >
          Entrar
        </Link>
      </p>
    </CareersAuthCard>
  );
}
