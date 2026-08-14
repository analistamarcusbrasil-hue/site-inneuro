import { z } from "zod";
import { brazilianStates, educationLevels } from "./profile-validation";

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null);

const optionalMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .nullable();

export const resumeExtractionSchema = z.object({
  fullName: optionalString(120),
  email: z.string().email().max(254).nullable(),
  whatsapp: optionalString(24),
  city: optionalString(100),
  state: z.enum(brazilianStates).nullable(),
  professionalObjective: optionalString(500),
  about: optionalString(3000),
  experiences: z
    .array(
      z.object({
        company: z.string().trim().min(2).max(160),
        jobTitle: z.string().trim().min(2).max(160),
        startMonth: optionalMonth,
        endMonth: optionalMonth,
        isCurrent: z.boolean(),
        activities: optionalString(3000),
      }),
    )
    .max(30),
  education: z
    .array(
      z.object({
        educationLevel: z.enum(educationLevels).nullable(),
        course: z.string().trim().min(2).max(180),
        institution: z.string().trim().min(2).max(180),
        startMonth: optionalMonth,
        endMonth: optionalMonth,
        inProgress: z.boolean(),
      }),
    )
    .max(30),
  certifications: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(180),
        institution: optionalString(180),
        completionYear: z.number().int().min(1900).max(2100).nullable(),
      }),
    )
    .max(50),
  skills: z.array(z.string().trim().min(2).max(80)).max(60),
});

export type ResumeExtraction = z.infer<typeof resumeExtractionSchema>;

