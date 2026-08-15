import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import type { CompanyUnit } from "@/lib/careers/logistics";
import { brazilianStates } from "@/lib/careers/profile-validation";
import { saveCompanyUnitAction, toggleCompanyUnitAction } from "./actions";

const inputClass =
  "border-border-light focus:border-brand mt-2 min-h-11 w-full rounded-xl border bg-white px-4 font-normal outline-none";

function UnitFields({ unit }: { unit?: CompanyUnit }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {unit ? <input type="hidden" name="id" value={unit.id} /> : null}
      <label className="text-ink text-sm font-bold">
        Nome da unidade
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={unit?.name ?? ""}
          className={inputClass}
        />
      </label>
      <label className="text-ink text-sm font-bold">
        Endereço comercial
        <input
          name="address"
          required
          minLength={2}
          maxLength={200}
          defaultValue={unit?.address ?? ""}
          className={inputClass}
        />
      </label>
      <label className="text-ink text-sm font-bold">
        Bairro
        <input
          name="neighborhood"
          required
          minLength={2}
          maxLength={120}
          defaultValue={unit?.neighborhood ?? ""}
          className={inputClass}
        />
      </label>
      <label className="text-ink text-sm font-bold">
        Cidade
        <input
          name="city"
          required
          minLength={2}
          maxLength={100}
          defaultValue={unit?.city ?? ""}
          className={inputClass}
        />
      </label>
      <label className="text-ink text-sm font-bold">
        UF
        <select
          name="state"
          required
          defaultValue={unit?.state ?? "AP"}
          className={inputClass}
        >
          {brazilianStates.map((state) => (
            <option key={state}>{state}</option>
          ))}
        </select>
      </label>
      <label className="text-ink text-sm font-bold">
        CEP opcional
        <input
          name="postal_code"
          inputMode="numeric"
          maxLength={9}
          placeholder="00000-000"
          defaultValue={unit?.postal_code ?? ""}
          className={inputClass}
        />
      </label>
    </div>
  );
}

export default async function CompanyUnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { supabase } = await requireHrAccess("jobs:manage");
  const { data, error } = await supabase
    .from("company_units")
    .select("*")
    .order("active", { ascending: false })
    .order("name", { ascending: true });
  const units = (data as CompanyUnit[] | null) ?? [];
  const query = await searchParams;

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Recrutamento"
        title="Unidades da INNEURO"
        description="Centralize os locais operacionais usados nas vagas presenciais e híbridas."
      />
      <HrNavigation current="jobs" canManageJobs canManageCandidates />
      <div className="mb-6">
        <Link
          href="/admin/rh/vagas"
          className="text-brand text-sm font-bold hover:underline"
        >
          Voltar para vagas
        </Link>
      </div>
      {query.status ? (
        <p
          role="status"
          className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          Unidade atualizada com sucesso.
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          {query.error === "in-use"
            ? "Esta unidade possui vaga publicada e não pode ser desativada."
            : "Não foi possível salvar a unidade. Revise os campos."}
        </p>
      ) : null}

      <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-7">
        <h2 className="font-heading text-brand-dark text-xl font-semibold">
          Cadastrar unidade
        </h2>
        <form action={saveCompanyUnitAction} className="mt-5">
          <UnitFields />
          <button className="bg-brand hover:bg-brand-dark mt-5 min-h-11 rounded-full px-6 text-sm font-bold text-white">
            Cadastrar unidade
          </button>
        </form>
      </section>

      <section className="mt-7" aria-labelledby="units-list-title">
        <h2
          id="units-list-title"
          className="font-heading text-ink text-2xl font-semibold"
        >
          Unidades cadastradas
        </h2>
        {error ? (
          <p className="text-error mt-4 text-sm font-bold">
            Não foi possível carregar as unidades.
          </p>
        ) : units.length ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            {units.map((unit) => (
              <article
                key={unit.id}
                className="border-border-light rounded-3xl border bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-heading text-brand-dark text-xl font-semibold">
                    {unit.name}
                  </h3>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${unit.active ? "bg-mint text-brand-dark" : "bg-surface text-muted"}`}
                  >
                    {unit.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <form action={saveCompanyUnitAction} className="mt-5">
                  <UnitFields unit={unit} />
                  <button className="border-brand/30 text-brand-dark mt-5 min-h-10 rounded-full border px-5 text-sm font-bold">
                    Salvar alterações
                  </button>
                </form>
                <div className="border-border-light mt-5 border-t pt-4">
                  <ConfirmCommandForm
                    action={toggleCompanyUnitAction}
                    message={`${unit.active ? "Desativar" : "Ativar"} esta unidade?`}
                  >
                    <input type="hidden" name="id" value={unit.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={String(!unit.active)}
                    />
                    <button className="text-warning text-sm font-bold hover:underline">
                      {unit.active ? "Desativar unidade" : "Ativar unidade"}
                    </button>
                  </ConfirmCommandForm>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="border-border-light mt-5 rounded-3xl border bg-white p-8 text-center">
            <p className="text-ink font-bold">Nenhuma unidade cadastrada.</p>
            <p className="text-muted mt-2 text-sm">
              Cadastre somente dados operacionais oficiais.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
