import { saveSchedulingSettingsAction } from "@/app/admin/actions";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { requireAdmin } from "@/lib/cms/auth";
import {
  parseSchedulingSettings,
  schedulingDayOptions,
  schedulingPeriodOptions,
} from "@/lib/scheduling/settings";

export default async function SchedulingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { supabase, profile } = await requireAdmin();
  const { data } = await supabase
    .from("site_settings")
    .select("value,updated_at")
    .eq("key", "scheduling")
    .maybeSingle();
  const settings = parseSchedulingSettings(data?.value);
  const canSave = profile.role !== "editor";
  return (
    <>
      <AdminPageHeading
        eyebrow="Agendamento"
        title="Horários de realização dos exames"
        description="Esta é a fonte única usada no site e no formulário. Não informe horários da recepção ou dos canais administrativos nesta área."
      />
      {query.success ? (
        <p
          role="status"
          className="bg-mint text-brand mb-6 rounded-xl p-4 font-bold"
        >
          Horários atualizados no site.
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-xl p-4 font-bold"
        >
          Revise os dias, períodos e textos antes de salvar.
        </p>
      ) : null}
      <form action={saveSchedulingSettingsAction} className="space-y-6">
        <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-7">
          <h2 className="font-heading text-xl font-semibold">
            Dias disponíveis
          </h2>
          <p className="text-muted mt-2 text-sm">
            Marque os dias em que exames podem ser realizados mediante
            confirmação.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {schedulingDayOptions.map(([value, label]) => (
              <label
                key={value}
                className="border-border-light flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold"
              >
                <input
                  type="checkbox"
                  name="days"
                  value={value}
                  defaultChecked={settings.days.includes(value)}
                  className="text-brand focus:ring-tech h-5 w-5 rounded"
                />
                {label}
              </label>
            ))}
          </div>
        </section>
        <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-7">
          <h2 className="font-heading text-xl font-semibold">
            Períodos disponíveis
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {schedulingPeriodOptions.map(([value, label]) => (
              <label
                key={value}
                className="border-border-light flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold"
              >
                <input
                  type="checkbox"
                  name="periods"
                  value={value}
                  defaultChecked={settings.periods.includes(value)}
                  className="text-brand focus:ring-tech h-5 w-5 rounded"
                />
                {label}
              </label>
            ))}
          </div>
        </section>
        <section className="border-border-light grid gap-5 rounded-3xl border bg-white p-5 sm:p-7">
          <label className="text-sm font-bold">
            Texto público principal
            <textarea
              name="public_text"
              rows={3}
              maxLength={300}
              required
              defaultValue={settings.publicText}
              className="border-border-light mt-2 w-full rounded-xl border px-4 py-3 font-normal"
            />
            <span className="text-muted mt-1 block text-xs font-normal">
              Aparece nas páginas e no formulário. Recomendado: até 300
              caracteres.
            </span>
          </label>
          <label className="text-sm font-bold">
            Texto curto
            <input
              name="short_text"
              maxLength={160}
              required
              defaultValue={settings.shortText}
              className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-4 font-normal"
            />
            <span className="text-muted mt-1 block text-xs font-normal">
              Usado em espaços compactos, como o rodapé. Até 160 caracteres.
            </span>
          </label>
          <label className="text-sm font-bold">
            Observação
            <textarea
              name="note"
              rows={3}
              maxLength={240}
              required
              defaultValue={settings.note}
              className="border-border-light mt-2 w-full rounded-xl border px-4 py-3 font-normal"
            />
            <span className="text-muted mt-1 block text-xs font-normal">
              Explique que a equipe ainda confirmará data e horário.
            </span>
          </label>
          <label className="border-warning/30 flex items-start gap-3 rounded-xl border p-4 text-sm font-semibold">
            <input
              type="checkbox"
              name="sus_authorization_required"
              defaultChecked={settings.susAuthorizationRequired}
              className="text-brand focus:ring-tech mt-0.5 h-5 w-5 rounded"
            />
            <span>
              Exigir a autorização da regulação no envio pelo SUS
              <span className="text-muted mt-1 block font-normal">
                Se desmarcado, o paciente poderá registrar a autorização como
                pendente.
              </span>
            </span>
          </label>
          {data?.updated_at ? (
            <p className="text-muted text-xs">
              Última alteração:{" "}
              {new Date(data.updated_at).toLocaleString("pt-BR")}
            </p>
          ) : null}
        </section>
        {canSave ? (
          <button className="bg-brand min-h-12 rounded-full px-6 text-sm font-bold text-white">
            Salvar e atualizar o site
          </button>
        ) : (
          <p className="text-warning rounded-xl bg-white p-4 text-sm font-bold">
            Sua conta pode visualizar, mas não alterar esta configuração.
          </p>
        )}
      </form>
    </>
  );
}
