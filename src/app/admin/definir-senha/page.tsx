import { KeyRound } from "lucide-react";
import { AdminPasswordSetup } from "@/components/admin/admin-password-setup";

export default function AdminPasswordSetupPage() {
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
        <AdminPasswordSetup />
      </section>
    </main>
  );
}
