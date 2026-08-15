"use client";

import { candidateGoogleLoginAction } from "@/app/carreiras/actions";
import { useFormStatus } from "react-dom";

function GoogleSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="border-border-light text-ink focus-visible:ring-tech hover:bg-surface flex min-h-12 w-full items-center justify-center gap-3 rounded-full border bg-white px-5 font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
    >
      <span
        aria-hidden="true"
        className="grid size-6 place-items-center rounded-full bg-white text-base font-bold text-[#4285f4] shadow-sm"
      >
        G
      </span>
      {pending ? "Conectando ao Google..." : "Continuar com Google"}
    </button>
  );
}

export function GoogleAuthForm({
  next,
  source,
  separatorLabel = "ou",
}: {
  next: string;
  source: "entrar" | "cadastro";
  separatorLabel?: string;
}) {
  return (
    <>
      <form action={candidateGoogleLoginAction} className="mt-5">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="auth_source" value={source} />
        <GoogleSubmitButton />
      </form>

      <div className="text-muted my-6 flex items-center gap-3 text-xs">
        <span className="bg-border-light h-px flex-1" />
        <span>{separatorLabel}</span>
        <span className="bg-border-light h-px flex-1" />
      </div>
    </>
  );
}
