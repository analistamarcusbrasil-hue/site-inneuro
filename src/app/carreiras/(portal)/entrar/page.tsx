import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { candidateLoginAction } from "@/app/carreiras/actions";
import { CareersAuthCard } from "@/components/careers/auth-card";
import { getCandidateSession } from "@/lib/careers/auth";
import { safeCareersDestination } from "@/lib/careers/auth-validation";

export const metadata: Metadata = { title: "Entrar | Carreiras INNEURO" };

const messages: Record<string, string> = {
  invalid: "Revise o e-mail e a senha informados.",
  credentials: "E-mail ou senha inválidos.",
  config: "O acesso está temporariamente indisponível.",
  session: "Entre novamente para acessar sua área privada.",
  "not-candidate": "Esta conta não está vinculada ao portal de candidatos.",
  account: "Não foi possível preparar sua conta de candidato.",
};

const statuses: Record<string, string> = {
  "password-updated": "Senha atualizada. Entre com sua nova senha.",
  "signed-out": "Você saiu da sua conta com segurança.",
};

export default async function CandidateLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string; next?: string }>;
}) {
  const query = await searchParams;
  const next = safeCareersDestination(query.next ?? null);
  const session = await getCandidateSession();
  if (session.user && session.account) redirect(next);

  return (
    <CareersAuthCard
      eyebrow="Carreiras INNEURO"
      title="Acesse sua conta"
      description="Entre para acessar sua área privada de candidato."
    >
      {query.error && messages[query.error] ? (
        <p
          role="alert"
          className="bg-error/10 text-error rounded-2xl p-4 text-sm"
        >
          {messages[query.error]}
        </p>
      ) : null}
      {query.status && statuses[query.status] ? (
        <p
          role="status"
          className="bg-mint text-brand-dark rounded-2xl p-4 text-sm font-semibold"
        >
          {statuses[query.status]}
        </p>
      ) : null}

      <form action={candidateLoginAction} className="space-y-5">
        <input type="hidden" name="next" value={next} />
        <label className="text-ink block text-sm font-bold">
          E-mail
          <input
            name="email"
            type="email"
            autoComplete="username"
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
            autoComplete="current-password"
            required
            minLength={8}
            maxLength={72}
            className="border-border-light focus:border-brand focus:ring-brand/15 mt-2 min-h-12 w-full rounded-xl border px-4 font-normal outline-none focus:ring-4"
          />
        </label>
        <button className="bg-brand hover:bg-brand-dark focus-visible:ring-tech min-h-12 w-full rounded-full px-5 font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
          Entrar
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-3 text-sm sm:flex-row sm:justify-between">
        <Link
          className="text-brand font-bold hover:underline"
          href={`/carreiras/cadastro?next=${encodeURIComponent(next)}`}
        >
          Criar conta
        </Link>
        <Link
          className="text-brand font-bold hover:underline"
          href="/carreiras/recuperar-senha"
        >
          Esqueci minha senha
        </Link>
      </div>
    </CareersAuthCard>
  );
}
