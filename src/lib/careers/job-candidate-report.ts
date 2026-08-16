import {
  careerApplicationSnapshotSchema,
  type ApplicationStatus,
  type CareerJobApplication,
} from "@/lib/careers/applications";
import {
  calculateMatchInformationCoverage,
  getMatchAdherenceBand,
  matchResultSchema,
  type ExplainableMatchResult,
  type MatchAdherenceBand,
} from "@/lib/careers/matching";

type ReportApplication = Pick<
  CareerJobApplication,
  | "id"
  | "candidate_id"
  | "candidate_stage"
  | "profile_snapshot"
  | "submitted_at"
  | "status"
>;

type ReportMatchRun = {
  application_id: string;
  overall_score: number;
  result: unknown;
  calculated_at: string;
};

type ReportResume = {
  id: string;
  candidate_id: string;
  version: number;
};

export type JobCandidateReportRow = {
  applicationId: string;
  candidateId: string;
  name: string;
  education: string;
  hasEducation: boolean;
  relevantExperience: string;
  hasCustomerServiceExperience: boolean;
  hasSimilarRoleExperience: boolean;
  availability: string;
  skills: string[];
  status: ApplicationStatus;
  stage: CareerJobApplication["candidate_stage"];
  submittedAt: string;
  resumeId: string | null;
  match: ExplainableMatchResult | null;
  matchScore: number | null;
  informationCoverage: number;
  band: MatchAdherenceBand;
};

export type JobCandidateReportFilters = {
  sort?: "match" | "date" | "name";
  education?: "informed" | "not_identified";
  customerService?: "yes" | "not_identified";
  similarRole?: "yes" | "not_identified";
  stage?: CareerJobApplication["candidate_stage"];
};

const customerServicePattern =
  /atendimento(?: ao p[uú]blico| presencial| ao cliente)?|recep[cç][aã]o|paciente|cliente|usu[aá]rio/i;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function roleTokens(value: string) {
  return normalize(value)
    .split(/\s+/)
    .filter(
      (token) =>
        token.length > 3 &&
        !["vaga", "para", "cadastro", "reserva"].includes(token),
    );
}

const educationRank: Record<string, number> = {
  "Ensino fundamental": 1,
  "Ensino médio": 2,
  "Curso técnico": 3,
  Graduação: 4,
  "Pós-graduação": 5,
  Mestrado: 6,
  Doutorado: 7,
};

export function buildJobCandidateReportRows({
  applications,
  matchRuns,
  resumes,
  jobTitle,
}: {
  applications: ReportApplication[];
  matchRuns: ReportMatchRun[];
  resumes: ReportResume[];
  jobTitle: string;
}) {
  const latestMatch = new Map<string, ReportMatchRun>();
  for (const run of [...matchRuns].sort((a, b) =>
    b.calculated_at.localeCompare(a.calculated_at),
  )) {
    if (!latestMatch.has(run.application_id))
      latestMatch.set(run.application_id, run);
  }
  const latestResume = new Map<string, ReportResume>();
  for (const resume of [...resumes].sort((a, b) => b.version - a.version)) {
    if (!latestResume.has(resume.candidate_id))
      latestResume.set(resume.candidate_id, resume);
  }
  const targetRoleTokens = roleTokens(jobTitle);

  return applications.flatMap((application): JobCandidateReportRow[] => {
    const snapshot = careerApplicationSnapshotSchema.safeParse(
      application.profile_snapshot,
    );
    if (!snapshot.success) return [];
    const run = latestMatch.get(application.id) ?? null;
    const parsedMatch = run ? matchResultSchema.safeParse(run.result) : null;
    const match = parsedMatch?.success ? parsedMatch.data : null;
    const education = [...snapshot.data.education].sort(
      (a, b) =>
        (educationRank[b.education_level] ?? 0) -
        (educationRank[a.education_level] ?? 0),
    )[0];
    const experienceText = snapshot.data.experiences
      .map((item) => `${item.job_title} ${item.company} ${item.activities}`)
      .join(" ");
    const hasSimilarRoleExperience = snapshot.data.experiences.some((item) => {
      const informed = new Set(roleTokens(item.job_title));
      return targetRoleTokens.some((token) => informed.has(token));
    });
    const relatedItem = match?.items.find(
      (item) => item.key === "related_experience",
    );
    const relevantExperience = relatedItem?.evidence[0]?.text
      ? relatedItem.evidence[0].text
      : snapshot.data.experiences[0]
        ? `${snapshot.data.experiences[0].job_title} — ${snapshot.data.experiences[0].company}`
        : "Não identificado";
    const score = match?.overallScore ?? run?.overall_score ?? null;
    const informationCoverage = match
      ? calculateMatchInformationCoverage(match.items)
      : 0;
    return [
      {
        applicationId: application.id,
        candidateId: application.candidate_id,
        name: snapshot.data.candidate.full_name,
        education: education
          ? `${education.education_level} — ${education.course}`
          : "Não identificado",
        hasEducation: Boolean(education),
        relevantExperience,
        hasCustomerServiceExperience:
          customerServicePattern.test(experienceText),
        hasSimilarRoleExperience,
        availability:
          snapshot.data.profile?.availability?.trim() || "Não identificado",
        skills: snapshot.data.skills.slice(0, 5),
        status: application.status,
        stage: application.candidate_stage,
        submittedAt: application.submitted_at,
        resumeId: latestResume.get(application.candidate_id)?.id ?? null,
        match,
        matchScore: score,
        informationCoverage,
        band: getMatchAdherenceBand(score, informationCoverage),
      },
    ];
  });
}

export function filterAndSortJobCandidateReport(
  rows: JobCandidateReportRow[],
  filters: JobCandidateReportFilters,
) {
  const filtered = rows.filter((row) => {
    if (filters.education === "informed" && !row.hasEducation) return false;
    if (filters.education === "not_identified" && row.hasEducation)
      return false;
    if (filters.customerService === "yes" && !row.hasCustomerServiceExperience)
      return false;
    if (
      filters.customerService === "not_identified" &&
      row.hasCustomerServiceExperience
    )
      return false;
    if (filters.similarRole === "yes" && !row.hasSimilarRoleExperience)
      return false;
    if (
      filters.similarRole === "not_identified" &&
      row.hasSimilarRoleExperience
    )
      return false;
    return !filters.stage || row.stage === filters.stage;
  });
  return filtered.sort((a, b) => {
    if (filters.sort === "name") return a.name.localeCompare(b.name, "pt-BR");
    if (filters.sort === "match")
      return (b.matchScore ?? -1) - (a.matchScore ?? -1);
    return b.submittedAt.localeCompare(a.submittedAt);
  });
}

export function summarizeJobCandidateReport(rows: JobCandidateReportRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary.total += 1;
      summary[row.band] += 1;
      return summary;
    },
    { total: 0, high: 0, intermediate: 0, review: 0 },
  );
}
