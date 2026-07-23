import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { ConfigurationPending } from "@/components/admin/configuration-pending";
import { isCmsConfigured } from "@/lib/cms/config";
import { getAdminSession } from "@/lib/cms/auth";
import { loginAction } from "@/app/admin/actions";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isCmsConfigured) return <ConfigurationPending />;
  const { user } = await getAdminSession();
  if (user) redirect("/admin");
  const query = await searchParams;
  return (
    <main
      id="main-content"
      className="bg-brand-dark grid min-h-screen place-items-center p-5"
    >
      <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-10">
        <span className="bg-mint text-brand grid size-12 place-items-center rounded-2xl">
          <LockKeyhole aria-hidden="true" />
        </span>
        <p className="text-brand mt-6 text-xs font-bold tracking-[0.14em] uppercase">
          Acesso restrito
        </p>
        <h1 className="font-heading text-brand-dark mt-2 text-3xl font-semibold">
          Painel administrativo
        </h1>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          Use somente a conta convidada pela administração da INNEURO.
        </p>
        {query.error ? (
          <p
            role="alert"
            className="bg-error/10 text-error mt-5 rounded-xl p-3 text-sm"
          >
            Não foi possível entrar. Verifique os dados informados.
          </p>
        ) : null}
        <form action={loginAction} className="mt-7 space-y-5">
          <label className="block text-sm font-bold">
            E-mail
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-4 font-normal"
            />
          </label>
          <label className="block text-sm font-bold">
            Senha
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              required
              className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-4 font-normal"
            />
          </label>
          <button className="bg-brand hover:bg-brand-dark min-h-12 w-full rounded-full px-5 font-bold text-white">
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
