import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  formatTalentPoolUpdate,
  matchesTalentPoolFilters,
  type TalentPoolArea,
  type TalentPoolFilters,
  type TalentPoolMembership,
  type TalentPoolSearchRecord,
} from "@/lib/careers/talent-pool";
import { talentPoolFiltersSchema } from "@/lib/careers/talent-pool-validation";
import { fulfillTalentPoolDeletionAction } from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type CandidateAccountRow = { id: string; full_name: string };
type CandidateProfileRow = {
  candidate_id: string;
  city: string | null;
  state: string | null;
  professional_objective: string | null;
  about: string | null;
  availability: string | null;
};
type CandidateTextRow = { candidate_id: string; [key: string]: unknown };
type InterestRow = {
  candidate_id: string;
  area_id: string;
  area: { name: string } | null;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function valuesByCandidate(
  rows: CandidateTextRow[] | null,
  render: (row: CandidateTextRow) => string,
) {
  const result = new Map<string, string[]>();
  for (const row of rows ?? []) {
    const current = result.get(row.candidate_id) ?? [];
    current.push(render(row));
    result.set(row.candidate_id, current);
  }
  return result;
}

function FilterField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <label className="text-ink text-sm font-bold">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        className="border-border-light focus:border-brand mt-2 min-h-11 w-full rounded-xl border bg-white px-3 font-normal outline-none"
      />
    </label>
  );
}

