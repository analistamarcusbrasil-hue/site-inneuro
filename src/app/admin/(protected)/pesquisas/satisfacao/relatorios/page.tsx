import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import {
  SurveyNavigation,
  surveyNavigationPermissions,
} from "@/components/admin/survey-navigation";
import { SurveyOverviewCharts } from "@/components/admin/survey-charts";
import { SurveySnapshotButton } from "@/components/admin/survey-snapshot-button";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { requireAdminPermission } from "@/lib/cms/auth";
import { getSurveyAdminContext, getSurveyMetrics } from "@/lib/surveys/server";
import { surveyDateRange, surveyCategoryLabels } from "@/lib/surveys/logic";
import type { SurveyPeriodPreset } from "@/lib/surveys/types";
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; dimensao?: string }>;
}) {
  const { user, profile } = await requireAdminPermission("surveys.reports");
  const context = await getSurveyAdminContext(user.id);
  if (!context) return <p>Acesso não configurado.</p>;
  const query = await searchParams;
  const preset = (query.periodo ?? "30d") as SurveyPeriodPreset;
  const range = surveyDateRange(preset);
  const metrics = await getSurveyMetrics({
    organizationId: context.organization.id,
    unitId: context.unit?.id ?? null,
    start: range.start,
    exclusiveEnd: range.exclusiveEnd,
  });
  const selected = metrics.dimensions.find(
    (item) => item.category === query.dimensao,
  );
  const { data: snapshots } = await context.admin
    .from("survey_monthly_snapshots")
    .select("id,year,month,response_count,generated_at")
    .eq("organization_id", context.organization.id)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(12);
  return (
    <>
      <AdminPageHeading
        eyebrow="Satisfação do Cliente"
        title="Relatórios executivos"
        description="Visão consolidada, exportações e snapshots mensais auditáveis."
      />
      <SurveyNavigation
        current="reports"
        {...surveyNavigationPermissions(profile)}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5">
        <div>
          <p className="font-bold">
            {range.start.toLocaleDateString("pt-BR")} —{" "}
            {range.end.toLocaleDateString("pt-BR")}
          </p>
          <p className="text-sm text-slate-500">
            {metrics.responseCount} avaliações concluídas
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href={`/api/admin/pesquisas/exportar?formato=pdf&periodo=${preset}`}
            className="bg-brand rounded-full px-5 py-3 text-sm font-bold text-white"
          >
            Exportar PDF
          </a>
          <a
            href={`/api/admin/pesquisas/exportar?formato=xlsx&periodo=${preset}`}
            className="rounded-full bg-slate-100 px-5 py-3 text-sm font-bold"
          >
            Exportar Excel
          </a>
        </div>
      </div>
      {selected ? (
        <section className="mb-6 rounded-3xl bg-emerald-950 p-6 text-white">
          <p className="text-sm text-emerald-200">Detalhamento</p>
          <h2 className="font-heading mt-2 text-2xl font-semibold">
            {surveyCategoryLabels[selected.category] ?? selected.category}
          </h2>
          <p className="mt-3">
            Média {selected.average}/5 em {selected.response_count} respostas.
          </p>
          <div className="mt-5 grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((score) => (
              <div
                key={score}
                className="rounded-xl bg-white/10 p-3 text-center"
              >
                <strong>{score}</strong>
                <br />
                <span className="text-xs">
                  {selected.distribution[String(score)] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <SurveyOverviewCharts metrics={metrics} />
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-white p-6">
          <h2 className="font-heading text-xl font-semibold">Pontos fortes</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {metrics.dimensions
              .filter((item) => item.average >= 4)
              .slice(0, 5)
              .map((item) => (
                <li key={item.category}>
                  • {surveyCategoryLabels[item.category] ?? item.category}:{" "}
                  {item.average}/5
                </li>
              ))}
          </ul>
        </div>
        <div className="rounded-3xl bg-white p-6">
          <h2 className="font-heading text-xl font-semibold">
            Pontos de atenção
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {metrics.dimensions
              .filter((item) => item.average < 4)
              .slice(0, 5)
              .map((item) => (
                <li key={item.category}>
                  • {surveyCategoryLabels[item.category] ?? item.category}:{" "}
                  {item.average}/5
                </li>
              ))}
          </ul>
        </div>
      </section>
      <section className="border-border-light mt-6 rounded-3xl border bg-white p-6">
        <h2 className="font-heading text-brand-dark text-2xl font-semibold">
          Fechamentos mensais
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Snapshots preservados com métricas e versões das perguntas.
        </p>
        <div className="mt-5 divide-y divide-slate-100">
          {(snapshots ?? []).map((snapshot) => (
            <div
              key={snapshot.id}
              className="flex flex-wrap items-center gap-3 py-4"
            >
              <div className="flex-1">
                <p className="font-bold">
                  {new Intl.DateTimeFormat("pt-BR", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(
                    new Date(Date.UTC(snapshot.year, snapshot.month - 1, 1)),
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {snapshot.response_count} avaliações · gerado em{" "}
                  {new Date(snapshot.generated_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <a
                href={`/api/admin/pesquisas/exportar?formato=pdf&snapshot=${snapshot.id}`}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold"
              >
                Exportar PDF
              </a>
              {hasAdminPermission(profile, "surveys.admin") ? (
                <SurveySnapshotButton
                  year={snapshot.year}
                  month={snapshot.month}
                />
              ) : null}
            </div>
          ))}
          {!snapshots?.length ? (
            <p className="py-7 text-center text-sm text-slate-500">
              O primeiro fechamento será gerado automaticamente no início do
              próximo mês.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
