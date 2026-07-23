"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AccessState = "checking" | "ready" | "invalid" | "saving" | "saved";

export function AdminPasswordSetup() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function prepareSession() {
      if (!supabase) {
        if (active) setAccessState("invalid");
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type") as EmailOtpType | null;

      if (url.searchParams.get("error")) {
        if (active) setAccessState("invalid");
        return;
      }

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else if (tokenHash && type) {
        await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      }

      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error || !data.session) {
        setAccessState("invalid");
        return;
      }

      window.history.replaceState({}, "", window.location.pathname);
      setAccessState("ready");
    }

    void prepareSession();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || accessState !== "ready") return;

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("password_confirmation") ?? "");

    if (password.length < 8) {
      setMessage("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setMessage("As senhas informadas não são iguais.");
      return;
    }

    setMessage("");
    setAccessState("saving");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage("Não foi possível definir a senha. Solicite um novo link.");
      setAccessState("ready");
      return;
    }

    setAccessState("saved");
    window.location.assign("/admin");
  }

  if (accessState === "checking") {
    return <p role="status">Validando seu link de acesso…</p>;
  }

  if (accessState === "invalid") {
    return (
      <div>
        <p
          role="alert"
          className="bg-error/10 text-error rounded-xl p-4 text-sm"
        >
          Este link expirou ou não é válido. Solicite um novo convite de acesso.
        </p>
        <Link
          href="/admin/login"
          className="border-brand text-brand mt-6 inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-bold"
        >
          Voltar ao login
        </Link>
      </div>
    );
  }

  if (accessState === "saved") {
    return <p role="status">Senha definida. Abrindo o painel…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-5">
      {message ? (
        <p
          role="alert"
          className="bg-error/10 text-error rounded-xl p-3 text-sm"
        >
          {message}
        </p>
      ) : null}
      <label className="block text-sm font-bold">
        Nova senha
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
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
          required
          className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-4 font-normal"
        />
      </label>
      <button
        disabled={accessState === "saving"}
        className="bg-brand hover:bg-brand-dark min-h-12 w-full rounded-full px-5 font-bold text-white disabled:opacity-60"
      >
        {accessState === "saving" ? "Salvando…" : "Definir senha e acessar"}
      </button>
    </form>
  );
}
