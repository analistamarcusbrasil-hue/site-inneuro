import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  MessageSquareText,
  Star,
} from "lucide-react";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { SurveyNavigation } from "@/components/admin/survey-navigation";
import { SurveyOverviewCharts } from "@/components/admin/survey-charts";
import {
  AdminButton,
  AdminEmptyState,
  AdminMetricCard,
} from "@/components/admin/ui";
import {
  previousSurveyRange,
  surveyCategoryLabels,
  surveyDateRange,
} from "@/lib/surveys/logic";
import { getSurveyAdminContext, getSurveyMetrics } from "@/lib/surveys/server";
import type { SurveyPeriodPreset } from "@/lib/surveys/types";
import { requireAdminPermission } from "@/lib/cms/auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

const presets: Array<[SurveyPeriodPreset, string]> = [
  ["today", "Hoje"],
  ["7d", "Últimos 7 dias"],
  ["30d", "Últimos 30 dias"],
  ["month", "Este mês"],
  ["previous-month", "Mês anterior"],
  ["year", "Ano atual"],
  ["custom", "Personalizado"],
];

function variation(current: number | null, previous: number | null) {
  if (current === null || previous === null) return "Sem comparação anterior";
  const value = Math.round((current - previous) * 10) / 10;
  return `${value > 0 ? "↑" : value < 0 ? "↓" : "→"} ${Math.abs(value).toLocaleString("pt-BR")} vs período anterior`;
}

