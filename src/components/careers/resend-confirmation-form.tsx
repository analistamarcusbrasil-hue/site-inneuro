"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { candidateResendConfirmationAction } from "@/app/carreiras/actions";

function ResendButton({ remaining }: { remaining: number }) {
  const { pending } = useFormStatus();
  const disabled = pending || remaining > 0;
  const label = pending
    ? "Reenviando..."
    : remaining > 0
      ? `Reenviar em ${remaining}s`
      : "Reenviar e-mail";

  return (
    <button
      type="submit"
      disabled={disabled}
      className="bg-brand hover:bg-brand-dark focus-visible:ring-tech min-h-12 w-full rounded-full px-5 font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55"
    >
      {label}
    </button>
  );
}

export function ResendConfirmationForm({
  next,
  availableAt,
}: {
  next: string;
  availableAt: number;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((availableAt - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((availableAt - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [availableAt, remaining]);

  return (
    <form action={candidateResendConfirmationAction} className="mt-6">
      <input type="hidden" name="next" value={next} />
      <ResendButton remaining={remaining} />
    </form>
  );
}