export default async function HrTalentPoolPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase } = await requireHrAccess("talent-bank:manage");
  const raw = await searchParams;
  const parsedFilters = talentPoolFiltersSchema.safeParse({
    query: first(raw.q),
    areaId: first(raw.area),
    city: first(raw.city),
    state: first(raw.uf),
    education: first(raw.formacao),
    experience: first(raw.experiencia),
    skill: first(raw.habilidade),
    certification: first(raw.certificacao),
    availability: first(raw.disponibilidade),
    updatedWithin: first(raw.atualizado),
  });
  const data = parsedFilters.success
    ? parsedFilters.data
    : talentPoolFiltersSchema.parse({});
  const filters: TalentPoolFilters = {
    query: data.query,
    areaId: data.areaId,
    city: data.city,
    state: data.state,
    education: data.education,
    experience: data.experience,
    skill: data.skill,
    certification: data.certification,
    availability: data.availability,
    updatedWithinDays: data.updatedWithin ? Number(data.updatedWithin) : null,
  };

  const [membershipsResult, areasResult] = await Promise.all([
    supabase
      .from("career_talent_pool_memberships")
      .select("*")
      .in("status", ["active", "deletion_requested"])
      .order("professional_updated_at", { ascending: false }),
    supabase
      .from("career_job_areas")
      .select("id, name, slug, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);
  const memberships =
    (membershipsResult.data as TalentPoolMembership[] | null) ?? [];
  const activeMemberships = memberships.filter(
    (membership) => membership.status === "active",
  );
  const deletionRequests = memberships.filter(
    (membership) => membership.status === "deletion_requested",
  );
  const candidateIds = memberships.map((membership) => membership.candidate_id);

  const empty = { data: [] as unknown[], error: null };
  const [
    accountsResult,
    profilesResult,
    interestsResult,
    experiencesResult,
    educationResult,
    skillsResult,
    certificationsResult,
    resumesResult,
  ] = candidateIds.length
    ? await Promise.all([
        supabase
          .from("candidate_accounts")
          .select("id, full_name")
          .in("id", candidateIds),
        supabase
          .from("candidate_profiles")
          .select(
            "candidate_id, city, state, professional_objective, about, availability",
          )
          .in("candidate_id", candidateIds),
        supabase
          .from("career_talent_pool_interests")
          .select("candidate_id, area_id, area:career_job_areas(name)")
          .in("candidate_id", candidateIds),
        supabase
          .from("candidate_experiences")
          .select("candidate_id, company, job_title, activities")
          .in("candidate_id", candidateIds),
        supabase
          .from("candidate_education")
          .select("candidate_id, education_level, course, institution")
          .in("candidate_id", candidateIds),
        supabase
          .from("candidate_skills")
          .select("candidate_id, name")
          .in("candidate_id", candidateIds),
        supabase
          .from("candidate_certifications")
          .select("candidate_id, name, institution")
          .in("candidate_id", candidateIds),
        supabase
          .from("candidate_resumes")
          .select("candidate_id")
          .in("candidate_id", candidateIds),
      ])
    : [empty, empty, empty, empty, empty, empty, empty, empty];

  const accounts = (accountsResult.data as CandidateAccountRow[]) ?? [];
  const profiles = (profilesResult.data as CandidateProfileRow[]) ?? [];
  const interests = (interestsResult.data as unknown as InterestRow[]) ?? [];
  const accountsById = new Map(accounts.map((item) => [item.id, item]));
  const profilesById = new Map(
    profiles.map((item) => [item.candidate_id, item]),
  );
  const interestsById = new Map<string, InterestRow[]>();
  for (const interest of interests) {
    interestsById.set(interest.candidate_id, [
      ...(interestsById.get(interest.candidate_id) ?? []),
      interest,
    ]);
  }
  const experiencesById = valuesByCandidate(
    experiencesResult.data as CandidateTextRow[] | null,
    (item) =>
      `${item.job_title ?? ""} ${item.company ?? ""} ${item.activities ?? ""}`,
  );
  const educationById = valuesByCandidate(
    educationResult.data as CandidateTextRow[] | null,
    (item) =>
      `${item.education_level ?? ""} ${item.course ?? ""} ${item.institution ?? ""}`,
  );
  const skillsById = valuesByCandidate(
    skillsResult.data as CandidateTextRow[] | null,
    (item) => String(item.name ?? ""),
  );
  const certificationsById = valuesByCandidate(
    certificationsResult.data as CandidateTextRow[] | null,
    (item) => `${item.name ?? ""} ${item.institution ?? ""}`,
  );
  const resumeCandidateIds = new Set(
    ((resumesResult.data as CandidateTextRow[] | null) ?? []).map(
      (item) => item.candidate_id,
    ),
  );

  const records = activeMemberships
    .map((membership): TalentPoolSearchRecord | null => {
      const account = accountsById.get(membership.candidate_id);
      if (!account) return null;
      const profile = profilesById.get(membership.candidate_id);
      const candidateInterests =
        interestsById.get(membership.candidate_id) ?? [];
      return {
        candidateId: membership.candidate_id,
        fullName: account.full_name,
        city: profile?.city ?? "",
        state: profile?.state ?? "",
        objective: profile?.professional_objective ?? "",
        about: profile?.about ?? "",
        availability: profile?.availability ?? "",
        areaIds: candidateInterests.map((item) => item.area_id),
        areaNames: candidateInterests
          .map((item) => item.area?.name ?? "")
          .filter(Boolean),
        education: educationById.get(membership.candidate_id) ?? [],
        experiences: experiencesById.get(membership.candidate_id) ?? [],
        skills: skillsById.get(membership.candidate_id) ?? [],
        certifications: certificationsById.get(membership.candidate_id) ?? [],
        professionalUpdatedAt: membership.professional_updated_at,
      };
    })
    .filter((record): record is TalentPoolSearchRecord => Boolean(record))
    .filter((record) => matchesTalentPoolFilters(record, filters));
  const areas = (areasResult.data as TalentPoolArea[] | null) ?? [];

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Recrutamento"
        title="Banco de Talentos"
        description="Consulte somente candidatos que aceitaram participar. Os filtros consideram informações profissionais autodeclaradas."
      />
      <HrNavigation current="talent" canManageJobs canManageCandidates />

      {first(raw.status) === "deletion-completed" ? (
        <p
          role="status"
          className="bg-success/10 text-success mb-5 rounded-2xl p-4 font-bold"
        >
          Solicitação concluída. A participação foi excluída do Banco de
          Talentos.
        </p>
      ) : null}
      {first(raw.error) === "deletion" ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-5 rounded-2xl p-4 font-bold"
        >
          Não foi possível concluir a solicitação de exclusão.
        </p>
      ) : null}

      {deletionRequests.length ? (
        <section
          className="border-warning/30 bg-warning/5 mb-6 rounded-3xl border p-5"
          aria-labelledby="deletion-title"
        >
          <h2
            id="deletion-title"
            className="font-heading text-ink text-xl font-semibold"
          >
            Solicitações de exclusão
          </h2>
          <ul className="mt-4 grid gap-3">
            {deletionRequests.map((membership) => (
              <li
                key={membership.candidate_id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4"
              >
                <div>
                  <p className="text-ink font-bold">
                    {accountsById.get(membership.candidate_id)?.full_name ??
                      "Candidato"}
                  </p>
                  <p className="text-muted mt-1 text-xs">
                    Solicitada em{" "}
                    {formatTalentPoolUpdate(
                      membership.deletion_requested_at ?? membership.updated_at,
                    )}
                  </p>
                </div>
                <ConfirmCommandForm
                  action={fulfillTalentPoolDeletionAction}
                  message="Concluir a exclusão da participação deste candidato no Banco de Talentos? A conta e as candidaturas serão preservadas."
                >
                  <input
                    type="hidden"
                    name="candidate_id"
                    value={membership.candidate_id}
                  />
                  <button className="text-error min-h-10 rounded-full px-4 text-sm font-bold hover:underline">
                    Concluir exclusão
                  </button>
                </ConfirmCommandForm>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form
        method="get"
        className="border-border-light mb-6 rounded-3xl border bg-white p-5"
      >
        <h2 className="font-heading text-brand-dark text-xl font-semibold">
          Filtros profissionais
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FilterField
            label="Busca profissional"
            name="q"
            defaultValue={filters.query}
          />
          <label className="text-ink text-sm font-bold">
            Área de interesse
            <select
              name="area"
              defaultValue={filters.areaId}
              className="border-border-light focus:border-brand mt-2 min-h-11 w-full rounded-xl border bg-white px-3 font-normal outline-none"
            >
              <option value="">Todas</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>
          <FilterField label="Cidade" name="city" defaultValue={filters.city} />
          <FilterField label="UF" name="uf" defaultValue={filters.state} />
          <FilterField
            label="Formação"
            name="formacao"
            defaultValue={filters.education}
          />
          <FilterField
            label="Experiência"
            name="experiencia"
            defaultValue={filters.experience}
          />
          <FilterField
            label="Habilidade"
            name="habilidade"
            defaultValue={filters.skill}
          />
          <FilterField
            label="Certificação"
            name="certificacao"
            defaultValue={filters.certification}
          />
          <FilterField
            label="Disponibilidade"
            name="disponibilidade"
            defaultValue={filters.availability}
          />
          <label className="text-ink text-sm font-bold">
            Última atualização
            <select
              name="atualizado"
              defaultValue={data.updatedWithin}
              className="border-border-light focus:border-brand mt-2 min-h-11 w-full rounded-xl border bg-white px-3 font-normal outline-none"
            >
              <option value="">Qualquer data</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Último ano</option>
            </select>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="bg-brand hover:bg-brand-dark min-h-11 rounded-full px-6 text-sm font-bold text-white">
            Filtrar
          </button>
          <Link
            href="/admin/rh/talentos"
            className="border-border-light text-ink hover:border-brand inline-flex min-h-11 items-center rounded-full border px-6 text-sm font-bold"
          >
            Limpar filtros
          </Link>
        </div>
        <p className="text-muted mt-4 text-xs">
          A busca não utiliza características pessoais protegidas.
        </p>
      </form>

      {membershipsResult.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error rounded-2xl p-5 font-bold"
        >
          Não foi possível carregar o Banco de Talentos.
        </p>
      ) : records.length ? (
        <section aria-labelledby="results-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2
              id="results-title"
              className="font-heading text-ink text-xl font-semibold"
            >
              Talentos encontrados
            </h2>
            <span className="bg-mint text-brand-dark rounded-full px-4 py-2 text-xs font-bold">
              {records.length.toLocaleString("pt-BR")}
            </span>
          </div>
          <ul className="grid gap-4 lg:grid-cols-2">
            {records.map((record) => (
              <li key={record.candidateId}>
                <Link
                  href={`/admin/rh/talentos/${record.candidateId}`}
                  className="border-border-light hover:border-brand group block h-full rounded-3xl border bg-white p-6 transition-colors"
                >
                  <h3 className="font-heading text-brand-dark text-xl font-semibold">
                    {record.fullName}
                  </h3>
                  <p className="text-muted mt-2 text-sm">
                    {[record.city, record.state].filter(Boolean).join("/") ||
                      "Localização não informada"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {record.areaNames.map((area) => (
                      <span
                        key={area}
                        className="bg-mint text-brand-dark rounded-full px-3 py-1 text-xs font-bold"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                  <p className="text-muted mt-4 line-clamp-2 text-sm">
                    {record.objective || "Objetivo profissional não informado"}
                  </p>
                  <p className="text-muted mt-4 text-xs">
                    Atualizado em{" "}
                    {formatTalentPoolUpdate(record.professionalUpdatedAt)} ·{" "}
                    {resumeCandidateIds.has(record.candidateId)
                      ? "Currículo disponível"
                      : "Sem currículo"}
                  </p>
                  <p className="text-brand mt-4 text-sm font-bold group-hover:underline">
                    Abrir perfil do talento
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="border-border-light rounded-3xl border bg-white p-8 text-center">
          <h2 className="font-heading text-brand-dark text-xl font-semibold">
            Nenhum talento encontrado
          </h2>
          <p className="text-muted mt-2 text-sm">
            Ajuste os filtros ou aguarde novas adesões voluntárias.
          </p>
        </div>
      )}
    </>
  );
}
