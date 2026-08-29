"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function SurveySnapshotButton({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Regenerar este fechamento? A ação será auditada."))
          return;
        setBusy(true);
        const response = await fetch("/api/admin/pesquisas/snapshots", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ year, month }),
        });
        setBusy(false);
        if (response.ok) router.refresh();
        else window.alert("Não foi possível regenerar o fechamento.");
      }}
      className="rounded-full bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 disabled:opacity-50"
    >
      {busy ? "Regenerando…" : "Regenerar"}
    </button>
  );
}
