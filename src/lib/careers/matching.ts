import { z } from "zod";
import type { CareerApplicationSnapshot } from "@/lib/careers/applications";
import type { CareerJob } from "@/lib/careers/jobs";
import type { ApplicationLogistics } from "@/lib/careers/logistics";

export const matchCriterionKeys = [
  "related_experience",
  "technical_skills",
  "education",
  "specific_course",
  "specialty",
  "sector_experience",
  "healthcare_experience",
  "similar_role_experience",
  "customer_service_experience",
  "certifications",
  "professional_registration",
  "availability",
  "shift_availability",
  "operational_compatibility",
  "languages",
  "leadership",
  "computer_skills",
] as const;

export type MatchCriterionKey = (typeof matchCriterionKeys)[number];

export const matchCriterionLabels: Record<MatchCriterionKey, string> = {
  related_experience: "Experiência relacionada",
  technical_skills: "Competências técnicas",
  education: "Formação",
  specific_course: "Curso específico",
  specialty: "Especialidade profissional",
  sector_experience: "Experiência no setor",
  healthcare_experience: "Experiência em saúde",
  similar_role_experience: "Experiência em função semelhante",
  customer_service_experience: "Experiência em atendimento",
  certifications: "Certificações",
  professional_registration: "Registro profissional",
  availability: "Disponibilidade",
  shift_availability: "Disponibilidade por turno",
  operational_compatibility: "Compatibilidade operacional",
  languages: "Idiomas",
  leadership: "Liderança",
  computer_skills: "Informática",
};

export const matchCriterionKinds = ["scoring", "minimum"] as const;
export type MatchCriterionKind = (typeof matchCriterionKinds)[number];
export const matchCriterionKindLabels: Record<MatchCriterionKind, string> = {
  scoring: "Pontuação",
  minimum: "Requisito mínimo",
};

export const matchCriterionPriorities = [
  "required",
  "important",
  "differential",
] as const;
export type MatchCriterionPriority = (typeof matchCriterionPriorities)[number];
export const matchCriterionPriorityLabels: Record<
  MatchCriterionPriority,
  string
> = {
  required: "Obrigatório",
  important: "Importante",
  differential: "Diferencial",
};

export const defaultMatchCriteria = [
  {
    key: "related_experience",
    label: matchCriterionLabels.related_experience,
    weight: 22,
    active: true,
    kind: "scoring",
    priority: "important",
  },
  {
    key: "technical_skills",
    label: matchCriterionLabels.technical_skills,
    weight: 23,
    active: true,
    kind: "scoring",
    priority: "required",
  },
  {
    key: "education",
    label: matchCriterionLabels.education,
    weight: 15,
    active: true,
    kind: "scoring",
    priority: "required",
  },
  ...(["specific_course", "specialty"] as const).map((key) => ({
    key,
    label: matchCriterionLabels[key],
    weight: 0,
    active: false,
    kind: "scoring" as const,
    priority: "important" as const,
  })),
  {
    key: "sector_experience",
    label: matchCriterionLabels.sector_experience,
    weight: 10,
    active: true,
    kind: "scoring",
    priority: "important",
  },
  ...(
    [
      "healthcare_experience",
      "similar_role_experience",
      "customer_service_experience",
    ] as const
  ).map((key) => ({
    key,
    label: matchCriterionLabels[key],
    weight: 0,
    active: false,
    kind: "scoring" as const,
    priority: "important" as const,
  })),
  {
    key: "certifications",
    label: matchCriterionLabels.certifications,
    weight: 10,
    active: true,
    kind: "scoring",
    priority: "differential",
  },
  {
    key: "professional_registration",
    label: matchCriterionLabels.professional_registration,
    weight: 0,
    active: false,
    kind: "minimum",
    priority: "required",
  },
  {
    key: "availability",
    label: matchCriterionLabels.availability,
    weight: 10,
    active: true,
    kind: "scoring",
    priority: "important",
  },
  {
    key: "shift_availability",
    label: matchCriterionLabels.shift_availability,
    weight: 0,
    active: false,
    kind: "minimum",
    priority: "required",
  },
  {
    key: "operational_compatibility",
    label: matchCriterionLabels.operational_compatibility,
    weight: 10,
    active: true,
    kind: "scoring",
    priority: "important",
  },
  ...(["languages", "leadership", "computer_skills"] as const).map((key) => ({
    key,
    label: matchCriterionLabels[key],
    weight: 0,
    active: false,
    kind: "scoring" as const,
    priority: "differential" as const,
  })),
] satisfies MatchMatrixCriterion[];

export type MatchMatrixCriterion = {
  key: MatchCriterionKey;
  label: string;
  weight: number;
  active: boolean;
  kind: MatchCriterionKind;
  priority: MatchCriterionPriority;
};