export default async function SurveyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    periodo?: string;
    inicio?: string;
    fim?: string;
    comparar?: string;
  }>;
}) {
  const { user, profile } = await requireAdminPermission("surveys.view");
  const context = await getSurveyAdminContext(user.id);
  if (!context)
    return (
      <p className="rounded-3xl bg-white p-8">
        O acesso à organização ainda não foi configurado.
      </p>
    );
  const query = await searchParams;
  const preset = presets.some(([value]) => value === query.periodo)
    ? (query.periodo as SurveyPeriodPreset)
    : "30d";
  const range = surveyDateRange(preset, query.inicio, query.fim);
  const previousRange = previousSurveyRange(range.start, range.exclusiveEnd);
  const [metrics, previous] = await Promise.all([
    getSurveyMetrics({
      organizationId: context.organization.id,
      unitId: context.unit?.id ?? null,
      start: range.start,
      exclusiveEnd: range.exclusiveEnd,
    }),
    getSurveyMetrics({
      organizationId: context.organization.id,
      unitId: context.unit?.id ?? null,
      start: previousRange.start,
      exclusiveEnd: previousRange.exclusiveEnd,
    }),
  ]);
  const compare = query.comparar === undefined ? true : query.comparar === "1";
  const nav = {
    canView: true,
    canManage: hasAdminPermission(profile, "surveys.manage"),
    canReports: hasAdminPermission(profile, "surveys.reports"),
    canQrCode: hasAdminPermission(profile, "surveys.qrcode"),
  };
  return (
    <>
      <AdminPageHeading
        eyebrow="Experiência e Pesquisas"
        title="Satisfação do Cliente"
        description="Indicadores reais da experiência na INNEURO, com comparação temporal e oportunidades de melhoria."
      />
      <SurveyNavigation current="dashboard" {...nav} />

      <form className="border-border-light mb-6 rounded-3xl border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1 text-sm font-bold">
            Período
            <select
              name="periodo"
              defaultValue={preset}
              className="border-border-light mt-2 min-h-11 w-full rounded-xl border bg-white px-3 font-normal"
            >
              {presets.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Data inicial
            <input
              name="inicio"
              type="date"
              defaultValue={query.inicio}
              className="border-border-light mt-2 block min-h-11 rounded-xl border px-3 font-normal"
            />
          </label>
          <label className="text-sm font-bold">
            Data final
            <input
              name="fim"
              type="date"
              defaultValue={query.fim}
              className="border-border-light mt-2 block min-h-11 rounded-xl border px-3 font-normal"
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-50 px-3 text-sm font-bold">
            <input
              type="checkbox"
              name="comparar"
              value="1"
              defaultChecked={compare}
            />
            Comparar período anterior
          </label>
          <AdminButton type="submit">Aplicar filtros</AdminButton>
        </div>
      </form>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-950 px-5 py-4 text-white">
        <div>
          <p className="text-xs font-bold tracking-widest text-emerald-200 uppercase">
            Recorte ativo
          </p>
          <p className="mt-1 font-bold">
            {context.organization.name} ·{" "}
            {context.unit?.name ?? "Todas as unidades"}
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold">
          {range.start.toLocaleDateString("pt-BR")} —{" "}
          {range.end.toLocaleDateString("pt-BR")}
        </span>
      </div>

      <ul className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {[
          {
            label: "Nota geral",
            value:
              metrics.overallScore === null
                ? "—"
                : `${Number(metrics.overallScore).toLocaleString("pt-BR")}/5`,
            description: compare
              ? variation(metrics.overallScore, previous.overallScore)
              : "Média das dimensões",
            Icon: Star,
          },
          {
            label: "NPS",
            value: metrics.nps === null ? "—" : String(metrics.nps),
            description: compare
              ? variation(metrics.nps, previous.nps)
              : "Promotores menos detratores",
            Icon: Gauge,
          },
          {
            label: "Respostas",
            value: metrics.responseCount.toLocaleString("pt-BR"),
            description: compare
              ? variation(metrics.responseCount, previous.responseCount)
              : "Avaliações concluídas",
            Icon: MessageSquareText,
          },
          {
            label: "Satisfação positiva",
            value:
              metrics.positiveRate === null ? "—" : `${metrics.positiveRate}%`,
            description: compare
              ? variation(metrics.positiveRate, previous.positiveRate)
              : "Notas 4 e 5",
            Icon: CheckCircle2,
          },
          {
            label: "Avaliações críticas",
            value: metrics.criticalCount.toLocaleString("pt-BR"),
            description: "Regra objetiva de atenção",
            Icon: AlertTriangle,
          },
          {
            label: "Taxa de conclusão",
            value:
              metrics.completion.rate === null
                ? "—"
                : `${metrics.completion.rate}%`,
            description: `${metrics.completion.completions} de ${metrics.completion.starts} inícios`,
            Icon: ClipboardCheck,
          },
        ].map(({ label, value, description, Icon }) => (
          <li key={label}>
            <AdminMetricCard
              label={label}
              value={value}
              description={description}
              icon={<Icon aria-hidden="true" size={19} />}
            />
          </li>
        ))}
      </ul>

      {!metrics.responseCount ? (
        <AdminEmptyState
          title="Ainda não recebemos avaliações neste período"
          description="O dashboard será preenchido automaticamente após as primeiras respostas pelo QR Code."
          action={
            nav.canQrCode ? (
              <AdminButton href="/admin/pesquisas/satisfacao/qrcode">
                Ver QR Code
              </AdminButton>
            ) : undefined
          }
        />
      ) : (
        <>
          <SurveyOverviewCharts metrics={metrics} />
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.dimensions.map((dimension) => (
              <Link
                key={dimension.category}
                href={`/admin/pesquisas/satisfacao/relatorios?dimensao=${dimension.category}&periodo=${preset}`}
                className="border-border-light rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-500"
              >
                <p className="text-sm font-bold text-slate-700">
                  {surveyCategoryLabels[dimension.category] ??
                    dimension.category}
                </p>
                <div className="mt-3 flex items-end justify-between">
                  <p className="font-heading text-brand-dark text-3xl font-semibold">
                    {Number(dimension.average).toLocaleString("pt-BR")}
                  </p>
                  <span className="text-xs text-slate-500">
                    {dimension.response_count} respostas
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{
                      width: `${(Number(dimension.average) / 5) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-brand mt-4 inline-block text-xs font-bold">
                  Analisar dimensão →
                </span>
              </Link>
            ))}
          </section>
        </>
      )}
    </>
  );
}