export const resumeExtractionRecordSchema = z.object({
  id: z.string().uuid(),
  candidate_id: z.string().uuid(),
  resume_id: z.string().uuid(),
  status: z.enum(["ready", "partial", "failed", "applied", "ignored"]),
  extracted_data: resumeExtractionSchema,
  warnings: z.array(z.string().max(300)).max(20),
  parser_version: z.string().max(40),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ResumeExtractionRecord = z.infer<
  typeof resumeExtractionRecordSchema
>;

export type ResumeCurrentProfile = {
  fullName?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  city?: string | null;
  state?: string | null;
  professionalObjective?: string | null;
  about?: string | null;
};

export const RESUME_PARSER_VERSION = "text-v1";
export const RESUME_TEXT_MAX_CHARACTERS = 200_000;

const sectionAliases = {
  objective: ["objetivo", "objetivo profissional"],
  summary: [
    "resumo",
    "resumo profissional",
    "perfil profissional",
    "sobre mim",
  ],
  experience: [
    "experiencia",
    "experiencias",
    "experiencia profissional",
    "experiencias profissionais",
  ],
  education: ["formacao", "formacao academica", "escolaridade"],
  certifications: [
    "cursos",
    "certificacoes",
    "cursos e certificacoes",
    "qualificacoes",
  ],
  skills: [
    "habilidades",
    "competencias",
    "conhecimentos",
    "competencias profissionais",
  ],
} as const;

type SectionName = keyof typeof sectionAliases;

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizedHeading(value: string) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[:|]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLine(value: string) {
  return value
    .replace(/^[\s•·▪◦►➤✓✔*-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function limit(value: string | null, max: number) {
  if (!value) return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function sectionName(line: string): SectionName | null {
  const normalized = normalizedHeading(line);
  for (const [name, aliases] of Object.entries(sectionAliases) as Array<
    [SectionName, readonly string[]]
  >) {
    if (aliases.includes(normalized)) return name;
  }
  return null;
}

function splitSections(lines: string[]) {
  const sections: Partial<Record<SectionName, string[]>> = {};
  let current: SectionName | null = null;
  for (const line of lines) {
    const heading = sectionName(line);
    if (heading) {
      current = heading;
      sections[current] ??= [];
      continue;
    }
    if (current) sections[current]?.push(line);
  }
  return sections;
}

function joinedSection(lines: string[] | undefined, max: number) {
  return limit(lines?.join("\n") ?? null, max);
}

function extractName(lines: string[]) {
  const excluded =
    /curr[ií]culo|resume|contato|telefone|e-?mail|linkedin|objetivo|perfil/i;
  return (
    lines.slice(0, 12).find((line) => {
      const words = line.split(/\s+/);
      return (
        !excluded.test(line) &&
        !/[\d@:/]/.test(line) &&
        words.length >= 2 &&
        words.length <= 7 &&
        line.length <= 120
      );
    }) ?? null
  );
}

function extractPhone(text: string) {
  const match = text.match(
    /(?:\+?55\s*)?(?:\(?\d{2}\)?[\s.-]*)?(?:9\s*)?\d{4}[\s.-]*\d{4}/,
  );
  if (!match) return null;
  const digits = match[0].replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13 ? match[0].trim() : null;
}

function extractLocation(text: string) {
  const statePattern = brazilianStates.join("|");
  const match = text.match(
    new RegExp(
      `(?:cidade\\s*[:|-]\\s*)?([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' .]{1,98}?)\\s*(?:,|\\s-\\s|/)\\s*(${statePattern})(?:\\b|$)`,
      "i",
    ),
  );
  if (!match) return { city: null, state: null };
  const city = cleanLine(match[1]).replace(
    /^(?:reside(?:nte)? em|moro em)\s+/i,
    "",
  );
  return {
    city: city.length >= 2 && city.length <= 100 ? city : null,
    state: match[2].toUpperCase() as (typeof brazilianStates)[number],
  };
}

const monthNames: Record<string, string> = {
  jan: "01",
  fev: "02",
  mar: "03",
  abr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  set: "09",
  out: "10",
  nov: "11",
  dez: "12",
};

function parseMonth(value: string) {
  const normalized = stripDiacritics(value).toLowerCase().trim();
  const numeric = normalized.match(/\b(0?[1-9]|1[0-2])[/-](19\d{2}|20\d{2})\b/);
  if (numeric) return `${numeric[2]}-${numeric[1].padStart(2, "0")}`;
  const named = normalized.match(
    /\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*[/.\s-]+(19\d{2}|20\d{2})\b/,
  );
  if (named) return `${named[2]}-${monthNames[named[1]]}`;
  const year = normalized.match(/\b(19\d{2}|20\d{2})\b/);
  return year ? `${year[1]}-01` : null;
}

function parsePeriod(line: string) {
  const present = /atual|presente|momento/i.test(line);
  const pieces = line.split(/\s+(?:a|até|–|—|-)\s+/i);
  if (pieces.length < 2 && !present) return null;
  const startMonth = parseMonth(pieces[0]);
  if (!startMonth) return null;
  const endMonth = present ? null : parseMonth(pieces.slice(1).join(" "));
  if (!present && !endMonth) return null;
  return { startMonth, endMonth, isCurrent: present };
}

function labeledValue(lines: string[], labels: string[]) {
  const pattern = new RegExp(`^(?:${labels.join("|")})\\s*[:|-]\\s*(.+)$`, "i");
  return (
    lines.map((line) => line.match(pattern)?.[1]?.trim()).find(Boolean) ?? null
  );
}

function splitBlocks(lines: string[]) {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (!line) {
      if (current.length) blocks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);
  return blocks;
}

function extractExperiences(lines: string[] | undefined) {
  if (!lines) return [];
  const results: ResumeExtraction["experiences"] = [];
  for (const block of splitBlocks(lines)) {
    const periodIndex = block.findIndex((line) => parsePeriod(line));
    const period = periodIndex >= 0 ? parsePeriod(block[periodIndex]) : null;
    const company =
      labeledValue(block, ["empresa", "organizacao", "organização"]) ??
      (periodIndex >= 2 ? block[periodIndex - 2] : null);
    const jobTitle =
      labeledValue(block, ["cargo", "funcao", "função"]) ??
      (periodIndex >= 1 ? block[periodIndex - 1] : null);
    if (!company || !jobTitle || !period) continue;
    const activityLabel = block.findIndex((line) =>
      /^atividades?\s*[:|-]/i.test(line),
    );
    const activityLines =
      activityLabel >= 0
        ? [
            block[activityLabel].replace(/^atividades?\s*[:|-]\s*/i, ""),
            ...block.slice(activityLabel + 1),
          ]
        : block.slice(periodIndex + 1);
    const candidate = {
      company: limit(
        company.replace(/^(?:empresa|organizacao|organização)\s*[:|-]\s*/i, ""),
        160,
      ),
      jobTitle: limit(
        jobTitle.replace(/^(?:cargo|funcao|função)\s*[:|-]\s*/i, ""),
        160,
      ),
      ...period,
      activities: limit(activityLines.join("\n"), 3000),
    };
    if (candidate.company && candidate.jobTitle) {
      results.push(candidate as ResumeExtraction["experiences"][number]);
    }
  }
  return results.slice(0, 30);
}

function normalizeEducationLevel(value: string | null) {
  if (!value) return null;
  const normalized = normalizedHeading(value);
  return (
    educationLevels.find((level) => normalizedHeading(level) === normalized) ??
    educationLevels.find((level) =>
      normalized.includes(normalizedHeading(level)),
    ) ??
    null
  );
}

function extractEducation(lines: string[] | undefined) {
  if (!lines) return [];
  const results: ResumeExtraction["education"] = [];
  for (const block of splitBlocks(lines)) {
    const course = labeledValue(block, ["curso", "formacao", "formação"]);
    const institution = labeledValue(block, [
      "instituicao",
      "instituição",
      "faculdade",
      "universidade",
      "escola",
    ]);
    if (!course || !institution) continue;
    const levelValue = labeledValue(block, ["nivel", "nível", "grau"]);
    const periodLine = block.find((line) => parsePeriod(line));
    const period = periodLine ? parsePeriod(periodLine) : null;
    const inProgress = block.some((line) =>
      /cursando|em andamento/i.test(line),
    );
    results.push({
      educationLevel: normalizeEducationLevel(levelValue),
      course: course.slice(0, 180),
      institution: institution.slice(0, 180),
      startMonth: period?.startMonth ?? null,
      endMonth: inProgress ? null : (period?.endMonth ?? null),
      inProgress,
    });
  }
  return results.slice(0, 30);
}

function extractCertifications(lines: string[] | undefined) {
  if (!lines) return [];
  const results: ResumeExtraction["certifications"] = [];
  for (const block of splitBlocks(lines)) {
    const name = labeledValue(block, [
      "curso",
      "certificacao",
      "certificação",
      "nome",
    ]);
    if (!name) continue;
    const institution = labeledValue(block, [
      "instituicao",
      "instituição",
      "entidade",
    ]);
    const yearValue = labeledValue(block, ["ano", "conclusao", "conclusão"]);
    const yearMatch = yearValue?.match(/\b(19\d{2}|20\d{2})\b/);
    results.push({
      name: name.slice(0, 180),
      institution: limit(institution, 180),
      completionYear: yearMatch ? Number(yearMatch[1]) : null,
    });
  }
  return results.slice(0, 50);
}

function extractSkills(lines: string[] | undefined) {
  if (!lines) return [];
  const unique = new Map<string, string>();
  for (const item of lines.flatMap((line) => line.split(/[,;|•·]/))) {
    const skill = cleanLine(item);
    if (skill.length < 2 || skill.length > 80 || skill.split(/\s+/).length > 8)
      continue;
    unique.set(stripDiacritics(skill).toLowerCase(), skill);
  }
  return [...unique.values()].slice(0, 60);
}

export function parseResumeText(rawText: string): ResumeExtraction {
  const text = rawText
    .normalize("NFKC")
    .replace(/\r/g, "")
    .replace(/[\t\u00a0]+/g, " ")
    .slice(0, RESUME_TEXT_MAX_CHARACTERS);
  const lines = text.split("\n").map(cleanLine);
  const nonEmptyLines = lines.filter(Boolean);
  const sections = splitSections(lines);
  const email =
    text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  const location = extractLocation(nonEmptyLines.slice(0, 25).join("\n"));

  return resumeExtractionSchema.parse({
    fullName: extractName(nonEmptyLines),
    email,
    whatsapp: extractPhone(nonEmptyLines.slice(0, 30).join("\n")),
    city: location.city,
    state: location.state,
    professionalObjective: joinedSection(sections.objective, 500),
    about: joinedSection(sections.summary, 3000),
    experiences: extractExperiences(sections.experience),
    education: extractEducation(sections.education),
    certifications: extractCertifications(sections.certifications),
    skills: extractSkills(sections.skills),
  });
}

export function countExtractedResumeFields(data: ResumeExtraction) {
  return [
    data.fullName,
    data.email,
    data.whatsapp,
    data.city,
    data.state,
    data.professionalObjective,
    data.about,
    ...data.experiences,
    ...data.education,
    ...data.certifications,
    ...data.skills,
  ].filter(Boolean).length;
}

export function buildResumeFieldConflicts(
  current: ResumeCurrentProfile,
  extracted: ResumeExtraction,
) {
  const keys = [
    "fullName",
    "email",
    "whatsapp",
    "city",
    "state",
    "professionalObjective",
    "about",
  ] as const;
  return keys.filter((key) => {
    const currentValue = current[key]?.trim();
    const extractedValue = extracted[key]?.trim();
    return Boolean(
      currentValue &&
      extractedValue &&
      currentValue.localeCompare(extractedValue, "pt-BR", {
        sensitivity: "base",
      }) !== 0,
    );
  });
}
