import { KeyRound } from "lucide-react";
import { redirect } from "next/navigation";
import { changeRequiredPasswordAction } from "@/app/admin/actions";
import { getAdminSession } from "@/lib/cms/auth";

export default async function AdminPasswordSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getAdminSession();
  if (!session.user || !session.profile) redirect("/admin/login");
  if (!session.profile.active) redirect("/admin/login?error=inactive");
  if (!session.profile.must_change_password) redirect("/admin");
  const query = await searchParams;
  return (
    <main
      id="main-content"
      className="bg-brand-dark grid min-h-screen place-items-center p-5"
    >
      <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-10">
        <span className="bg-mint text-brand grid size-12 place-items-center rounded-2xl">
          <KeyRound aria-hidden="true" />
        </span>
        <p className="text-brand mt-6 text-xs font-bold tracking-[0.14em] uppercase">
          Primeiro acesso
        </p>
        <h1 className="font-heading text-brand-dark mt-2 text-3xl font-semibold">
          Defina sua senha
        </h1>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          Crie uma senha exclusiva para acessar a administração da INNEURO.
        </p>
        {query.error ? (
          <p
            role="alert"
            className="bg-error/10 text-error mt-5 rounded-xl p-3 text-sm"
          >
            {query.error === "validation"
              ? "Use pelo menos 8 caracteres e confirme a mesma senha."
              : "Não foi possível alterar a senha. Tente novamente."}
          </p>
        ) : null}
        <form action={changeRequiredPasswordAction} className="mt-7 space-y-5">
          <label className="block text-sm font-bold">
            Nova senha
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-4 font-normal"
            />
          </label>
          <label className="block text-sm font-bold">
            Confirmar nova senha
            <input
              name="password_confirmation"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-4 font-normal"
            />
          </label>
          <button className="bg-brand hover:bg-brand-dark min-h-12 w-full rounded-full px-5 font-bold text-white">
            Definir senha e acessar
          </button>
        </form>
      </section>
    </main>
  );
}
