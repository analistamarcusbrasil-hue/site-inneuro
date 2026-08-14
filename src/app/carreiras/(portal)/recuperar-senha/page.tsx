import type { Metadata } from "next";
import Link from "next/link";
import {
  candidateRequestPasswordAction,
  candidateUpdatePasswordAction,
} from "@/app/carreiras/actions";
import { CareersAuthCard } from "@/components/careers/auth-card";
import { getCandidateSession } from "@/lib/careers/auth";

export const metadata: Metadata = {
  title: "Recuperar senha | Carreiras INNEURO",
};

export default async function CandidateRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    error?: string;
    status?: string;
  }>;
}) {
  const query = await searchParams;
  const session = await getCandidateSession();
  const updating = query.mode === "update" && Boolean(session.user);

  return (
    <CareersAuthCard
      eyebrow="Carreiras INNEURO"
      title={updating ? "Crie uma nova senha" : "Recupere sua senha"}
      description={
        updating
          ? "Escolha uma nova senha para sua conta de candidato."
          : "Informe seu e-mail para receber as instruções de recuperação."
      }
    >
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error rounded-2xl p-4 text-sm"
        >
          Não foi possível concluir esta solicitação. Tente novamente.
        </p>
      ) : null}
      {query.status === "check-email" ? (
        <p
          role="status"
          className="bg-mint text-brand-dark rounded-2xl p-4 text-sm font-semibold"
        >
          Se o endereço estiver cadastrado, você receberá as instruções por
          e-mail.
        </p>
      ) : null}

      {updating ? (
        <form action={candidateUpdatePasswordAction} className="mt-5 space-y-5">
          <label className="text-ink block text-sm font-bold">
            Nova senha
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
            Confirmar nova senha
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
          <button className="bg-brand hover:bg-brand-dark focus-visible:ring-tech min-h-12 w-full rounded-full px-5 font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
            Salvar nova senha
          </button>
        </form>
      ) : (
        <form
          action={candidateRequestPasswordAction}
          className="mt-5 space-y-5"
        >
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
          <button className="bg-brand hover:bg-brand-dark focus-visible:ring-tech min-h-12 w-full rounded-full px-5 font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
            Enviar instruções
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm">
        <Link
          className="text-brand font-bold hover:underline"
          href="/carreiras/entrar"
        >
          Voltar para entrar
        </Link>
      </p>
    </CareersAuthCard>
  );
}
