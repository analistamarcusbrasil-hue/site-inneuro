import { z } from "zod";
import type { CareerApplicationSnapshot } from "@/lib/careers/applications";
import type { CareerJob } from "@/lib/careers/jobs";

export const matchCriterionKeys = [
  "related_experience",
  "technical_skills",
  "education",
  "sector_experience",
  "certifications",
  "availability",
] as const;

export type MatchCriterionKey = (typeof matchCriterionKeys)[number];

export const matchCriterionLabels: Record<MatchCriterionKey, string> = {
  related_experience: "Experiência relacionada",
  technical_skills: "Competências técnicas",
  education: "Formação",
  sector_experience: "Experiência no setor",
  certifications: "Certificações",
  availability: "Disponibilidade",
};

export const defaultMatchCriteria = [
  {
    key: "related_experience",
    label: matchCriterionLabels.related_experience,
    weight: 25,
  },
  {
    key: "technical_skills",
    label: matchCriterionLabels.technical_skills,
    weight: 25,
  },
  { key: "education", label: matchCriterionLabels.education, weight: 15 },
  {
    key: "sector_experience",
    label: matchCriterionLabels.sector_experience,
    weight: 15,
  },
  {
    key: "certifications",
    label: matchCriterionLabels.certifications,
    weight: 10,
  },
  { key: "availability", label: matchCriterionLabels.availability, weight: 10 },
] satisfies MatchMatrixCriterion[];

export type MatchMatrixCriterion = {
  key: MatchCriterionKey;
  label: string;
  weight: number;
};

export const matchMatrixCriteriaSchema = z
  .array(
    z.object({
      key: z.enum(matchCriterionKeys),
      label: z.string().trim().min(3).max(120),
      weight: z.number().int().min(0).max(100),
    }),
  )
  .length(matchCriterionKeys.length)
  .superRefine((criteria, context) => {
    if (
      new Set(criteria.map((criterion) => criterion.key)).size !==
      matchCriterionKeys.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Os critérios devem ser únicos.",
      });
    }
    if (
      criteria.reduce((total, criterion) => total + criterion.weight, 0) !== 100
    ) {
      context.addIssue({
        code: "custom",
        message: "Os pesos devem totalizar 100%.",
      });
    }
  });

export const matchEvidenceSchema = z.object({
  source: z.string().max(120),
  text: z.string().max(500),
});

export const matchResultItemSchema = z.object({
  key: z.enum(matchCriterionKeys),
  label: z.string().max(120),
  weight: z.number().int().min(0).max(100),
  status: z.enum(["attended", "not_informed", "requires_validation"]),
  score: z.number().int().min(0).max(100),
  weightedScore: z.number().min(0).max(100),
  evidence: z.array(matchEvidenceSchema).max(5),
  pointsToVerify: z.array(z.string().max(500)).max(5),
});

export const matchResultSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  hardSkillsScore: z.number().int().min(0).max(100),
  items: z.array(matchResultItemSchema).length(matchCriterionKeys.length),
  sourcePolicy: z.literal("confirmed_application_snapshot"),
});

export type ExplainableMatchResult = z.infer<typeof matchResultSchema>;
export type MatchResultItem = z.infer<typeof matchResultItemSchema>;

export const matchStatusLabels: Record<MatchResultItem["status"], string> = {
  attended: "Atendido",
  not_informed: "Não informado",
  requires_validation: "Requer validação",
};

const stopWords = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "como",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "entre",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "ou",
  "para",
  "por",
  "que",
  "se",
  "um",
  "uma",
  "ter",
  "ser",
  "atuacao",
  "experiencia",
]);

const officialRegistrationPattern =
  /\b(crm|rqe|coren|crp|crefito|crf|registro profissional)\b/i;

export function normalizeMatchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string) {
  return [
    ...new Set(
      normalizeMatchText(value)
        .split(/\s+/)
        .filter((token) => token.length > 2 && !stopWords.has(token)),
    ),
  ];
}

type SourceEntry = { source: string; text: string };

