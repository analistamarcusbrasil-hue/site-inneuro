import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { SurveyNavigation, surveyNavigationPermissions } from "@/components/admin/survey-navigation";
import { requireAdminPermission } from "@/lib/cms/auth";
import { getSurveyAdminContext, getSurveyMetrics } from "@/lib/surveys/server";
import {
  buildSurveyPriorities,
  previousSurveyRange,
  surveyDateRange,
  surveyCategoryLabels,
} from "@/lib/surveys/logic";
export default async function PrioritiesPage() {
  const { user, profile } = await requireAdminPermission("surveys.reports");
  const context = await getSurveyAdminContext(user.id);
  if (!context) return <p>Acesso não configurado.</p>;
  const range = surveyDateRange("30d");
  const priorRange = previousSurveyRange(range.start, range.exclusiveEnd);
  const [metrics, prior] = await Promise.all([
    getSurveyMetrics({
      organizationId: context.organization.id,
      unitId: context.unit?.id ?? null,
      start: range.start,
      exclusiveEnd: range.exclusiveEnd,
    }),
    getSurveyMetrics({
      organizationId: context.organization.id,
      unitId: context.unit?.id ?? null,
      start: priorRange.start,
      exclusiveEnd: priorRange.exclusiveEnd,
    }),
  ]);
  const list = buildSurveyPriorities(metrics, prior);
  return (
    <>
      <AdminPageHeading
        eyebrow="Satisfação do Cliente"
        title="Prioridades de melhoria"
        description="Ranking determinístico por baixa nota, avaliações negativas e tendência; não utiliza IA nem presume causalidade."
      />
      <SurveyNavigation
        current="priorities"
        {...surveyNavigationPermissions(profile)}
      />
      <div className="space-y-3">
        {list.map((item, index) => (
          <section
            key={item.category}
            className="border-border-light flex flex-wrap items-center gap-5 rounded-3xl border bg-white p-5"
          >
            <span className="bg-brand grid size-12 place-items-center rounded-2xl font-bold text-white">
              {index + 1}
            </span>
            <div className="min-w-56 flex-1">
              <h2 className="font-bold">
                {surveyCategoryLabels[item.category] ?? item.category}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Média {item.current}/5 · {item.negativeCount} negativas ·
                tendência {item.trend.toLowerCase()}
              </p>
            </div>
            <div className="w-48">
              <div className="h-3 rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full bg-amber-500"
                  style={{ width: `${item.score}%` }}
                />
              </div>
              <p className="mt-2 text-right text-xs font-bold">
                Prioridade {item.score}/100
              </p>
            </div>
          </section>
        ))}
        {!list.length ? (
          <p className="rounded-3xl bg-white p-8 text-center text-slate-500">
            Sem dados suficientes nos últimos 30 dias.
          </p>
        ) : null}
      </div>
    </>
  );
}
