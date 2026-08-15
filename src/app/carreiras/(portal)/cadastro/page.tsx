import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { candidateRegistrationAction } from "@/app/carreiras/actions";
import { CareersAuthCard } from "@/components/careers/auth-card";
import { GoogleAuthForm } from "@/components/careers/google-auth-form";
import { ResendConfirmationForm } from "@/components/careers/resend-confirmation-form";
import { getCandidateSession } from "@/lib/careers/auth";
import {
  getCandidateResendAvailableAt,
  getPendingCandidateEmail,
} from "@/lib/careers/auth-pending";
import { isCandidateGoogleAuthEnabled } from "@/lib/careers/auth-providers";
import { safeCareersDestination } from "@/lib/careers/auth-validation";

export const metadata: Metadata = {
  title: "Criar conta | Carreiras INNEURO",
};

const errors: Record<string, string> = {
  google:
    "Não foi possível entrar com o Google. Tente novamente ou utilize seu e-mail.",
  config: "O cadastro está temporariamente indisponível.",
};

export default async function CandidateRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    status?: string;
    next?: string;
    resend?: string;
  }>;
}) {
  const [query, googleEnabled] = await Promise.all([
    searchParams,
    isCandidateGoogleAuthEnabled(),
  ]);
  const next = safeCareersDestination(query.next ?? null);
  const session = await getCandidateSession();
  if (session.user && session.account) redirect(next);
  const checkEmail = query.status === "check-email";
  const [pendingEmail, resendAvailableAt] = checkEmail
    ? await Promise.all([
        getPendingCandidateEmail(),
        getCandidateResendAvailableAt(),
      ])
    : [null, 0];

  return (
    <CareersAuthCard
      eyebrow="Carreiras INNEURO"
      title={checkEmail ? "Confirme seu e-mail" : "Crie sua conta"}
      description={
        checkEmail
          ? "Cadastro realizado. Agora confirme seu endereço de e-mail para acessar o perfil profissional."
          : "Crie seu acesso e depois complete seu perfil profissional com suas experiências, formação e currículo."
      }
    >
      {checkEmail ? (
        <div>
          <div className="bg-mint text-brand-dark rounded-3xl p-5 sm:p-6">
            <MailCheck aria-hidden="true" className="text-brand" size={32} />
            <h2 className="font-heading mt-4 text-xl font-semibold">
              Verifique sua caixa de entrada
            </h2>
            <p className="mt-3 text-sm leading-relaxed">
              Enviamos um link de confirmação para:
            </p>
            <p className="mt-1 font-bold break-all">
              {pendingEmail ?? "seu endereço de e-mail"}
            </p>
            <p className="mt-4 text-sm leading-relaxed">
              Não recebeu? Verifique também a caixa de spam.
            </p>
          </div>

          {query.resend === "sent" ? (
            <p
              role="status"
              className="bg-mint text-brand-dark mt-4 rounded-2xl p-4 text-sm font-semibold"
            >
              Novo e-mail enviado. Aguarde alguns instantes e verifique sua
              caixa de entrada.
            </p>
          ) : null}
          {query.resend === "wait" ? (
            <p
              role="status"
              className="bg-surface text-muted mt-4 rounded-2xl p-4 text-sm"
            >
              Aguarde o tempo indicado antes de solicitar outro envio.
            </p>
          ) : null}
          {query.resend === "error" ? (
            <p
              role="alert"
              className="bg-error/10 text-error mt-4 rounded-2xl p-4 text-sm"
            >
              Não foi possível reenviar agora. Tente novamente em alguns
              minutos.
            </p>
          ) : null}
          {query.resend === "expired" ? (
            <p
              role="alert"
              className="bg-error/10 text-error mt-4 rounded-2xl p-4 text-sm"
            >
              Esta solicitação expirou. Volte ao cadastro para iniciar
              novamente.
            </p>
          ) : null}

          {pendingEmail ? (
            <ResendConfirmationForm
              next={next}
              availableAt={resendAvailableAt}
            />
          ) : null}

          <Link
            href={`/carreiras/entrar?next=${encodeURIComponent(next)}`}
            className="border-border-light text-brand focus-visible:ring-tech hover:bg-surface mt-3 flex min-h-12 items-center justify-center rounded-full border px-5 font-bold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Voltar para entrar
          </Link>
        </div>
      ) : (
        <>
          {query.error ? (
            <p
              role="alert"
              className="bg-error/10 text-error rounded-2xl p-4 text-sm"
            >
              {errors[query.error] ??
                "Não foi possível criar a conta. Revise os dados informados."}
            </p>
          ) : null}

          {googleEnabled ? (
            <GoogleAuthForm
              next={next}
              source="cadastro"
              separatorLabel="ou cadastre-se com seu e-mail"
            />
          ) : null}

          <form action={candidateRegistrationAction} className="mt-5 space-y-5">
            <input type="hidden" name="next" value={next} />
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
              href={`/carreiras/entrar?next=${encodeURIComponent(next)}`}
            >
              Entrar
            </Link>
          </p>
        </>
      )}
    </CareersAuthCard>
  );
}
