/* eslint-disable @typescript-eslint/no-explicit-any -- shape de join dinâmico do Supabase. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { requireAdminPermission } from "@/lib/cms/auth";
import { getSurveyAdminContext } from "@/lib/surveys/server";

export default async function ResponseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireAdminPermission("surveys.view");
  const context = await getSurveyAdminContext(user.id);
  if (!context) notFound();
  const { id } = await params;
  const { data: response } = await context.admin
    .from("survey_responses")
    .select(
      "*,survey_answers(*,survey_question_versions(title,category,question_type),survey_question_options(label)),survey_feedback(*)",
    )
    .eq("id", id)
    .eq("organization_id", context.organization.id)
    .maybeSingle();
  if (!response || (context.unit && response.unit_id !== context.unit.id))
    notFound();
  const feedback = Array.isArray(response.survey_feedback)
    ? response.survey_feedback[0]
    : response.survey_feedback;
  return (
    <>
      <AdminPageHeading
        eyebrow="Resposta individual"
        title={
          response.critical ? "Avaliação crítica" : "Detalhes da avaliação"
        }
        description={new Date(response.completed_at).toLocaleString("pt-BR")}
      />
      <Link
        href="/admin/pesquisas/satisfacao/respostas"
        className="text-brand mb-6 inline-block font-bold"
      >
        ← Voltar às respostas
      </Link>
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="border-border-light rounded-3xl border bg-white p-6 lg:col-span-2">
          <h2 className="font-heading text-xl font-semibold">Respostas</h2>
          <dl className="mt-4 divide-y divide-slate-100">
            {(response.survey_answers ?? []).map(
              (answer: Record<string, any>) => (
                <div key={answer.id} className="py-4">
                  <dt className="font-bold">
                    {answer.survey_question_versions?.title}
                  </dt>
                  <dd className="mt-2 text-slate-600">
                    {answer.not_applicable
                      ? "Não se aplica"
                      : (answer.numeric_value ??
                        answer.text_value ??
                        (answer.option_value
                          ? JSON.stringify(answer.option_value).replace(
                              /[\[\]"]/g,
                              "",
                            )
                          : "—"))}
                  </dd>
                </div>
              ),
            )}
          </dl>
        </section>
        <aside className="space-y-5">
          <div className="rounded-3xl bg-emerald-950 p-6 text-white">
            <p className="text-sm text-emerald-200">Nota geral</p>
            <p className="font-heading mt-2 text-4xl font-semibold">
              {response.overall_score ?? "—"}
            </p>
            <p className="mt-4 text-sm">NPS: {response.nps_score ?? "—"}</p>
          </div>
          <div className="border-border-light rounded-3xl border bg-white p-6">
            <h2 className="font-bold">Feedback livre</h2>
            <p className="mt-3 text-sm whitespace-pre-wrap text-slate-600">
              {feedback?.text_content ?? "Sem texto."}
            </p>
            {feedback?.audio_storage_path ? (
              <audio
                controls
                preload="none"
                className="mt-4 w-full"
                src={`/api/admin/pesquisas/respostas/${response.id}/audio`}
              />
            ) : null}
          </div>
          {response.wants_contact ? (
            <div className="rounded-3xl bg-amber-50 p-6">
              <h2 className="font-bold">Retorno autorizado</h2>
              <p className="mt-2 text-sm">
                {response.contact_name ?? "Cliente"} ·{" "}
                {response.contact_phone ?? "telefone não informado"}
              </p>
              {response.contact_phone ? (
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={`https://wa.me/55${response.contact_phone.replace(/\D/g, "")}`}
                  className="mt-4 inline-block font-bold text-emerald-800"
                >
                  Abrir WhatsApp →
                </a>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
