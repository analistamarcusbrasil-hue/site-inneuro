import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  calculateCandidateProfileCompletion,
  type CandidateProfessionalProfile,
} from "@/lib/careers/profile";

type CandidateAccountRow = {
  id: string;
  full_name: string;
  created_at: string;
};

type CandidateRelationRow = { candidate_id: string };

function countByCandidate(rows: CandidateRelationRow[] | null) {
  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    counts.set(row.candidate_id, (counts.get(row.candidate_id) ?? 0) + 1);
  }
  return counts;
}

export default async function HrCandidatesPage() {
  const { supabase } = await requireHrAccess("candidates:manage");
  const [
    accountsResult,
    profilesResult,
    experiencesResult,
    educationResult,
    skillsResult,
    resumesResult,
    applicationsResult,
  ] = await Promise.all([
    supabase
      .from("candidate_accounts")
      .select("id, full_name, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("candidate_profiles").select("*"),
    supabase.from("candidate_experiences").select("candidate_id"),
    supabase.from("candidate_education").select("candidate_id"),
    supabase.from("candidate_skills").select("candidate_id"),
    supabase.from("candidate_resumes").select("candidate_id"),
    supabase.from("career_job_applications").select("candidate_id"),
  ]);

  const accounts = (accountsResult.data as CandidateAccountRow[] | null) ?? [];
  const profiles =
    (profilesResult.data as CandidateProfessionalProfile[] | null) ?? [];
  const profilesByCandidate = new Map(
    profiles.map((profile) => [profile.candidate_id, profile]),
  );
  const experienceCounts = countByCandidate(experiencesResult.data);
  const educationCounts = countByCandidate(educationResult.data);
  const skillCounts = countByCandidate(skillsResult.data);
  const resumeCounts = countByCandidate(resumesResult.data);
  const applicationCounts = countByCandidate(applicationsResult.data);

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Recrutamento"
        title="Candidatos"
        description="Consulte os perfis profissionais cadastrados. As informações são autodeclaradas e não representam avaliação ou score."
      />
      <HrNavigation current="candidates" canManageJobs canManageCandidates />

      {accountsResult.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error rounded-2xl p-5 font-bold"
        >
          Não foi possível carregar os candidatos.
        </p>
      ) : accounts.length ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {accounts.map((account) => {
            const profile = profilesByCandidate.get(account.id) ?? null;
            const completion = calculateCandidateProfileCompletion({
              fullName: account.full_name,
              emailPresent: true,
              profile,
              experienceCount: experienceCounts.get(account.id) ?? 0,
              educationCount: educationCounts.get(account.id) ?? 0,
              skillCount: skillCounts.get(account.id) ?? 0,
              resumeCount: resumeCounts.get(account.id) ?? 0,
            });
            return (
              <li key={account.id}>
                <Link
                  href={`/admin/rh/candidatos/${account.id}`}
                  className="border-border-light hover:border-brand group block rounded-3xl border bg-white p-6 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-heading text-brand-dark text-xl font-semibold">
                        {account.full_name}
                      </h2>
                      <p className="text-muted mt-2 text-sm">
                        {[profile?.city, profile?.state]
                          .filter(Boolean)
                          .join("/") || "Localização não informada"}
                      </p>
                    </div>
                    <span className="bg-mint text-brand-dark rounded-full px-3 py-1 text-xs font-bold">
                      {completion}% preenchido
                    </span>
                  </div>
                  <div className="text-muted mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <span>
                      {experienceCounts.get(account.id) ?? 0} experiência(s)
                    </span>
                    <span>
                      {educationCounts.get(account.id) ?? 0} formação(ões)
                    </span>
                    <span>
                      {skillCounts.get(account.id) ?? 0} habilidade(s)
                    </span>
                    <span>
                      {applicationCounts.get(account.id) ?? 0} candidatura(s)
                    </span>
                  </div>
                  <p className="text-brand mt-5 text-sm font-bold group-hover:underline">
                    Abrir perfil
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="border-border-light rounded-3xl border bg-white p-8 text-center">
          <h2 className="font-heading text-brand-dark text-xl font-semibold">
            Nenhum candidato cadastrado
          </h2>
          <p className="text-muted mt-2 text-sm">
            Os perfis aparecerão aqui quando o portal for liberado e houver
            cadastros.
          </p>
        </div>
      )}
    </>
  );
}