function sourceEntries(
  snapshot: CareerApplicationSnapshot,
  key: MatchCriterionKey,
): SourceEntry[] {
  if (key === "related_experience" || key === "sector_experience") {
    return snapshot.experiences.map((item, index) => ({
      source: `Experiência ${index + 1}`,
      text: `${item.job_title} — ${item.company}. ${item.activities}`,
    }));
  }
  if (key === "technical_skills") {
    return snapshot.skills.map((skill) => ({
      source: "Habilidade confirmada",
      text: skill,
    }));
  }
  if (key === "education") {
    return snapshot.education.map((item, index) => ({
      source: `Formação ${index + 1}`,
      text: `${item.education_level} — ${item.course}, ${item.institution}`,
    }));
  }
  if (key === "certifications") {
    return snapshot.certifications.map((item, index) => ({
      source: `Certificação ${index + 1}`,
      text: `${item.name} — ${item.institution}`,
    }));
  }
  return snapshot.profile?.availability
    ? [
        {
          source: "Disponibilidade confirmada",
          text: snapshot.profile.availability,
        },
      ]
    : [];
}

function targetText(job: CareerJob, key: MatchCriterionKey) {
  if (key === "related_experience")
    return `${job.desirable_experience ?? ""} ${job.activities} ${job.required_requirements}`;
  if (key === "technical_skills")
    return `${job.skills} ${job.required_requirements}`;
  if (key === "education") return job.schooling;
  if (key === "sector_experience")
    return `${job.area?.name ?? ""} ${job.description}`;
  if (key === "certifications") return job.certifications ?? "";
  return `${job.work_schedule ?? ""} ${job.work_mode} ${job.location}`;
}

function overlapScore(target: string, sources: SourceEntry[]) {
  const targetTokens = tokens(target);
  if (!targetTokens.length || !sources.length) return 0;
  const sourceTokens = new Set(
    tokens(sources.map((entry) => entry.text).join(" ")),
  );
  const matched = targetTokens.filter((token) =>
    sourceTokens.has(token),
  ).length;
  return Math.min(
    100,
    Math.round((matched / Math.max(1, Math.min(targetTokens.length, 6))) * 100),
  );
}

function strongestEvidence(target: string, sources: SourceEntry[]) {
  const targetTokens = tokens(target);
  return sources
    .map((entry) => ({
      entry,
      matches: targetTokens.filter((token) =>
        tokens(entry.text).includes(token),
      ).length,
    }))
    .filter((item) => item.matches > 0)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 3)
    .map(({ entry }) => ({
      source: entry.source,
      text: entry.text.slice(0, 500),
    }));
}

function skillTerms(value: string) {
  return value
    .split(/[,;\n•|]+/)
    .map((item) => normalizeMatchText(item))
    .filter((item) => item.length >= 2);
}

export function calculateHardSkillsScore(
  job: CareerJob,
  snapshot: CareerApplicationSnapshot,
) {
  const required = skillTerms(job.skills);
  if (!required.length) return 0;
  const informed = snapshot.skills.map(normalizeMatchText);
  const matched = required.filter((requirement) =>
    informed.some(
      (skill) => skill.includes(requirement) || requirement.includes(skill),
    ),
  );
  return Math.round((matched.length / required.length) * 100);
}

export function calculateExplainableMatch({
  job,
  snapshot,
  criteria,
}: {
  job: CareerJob;
  snapshot: CareerApplicationSnapshot;
  criteria: MatchMatrixCriterion[];
}): ExplainableMatchResult {
  const hardSkillsScore = calculateHardSkillsScore(job, snapshot);
  const items = criteria.map((criterion): MatchResultItem => {
    const target = targetText(job, criterion.key);
    const sources = sourceEntries(snapshot, criterion.key);
    const score =
      criterion.key === "technical_skills"
        ? hardSkillsScore
        : overlapScore(target, sources);
    const evidence = strongestEvidence(target, sources);
    const requiresOfficialValidation = officialRegistrationPattern.test(target);
    const status: MatchResultItem["status"] = !sources.length
      ? "not_informed"
      : requiresOfficialValidation || score < 60
        ? "requires_validation"
        : "attended";
    const pointsToVerify: string[] = [];
    if (!sources.length) {
      pointsToVerify.push(
        `${criterion.label}: informação não encontrada no perfil confirmado.`,
      );
    } else if (requiresOfficialValidation) {
      pointsToVerify.push(
        "Registro profissional requer validação em fonte oficial.",
      );
    } else if (score < 60) {
      pointsToVerify.push(
        `${criterion.label}: correspondência insuficiente para confirmação automática.`,
      );
    }
    return {
      ...criterion,
      status,
      score,
      weightedScore: Number(((score * criterion.weight) / 100).toFixed(2)),
      evidence,
      pointsToVerify,
    };
  });
  const overallScore = Math.round(
    items.reduce((total, item) => total + item.weightedScore, 0),
  );
  return matchResultSchema.parse({
    overallScore,
    hardSkillsScore,
    items,
    sourcePolicy: "confirmed_application_snapshot",
  });
}