export const matchMatrixCriteriaSchema = z
  .array(
    z.object({
      key: z.enum(matchCriterionKeys),
      label: z.string().trim().min(3).max(120),
      weight: z.number().int().min(0).max(100),
      active: z.boolean().default(true),
      kind: z.enum(matchCriterionKinds).default("scoring"),
      priority: z.enum(matchCriterionPriorities).default("important"),
    }),
  )
  .min(1)
  .max(matchCriterionKeys.length)
  .superRefine((criteria, context) => {
    if (
      new Set(criteria.map((criterion) => criterion.key)).size !==
      criteria.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Os critérios devem ser únicos.",
      });
    }
    if (
      criteria
        .filter((criterion) => criterion.active && criterion.kind === "scoring")
        .reduce((total, criterion) => total + criterion.weight, 0) !== 100
    ) {
      context.addIssue({
        code: "custom",
        message: "Os pesos devem totalizar 100%.",
      });
    }
    if (
      criteria.some(
        (criterion) =>
          (!criterion.active || criterion.kind === "minimum") &&
          criterion.weight !== 0,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Critérios inativos ou mínimos não participam da pontuação e devem ter peso zero.",
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
  kind: z.enum(matchCriterionKinds).default("scoring"),
  priority: z.enum(matchCriterionPriorities).default("important"),
  status: z.enum([
    "attended",
    "differential",
    "not_attended",
    "not_informed",
    "requires_validation",
  ]),
  score: z.number().int().min(0).max(100),
  weightedScore: z.number().min(0).max(100),
  evidence: z.array(matchEvidenceSchema).max(5),
  pointsToVerify: z.array(z.string().max(500)).max(5),
});

export const matchResultSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  hardSkillsScore: z.number().int().min(0).max(100),
  informationCoverage: z.number().int().min(0).max(100).default(100),
  items: z.array(matchResultItemSchema).min(1).max(matchCriterionKeys.length),
  minimumRequirements: z
    .object({
      confirmed: z.number().int().min(0),
      requiresValidation: z.number().int().min(0),
      notIdentified: z.number().int().min(0),
      notAttended: z.number().int().min(0),
    })
    .default({
      confirmed: 0,
      requiresValidation: 0,
      notIdentified: 0,
      notAttended: 0,
    }),
  sourcePolicy: z.literal("confirmed_application_snapshot"),
});

export type ExplainableMatchResult = z.infer<typeof matchResultSchema>;
export type MatchResultItem = z.infer<typeof matchResultItemSchema>;

export const matchStatusLabels: Record<MatchResultItem["status"], string> = {
  attended: "ATENDE",
  differential: "DIFERENCIAL IDENTIFICADO",
  not_attended: "NÃO ATENDE",
  not_informed: "NÃO IDENTIFICADO",
  requires_validation: "INFORMADA — REQUER VALIDAÇÃO",
};

export type MatchAdherenceBand =
  "excellent" | "high" | "good" | "partial" | "review";

export const matchAdherenceBandLabels: Record<MatchAdherenceBand, string> = {
  excellent: "Aderência excelente",
  high: "Alta aderência",
  good: "Boa aderência",
  partial: "Aderência parcial",
  review: "Requer análise",
};

export function getMatchAdherenceBand(
  score: number | null | undefined,
  informationCoverage = 100,
) {
  if (score === null || score === undefined || informationCoverage < 40)
    return "review";
  if (score >= 90 && informationCoverage >= 80) return "excellent";
  if (score >= 75 && informationCoverage >= 70) return "high";
  if (score >= 60) return "good";
  if (score >= 40) return "partial";
  return "review";
}

export function calculateMatchInformationCoverage(items: MatchResultItem[]) {
  const totalWeight = items.reduce((total, item) => total + item.weight, 0);
  if (!totalWeight) return 0;
  const informedWeight = items
    .filter((item) => item.status !== "not_informed")
    .reduce((total, item) => total + item.weight, 0);
  return Math.round((informedWeight / totalWeight) * 100);
}

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
  if (key === "operational_compatibility") return [];
  if (
    [
      "related_experience",
      "sector_experience",
      "healthcare_experience",
      "similar_role_experience",
      "customer_service_experience",
      "leadership",
    ].includes(key)
  ) {
    return snapshot.experiences.map((item, index) => ({
      source: `Experiência ${index + 1}`,
      text: `${item.job_title} — ${item.company}. ${item.activities}`,
    }));
  }
  if (["technical_skills", "computer_skills", "languages"].includes(key)) {
    return snapshot.skills.map((skill) => ({
      source: "Habilidade confirmada",
      text: skill,
    }));
  }
  if (["education", "specific_course", "specialty"].includes(key)) {
    return snapshot.education.map((item, index) => ({
      source: `Formação ${index + 1}`,
      text: `${item.education_level} — ${item.course}, ${item.institution}`,
    }));
  }
  if (["certifications", "professional_registration"].includes(key)) {
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
  if (["related_experience", "similar_role_experience"].includes(key))
    return `${job.desirable_experience ?? ""} ${job.activities} ${job.required_requirements}`;
  if (["technical_skills", "computer_skills", "languages"].includes(key))
    return `${job.skills} ${job.required_requirements}`;
  if (key === "education") return job.schooling;
  if (["specific_course", "specialty"].includes(key))
    return `${job.schooling} ${job.required_requirements} ${job.desirable_requirements ?? ""}`;
  if (["sector_experience", "healthcare_experience"].includes(key))
    return `${job.area?.name ?? ""} ${job.description}`;
  if (key === "customer_service_experience")
    return `atendimento recepção cliente público ${job.activities}`;
  if (["certifications", "professional_registration"].includes(key))
    return `${job.certifications ?? ""} ${job.required_requirements}`;
  if (key === "leadership")
    return `liderança gestão coordenação ${job.activities} ${job.desirable_requirements ?? ""}`;
  if (key === "operational_compatibility") return "";
  return `${job.work_schedule ?? ""} ${job.work_mode} ${job.location}`;
}

