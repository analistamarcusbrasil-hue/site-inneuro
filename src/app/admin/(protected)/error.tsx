"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { AdminButton } from "@/components/admin/ui";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section
      role="alert"
      aria-labelledby="admin-error-title"
      className="border-border-light mx-auto max-w-2xl rounded-2xl border bg-white p-6 sm:p-8"
    >
      <span className="bg-error/10 text-error grid size-11 place-items-center rounded-xl">
        <TriangleAlert aria-hidden="true" size={22} />
      </span>
      <h1
        id="admin-error-title"
        className="font-heading text-ink mt-5 text-2xl font-semibold"
      >
        Não foi possível carregar esta área
      </h1>
      <p className="text-muted mt-2 max-w-xl text-sm leading-6">
        Seus dados não foram alterados. Tente carregar novamente; se o problema
        continuar, retorne à visão geral e tente mais tarde.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <AdminButton onClick={reset}>
          <RotateCcw aria-hidden="true" size={17} />
          Tentar novamente
        </AdminButton>
        <AdminButton href="/admin" variant="outline">
          Voltar à visão geral
        </AdminButton>
      </div>
    </section>
  );
}
