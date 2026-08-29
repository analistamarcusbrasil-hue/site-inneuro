import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import {
  SurveyNavigation,
  surveyNavigationPermissions,
} from "@/components/admin/survey-navigation";
import { requireAdminPermission } from "@/lib/cms/auth";
import { getSurveyAdminContext } from "@/lib/surveys/server";

export default async function ResponsesPage({
  searchParams,
}: {
  searchParams: Promise<{
    pagina?: string;
    critica?: string;
    busca?: string;
    inicio?: string;
    fim?: string;
    nota?: string;
    nps?: string;
    comentario?: string;
    audio?: string;
    contato?: string;
  }>;
}) {
  const { user, profile } = await requireAdminPermission("surveys.view");
  const context = await getSurveyAdminContext(user.id);
  if (!context) return <p>Acesso não configurado.</p>;
  const query = await searchParams;
  const page = Math.max(1, Number(query.pagina) || 1);
  const from = (page - 1) * 25;
  let builder = context.admin
    .from("survey_responses")
    .select(
      "id,completed_at,overall_score,nps_score,critical,wants_contact,contact_name,contact_phone,survey_feedback(text_content,audio_storage_path)",
      { count: "exact" },
    )
    .eq("organization_id", context.organization.id)
    .eq("status", "COMPLETED")
    .order("completed_at", { ascending: false })
    .range(from, from + 24);
  if (context.unit) builder = builder.eq("unit_id", context.unit.id);
  if (query.critica === "1") builder = builder.eq("critical", true);
  if (query.inicio)
    builder = builder.gte("completed_at", `${query.inicio}T00:00:00-03:00`);
  if (query.fim)
    builder = builder.lt("completed_at", `${query.fim}T23:59:59.999-03:00`);
  if (query.nota) builder = builder.eq("overall_score", Number(query.nota));
  if (query.nps === "promotores") builder = builder.gte("nps_score", 9);
  if (query.nps === "neutros")
    builder = builder.gte("nps_score", 7).lte("nps_score", 8);
  if (query.nps === "detratores") builder = builder.lte("nps_score", 6);
  if (query.contato === "1") builder = builder.eq("wants_contact", true);
  if (query.comentario === "1")
    builder = builder.not("survey_feedback.text_content", "is", null);
  if (query.audio === "1")
    builder = builder.not("survey_feedback.audio_storage_path", "is", null);
  if (query.busca)
    builder = builder.or(
      `contact_name.ilike.%${query.busca.replace(/[%_,()]/g, "")}%,contact_phone.ilike.%${query.busca.replace(/[%_,()]/g, "")}%`,
    );
  const { data, count } = await builder;
  return (
    <>
      <AdminPageHeading
        eyebrow="Satisfação do Cliente"
        title="Respostas"
        description="Avaliações individuais, feedbacks e registros críticos."
      />
      <SurveyNavigation
        current="responses"
        {...surveyNavigationPermissions(profile)}
      />
      <form className="mb-5 grid gap-3 rounded-3xl bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
        <input
          name="busca"
          defaultValue={query.busca}
          placeholder="Buscar nome ou telefone"
          className="border-border-light min-h-11 rounded-xl border px-3 md:col-span-2"
        />
        <input
          type="date"
          name="inicio"
          defaultValue={query.inicio}
          aria-label="Data inicial"
          className="border-border-light min-h-11 rounded-xl border px-3"
        />
        <input
          type="date"
          name="fim"
          defaultValue={query.fim}
          aria-label="Data final"
          className="border-border-light min-h-11 rounded-xl border px-3"
        />
        <select
          name="nota"
          defaultValue={query.nota ?? ""}
          aria-label="Nota geral"
          className="border-border-light min-h-11 rounded-xl border px-3"
        >
          <option value="">Todas as notas</option>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              Nota {value}
            </option>
          ))}
        </select>
        <select
          name="nps"
          defaultValue={query.nps ?? ""}
          aria-label="Grupo NPS"
          className="border-border-light min-h-11 rounded-xl border px-3"
        >
          <option value="">Todo NPS</option>
          <option value="promotores">Promotores</option>
          <option value="neutros">Neutros</option>
          <option value="detratores">Detratores</option>
        </select>
        <label className="flex items-center gap-2 px-3 text-sm font-bold">
          <input
            type="checkbox"
            name="critica"
            value="1"
            defaultChecked={query.critica === "1"}
          />
          Somente críticas
        </label>
        <label className="flex items-center gap-2 px-3 text-sm font-bold">
          <input
            type="checkbox"
            name="comentario"
            value="1"
            defaultChecked={query.comentario === "1"}
          />
          Com comentário
        </label>
        <label className="flex items-center gap-2 px-3 text-sm font-bold">
          <input
            type="checkbox"
            name="audio"
            value="1"
            defaultChecked={query.audio === "1"}
          />
          Com áudio
        </label>
        <label className="flex items-center gap-2 px-3 text-sm font-bold">
          <input
            type="checkbox"
            name="contato"
            value="1"
            defaultChecked={query.contato === "1"}
          />
          Contato solicitado
        </label>
        <button className="bg-brand rounded-full px-6 font-bold text-white">
          Filtrar
        </button>
      </form>
      <div className="border-border-light overflow-x-auto rounded-3xl border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="p-4">Data</th>
              <th className="p-4">Nota</th>
              <th className="p-4">NPS</th>
              <th className="p-4">Feedback</th>
              <th className="p-4">Status</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => {
              const feedback = Array.isArray(row.survey_feedback)
                ? row.survey_feedback[0]
                : row.survey_feedback;
              return (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="p-4">
                    {new Date(row.completed_at!).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-4 font-bold">
                    {row.overall_score ? `${row.overall_score}/5` : "—"}
                  </td>
                  <td className="p-4">{row.nps_score ?? "—"}</td>
                  <td className="max-w-sm p-4">
                    <p className="line-clamp-2">
                      {feedback?.text_content ??
                        (feedback?.audio_storage_path
                          ? "Feedback em áudio"
                          : "—")}
                    </p>
                  </td>
                  <td className="p-4">
                    {row.critical ? (
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                        Crítica
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        Regular
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/admin/pesquisas/satisfacao/respostas/${row.id}`}
                      className="text-brand font-bold"
                    >
                      Detalhes →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!data?.length ? (
          <p className="p-8 text-center text-slate-500">
            Nenhuma resposta encontrada.
          </p>
        ) : null}
      </div>
      <div className="mt-5 flex justify-between text-sm">
        <span>{count ?? 0} respostas</span>
        <div className="flex gap-3">
          {page > 1 ? (
            <Link href={`?pagina=${page - 1}`} className="font-bold">
              ← Anterior
            </Link>
          ) : null}
          {from + 25 < (count ?? 0) ? (
            <Link href={`?pagina=${page + 1}`} className="font-bold">
              Próxima →
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
