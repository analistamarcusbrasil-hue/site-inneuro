import {
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  Database,
  Inbox,
  Users,
} from "lucide-react";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { requireHrAccess } from "@/lib/careers/hr-auth";

const futureCards = [
  { label: "Vagas abertas", icon: BriefcaseBusiness },
  { label: "Processos ativos", icon: ClipboardList },
  { label: "Novas candidaturas", icon: Inbox },
  { label: "Entrevistas", icon: CalendarClock },
  { label: "Banco de talentos", icon: Database },
] as const;

const roleLabels = {
  administrator: "Administrador",
  hr_manager: "Gestor de RH",
  reviewer: "Avaliador",
} as const;

export default async function HrDashboardPage() {
  const { supabase, hrRole } = await requireHrAccess();
  const canSeeCandidateTotal = hrRole !== "reviewer";
  const candidateResult = canSeeCandidateTotal
    ? await supabase
        .from("candidate_accounts")
        .select("id", { count: "exact", head: true })
    : null;
  const candidateCount = candidateResult?.error
    ? null
    : (candidateResult?.count ?? 0);

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Recrutamento"
        title="Gestão de carreiras"
        description="Ambiente interno para desenvolver e administrar o projeto Carreiras INNEURO com segurança, antes da liberação ao público."
      />

      <HrNavigation
        current="dashboard"
        canManageCandidates={canSeeCandidateTotal}
      />

      <section aria-labelledby="rh-overview-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="rh-overview-title"
              className="font-heading text-ink text-2xl font-semibold"
            >
              Visão geral
            </h2>
            <p className="text-muted mt-2 text-sm">
              Os indicadores serão preenchidos conforme os próximos módulos
              forem implementados.
            </p>
          </div>
          <span className="bg-mint text-brand-dark rounded-full px-4 py-2 text-xs font-bold">
            Acesso: {roleLabels[hrRole]}
          </span>
        </div>

        <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <li className="border-border-light rounded-3xl border bg-white p-6">
            <span className="bg-mint text-brand grid size-11 place-items-center rounded-2xl">
              <Users aria-hidden="true" size={21} />
            </span>
            <p className="text-muted mt-6 text-sm">Candidatos</p>
            {canSeeCandidateTotal ? (
              candidateCount === null ? (
                <p className="text-warning mt-2 text-sm font-bold">
                  Indicador temporariamente indisponível
                </p>
              ) : (
                <>
                  <p className="font-heading text-brand-dark mt-1 text-3xl font-semibold">
                    {candidateCount.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-muted mt-2 text-xs">
                    Conta(s) de candidato registrada(s)
                  </p>
                </>
              )
            ) : (
              <p className="text-muted mt-2 text-sm font-semibold">
                Acesso restrito aos candidatos autorizados futuramente
              </p>
            )}
          </li>

          {futureCards.map(({ label, icon: Icon }) => (
            <li
              key={label}
              className="border-border-light rounded-3xl border bg-white p-6"
            >
              <span className="bg-surface text-muted grid size-11 place-items-center rounded-2xl">
                <Icon aria-hidden="true" size={21} />
              </span>
              <p className="text-muted mt-6 text-sm">{label}</p>
              <p className="text-ink mt-2 font-bold">Em desenvolvimento</p>
              <p className="text-muted mt-2 text-xs">
                Nenhum dado fictício é exibido nesta fase.
              </p>
            </li>
          ))}
        </ul>
      </section>

      <aside className="border-brand/15 bg-mint/60 text-brand-dark mt-8 rounded-3xl border p-5 text-sm leading-relaxed">
        O portal público de candidatos continua desabilitado. Este ambiente é
        exclusivo para desenvolvimento e validação interna do RH.
      </aside>
    </>
  );
}