function operationalCompatibility(
  job: CareerJob,
  logistics: ApplicationLogistics | null | undefined,
) {
  if (job.work_mode === "remote") {
    return {
      score: 100,
      status: "attended" as const,
      evidence: [
        {
          source: "Modalidade da vaga",
          text: "Vaga remota, sem exigência de deslocamento até uma unidade.",
        },
      ],
      pointsToVerify: [] as string[],
    };
  }
  if (!logistics?.commute_feasibility) {
    return {
      score: 0,
      status: "not_informed" as const,
      evidence: [],
      pointsToVerify: [
        "Compatibilidade operacional: deslocamento não informado pelo candidato.",
      ],
    };
  }
  const score =
    logistics.commute_feasibility === "yes"
      ? 100
      : logistics.commute_feasibility === "evaluate"
        ? 50
        : 0;
  const requiresValidation =
    logistics.commute_feasibility !== "yes" ||
    logistics.commute_time === "over_90" ||
    logistics.commute_time === "unknown";
  return {
    score,
    status: requiresValidation
      ? ("requires_validation" as const)
      : ("attended" as const),
    evidence: [
      {
        source: "Declaração operacional do candidato",
        text: `Possibilidade de deslocamento: ${logistics.commute_feasibility}. Tempo estimado: ${logistics.commute_time ?? "não informado"}.`,
      },
    ],
    pointsToVerify: requiresValidation
      ? ["Confirmar disponibilidade e condições de deslocamento na entrevista."]
      : [],
  };
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
  logistics,
}: {
  job: CareerJob;
  snapshot: CareerApplicationSnapshot;
  criteria: MatchMatrixCriterion[];
  logistics?: ApplicationLogistics | null;
}): ExplainableMatchResult {
  const hardSkillsScore = calculateHardSkillsScore(job, snapshot);
  const activeCriteria = criteria.filter((criterion) => criterion.active);
  const items = activeCriteria.map((criterion): MatchResultItem => {
    if (criterion.key === "operational_compatibility") {
      const operational = operationalCompatibility(job, logistics);
      return {
        ...criterion,
        ...operational,
        weightedScore:
          criterion.kind === "scoring"
            ? Number(((operational.score * criterion.weight) / 100).toFixed(2))
            : 0,
      };
    }
    const target = targetText(job, criterion.key);
    const sources = sourceEntries(snapshot, criterion.key);
    const score =
      criterion.key === "technical_skills"
        ? hardSkillsScore
        : overlapScore(target, sources);
    const evidence = strongestEvidence(target, sources);
    const requiresOfficialValidation =
      criterion.key === "professional_registration" ||
      officialRegistrationPattern.test(target);
    const status: MatchResultItem["status"] = !sources.length
      ? "not_informed"
      : requiresOfficialValidation || score < 60
        ? "requires_validation"
        : criterion.priority === "differential"
          ? "differential"
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
      weightedScore:
        criterion.kind === "scoring"
          ? Number(((score * criterion.weight) / 100).toFixed(2))
          : 0,
      evidence,
      pointsToVerify,
    };
  });
  const informedItems = items.filter(
    (item) => item.kind === "scoring" && item.status !== "not_informed",
  );
  const informedWeight = informedItems.reduce(
    (total, item) => total + item.weight,
    0,
  );
  const overallScore = informedWeight
    ? Math.round(
        (informedItems.reduce((total, item) => total + item.weightedScore, 0) /
          informedWeight) *
          100,
      )
    : 0;
  const informationCoverage = calculateMatchInformationCoverage(items);
  const minimumItems = items.filter((item) => item.kind === "minimum");
  return matchResultSchema.parse({
    overallScore,
    hardSkillsScore,
    informationCoverage,
    items,
    minimumRequirements: {
      confirmed: minimumItems.filter((item) =>
        ["attended", "differential"].includes(item.status),
      ).length,
      requiresValidation: minimumItems.filter(
        (item) => item.status === "requires_validation",
      ).length,
      notIdentified: minimumItems.filter(
        (item) => item.status === "not_informed",
      ).length,
      notAttended: minimumItems.filter((item) => item.status === "not_attended")
        .length,
    },
    sourcePolicy: "confirmed_application_snapshot",
  });
}
