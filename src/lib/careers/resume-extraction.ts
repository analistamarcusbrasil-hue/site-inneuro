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

export const RESUME_PARSER_VERSION = "text-v2";
export const RESUME_TEXT_MAX_CHARACTERS = 200_000;
export const RESUME_MIN_TEXT_CHARACTERS = 80;
export const RESUME_MIN_WORDS = 12;

const sectionAliases = {
  objective: [
    "objetivo",
    "objetivo profissional",
    "objetivos profissionais",
    "area de interesse",
    "cargo pretendido",
    "pretensao profissional",
  ],
  summary: [
    "resumo",
    "resumo profissional",
    "perfil profissional",
    "perfil",
    "sobre mim",
    "apresentacao",
    "qualificacoes profissionais",
    "sintese profissional",
  ],
  experience: [
    "experiencia",
    "experiencias",
    "experiencia profissional",
    "experiencias profissionais",
    "historico profissional",
    "trajetoria profissional",
    "vivencia profissional",
    "atuacao profissional",
  ],
  education: [
    "formacao",
    "formacao academica",
    "formacao escolar",
    "escolaridade",
    "educacao",
    "educacao academica",
    "historico academico",
  ],
  certifications: [
    "cursos",
    "certificacoes",
    "cursos e certificacoes",
    "cursos complementares",
    "cursos extracurriculares",
    "qualificacoes",
    "aperfeicoamento",
    "formacao complementar",
  ],
  skills: [
    "habilidades",
    "competencias",
    "conhecimentos",
    "competencias profissionais",
    "habilidades e competencias",
    "principais competencias",
    "conhecimentos tecnicos",
    "aptidoes",
  ],
} as const;

type SectionName = keyof typeof sectionAliases;

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizedHeading(value: string) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[&]/g, " e ")
    .replace(/[:|]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLine(value: string) {
  return value
    .replace(/^[\s•·▪◦►➤✓✔●○■□◆◇–—*-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function limit(value: string | null | undefined, max: number) {
  if (!value) return null;
  const cleaned = cleanLine(value);
  return cleaned ? cleaned.slice(0, max) : null;
}

function normalizedKey(value: string) {
  return stripDiacritics(value)
    .toLocaleLowerCase("pt-BR")
    .replace(/\W+/g, " ")
    .trim();
}

function sectionHeading(line: string) {
  const [possibleHeading, ...rest] = line.split(/\s*:\s*/);
  const normalized = normalizedHeading(possibleHeading);
  for (const [name, aliases] of Object.entries(sectionAliases) as Array<
    [SectionName, readonly string[]]
  >) {
    if (aliases.includes(normalized))
      return { name, inlineValue: cleanLine(rest.join(": ")) || null };
  }
  return null;
}

function prepareResumeLines(rawText: string) {
  const text = rawText
    .normalize("NFKC")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .slice(0, RESUME_TEXT_MAX_CHARACTERS);
  const lines = text.split("\n").flatMap((line) =>
    line
      .replace(/\t+/g, "   ")
      .split(/\s{3,}/)
      .map(cleanLine),
  );
  return { text, lines };
}

export function assessResumeText(rawText: string) {
  const { text } = prepareResumeLines(rawText);
  const letters = (text.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) ?? []).length;
  const words = text.match(/[A-Za-zÀ-ÖØ-öø-ÿ]{2,}/g)?.length ?? 0;
  const quality =
    !text.trim() || letters < 10
      ? "image_only"
      : letters < RESUME_MIN_TEXT_CHARACTERS || words < RESUME_MIN_WORDS
        ? "insufficient"
        : "native_text";
  return z
    .object({
      quality: z.enum(["native_text", "insufficient", "image_only"]),
      letterCount: z.number().int().nonnegative(),
      wordCount: z.number().int().nonnegative(),
    })
    .parse({ quality, letterCount: letters, wordCount: words });
}

function splitSections(lines: string[]) {
  const sections: Partial<Record<SectionName, string[]>> = {};
  let current: SectionName | null = null;
  for (const line of lines) {
    const heading = sectionHeading(line);
    if (heading) {
      current = heading.name;
      sections[current] ??= [];
      if (heading.inlineValue) sections[current]?.push(heading.inlineValue);
      continue;
    }
    if (current) sections[current]?.push(line);
  }
  return sections;
}

function joinedSection(lines: string[] | undefined, max: number) {
  return limit(lines?.filter(Boolean).join("\n"), max);
}

function extractName(lines: string[]) {
  const labeled = lines
    .slice(0, 20)
    .map((line) => line.match(/^(?:nome(?: completo)?)\s*[:|-]\s*(.+)$/i)?.[1])
    .find(Boolean);
  if (labeled) return limit(labeled, 120);
  const excluded =
    /curr[ií]culo|curriculum|resume|contato|telefone|whatsapp|e-?mail|linkedin|objetivo|perfil|experi[eê]ncia|forma[cç][aã]o|habilidade|compet[eê]ncia/i;
  return (
    lines.slice(0, 15).find((line) => {
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
  const matches = text.match(
    /(?:\+?55[\s.-]*)?(?:\(?\d{2}\)?[\s.-]*)?(?:9[\s.-]*)?\d{4}[\s.-]*\d{4}/g,
  );
  for (const match of matches ?? []) {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 13) return match.trim();
  }
  return null;
}

function extractLocation(text: string) {
  const statePattern = brazilianStates.join("|");
  const match = text.match(
    new RegExp(
      `(?:cidade|localidade|endere[cç]o)?\\s*[:|-]?\\s*(?:reside(?:nte)? em|moro em)?\\s*([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' .]{1,98}?)\\s*(?:,|\\s-\\s|/)\\s*(${statePattern})(?:\\b|$)`,
      "i",
    ),
  );
  if (!match) return { city: null, state: null };
  const city = cleanLine(match[1]).replace(
    /^(?:cidade|localidade|endere[cç]o|reside(?:nte)? em|moro em)\s*[:|-]?\s*/i,
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
    /\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*[/.\s-]+(?:de\s+)?(19\d{2}|20\d{2})\b/,
  );
  if (named) return `${named[2]}-${monthNames[named[1]]}`;
  const year = normalized.match(/\b(19\d{2}|20\d{2})\b/);
  return year ? `${year[1]}-01` : null;
}

function parsePeriod(line: string) {
  const normalized = stripDiacritics(line).toLowerCase();
  const present = /\b(atual|presente|momento|em andamento|desde)\b/i.test(
    normalized,
  );
  const dateParts = normalized.match(
    /(?:0?[1-9]|1[0-2])[/-](?:19|20)\d{2}|(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*[/.\s-]+(?:de\s+)?(?:19|20)\d{2}|(?:19|20)\d{2}/g,
  );
  if (!dateParts?.length) return null;
  const startMonth = parseMonth(dateParts[0]);
  if (!startMonth) return null;
  if (present) return { startMonth, endMonth: null, isCurrent: true };
  if (dateParts.length < 2) return null;
  const endMonth = parseMonth(dateParts[1]);
  return endMonth ? { startMonth, endMonth, isCurrent: false } : null;
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
    } else current.push(line);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

const jobTitlePattern =
  /\b(recepcionista|atendente|assistente|auxiliar|analista|coordenador|supervisor|gerente|estagi[aá]rio|t[eé]cnico|consultor|vendedor|operador|secret[aá]ri|administrador|enfermeir|fisioterapeuta|psic[oó]log|m[eé]dic|professor)\b/i;

function removePeriod(value: string) {
  return cleanLine(
    value.replace(
      /\b(?:desde\s+)?(?:(?:0?[1-9]|1[0-2])[/-])?(?:19|20)\d{2}\s*(?:a|at[eé]|-|–|—)?\s*(?:(?:(?:0?[1-9]|1[0-2])[/-])?(?:19|20)\d{2}|atual|presente|momento|em andamento)?\b/gi,
      "",
    ),
  );
}

function experienceBlocks(lines: string[]) {
  const explicit = splitBlocks(lines);
  if (explicit.length > 1) return explicit;
  const periodIndexes = lines.flatMap((line, index) =>
    parsePeriod(line) ? [index] : [],
  );
  if (periodIndexes.length <= 1) return explicit;
  return periodIndexes.map((periodIndex, index) => {
    const previousPeriod = periodIndexes[index - 1] ?? -1;
    const nextPeriod = periodIndexes[index + 1] ?? lines.length;
    return lines.slice(
      Math.max(previousPeriod + 1, periodIndex - 2),
      Math.max(periodIndex + 1, nextPeriod - 2),
    );
  });
}

function extractExperiences(lines: string[] | undefined) {
  if (!lines) return [];
  const unique = new Map<string, ResumeExtraction["experiences"][number]>();
  for (const block of experienceBlocks(lines)) {
    const periodIndex = block.findIndex((line) => parsePeriod(line));
    const period = periodIndex >= 0 ? parsePeriod(block[periodIndex]) : null;
    if (!period) continue;
    let company = labeledValue(block, [
      "empresa",
      "empregador",
      "organizacao",
      "organização",
    ]);
    let jobTitle = labeledValue(block, [
      "cargo",
      "funcao",
      "função",
      "posicao",
      "posição",
    ]);
    const periodLineParts = removePeriod(block[periodIndex])
      .split(/\s*[|•·—–]\s*/)
      .filter(Boolean);
    const preceding = block
      .slice(Math.max(0, periodIndex - 2), periodIndex)
      .filter(Boolean);
    const candidates = [...preceding, ...periodLineParts].filter(
      (item) => !/^(?:empresa|cargo|fun[cç][aã]o)\s*[:|-]/i.test(item),
    );
    jobTitle ??= candidates.find((item) => jobTitlePattern.test(item)) ?? null;
    company ??=
      periodLineParts.find((item) => item !== jobTitle) ??
      candidates.find((item) => item !== jobTitle) ??
      null;
    if (!jobTitle && candidates.length >= 2)
      jobTitle = candidates.at(-1) ?? null;
    if (!company && candidates.length >= 2) company = candidates.at(-2) ?? null;
    const activityLabel = block.findIndex((line) =>
      /^(?:atividades?|responsabilidades?|atribui[cç][oõ]es)/i.test(line),
    );
    const activityLines = (
      activityLabel >= 0
        ? [
            block[activityLabel].replace(
              /^(?:atividades?|responsabilidades?|atribui[cç][oõ]es)\s*[:|-]?\s*/i,
              "",
            ),
            ...block.slice(activityLabel + 1),
          ]
        : block.slice(periodIndex + 1)
    ).filter((line) => line && !parsePeriod(line));
    const candidate = {
      company: limit(
        company?.replace(
          /^(?:empresa|empregador|organiza[cç][aã]o)\s*[:|-]\s*/i,
          "",
        ),
        160,
      ),
      jobTitle: limit(
        jobTitle?.replace(
          /^(?:cargo|fun[cç][aã]o|posi[cç][aã]o)\s*[:|-]\s*/i,
          "",
        ),
        160,
      ),
      ...period,
      activities: limit(activityLines.join("\n"), 3000),
    };
    if (candidate.company && candidate.jobTitle)
      unique.set(
        normalizedKey(
          `${candidate.company}|${candidate.jobTitle}|${candidate.startMonth}`,
        ),
        candidate as ResumeExtraction["experiences"][number],
      );
  }
  return [...unique.values()].slice(0, 30);
}

function normalizeEducationLevel(value: string | null) {
  if (!value) return null;
  const normalized = normalizedHeading(value);
  const aliases: Array<[RegExp, (typeof educationLevels)[number]]> = [
    [/ensino fundamental|1[ºo] grau/, "Ensino fundamental"],
    [/ensino medio|2[ºo] grau/, "Ensino médio"],
    [/tecnic|tecnolog/, "Curso técnico"],
    [/pos gradu|especializa|mba/, "Pós-graduação"],
    [/mestrad/, "Mestrado"],
    [/doutorad/, "Doutorado"],
    [/graduacao|bacharel|licenciatura|superior/, "Graduação"],
  ];
  return aliases.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

function extractEducation(lines: string[] | undefined) {
  if (!lines) return [];
  const unique = new Map<string, ResumeExtraction["education"][number]>();
  const blocks = splitBlocks(lines);
  const candidates =
    blocks.length > 1 ? blocks : lines.filter(Boolean).map((line) => [line]);
  for (const block of candidates) {
    const combined = block.join(" | ");
    const educationLevel = normalizeEducationLevel(combined);
    const labeledCourse = labeledValue(block, [
      "curso",
      "formacao",
      "formação",
      "gradua[cç][aã]o",
    ]);
    const labeledInstitution = labeledValue(block, [
      "instituicao",
      "instituição",
      "faculdade",
      "universidade",
      "escola",
      "colegio",
      "colégio",
    ]);
    const parts = combined
      .split(/\s*[|•·—–]\s*|\s+-\s+/)
      .map(cleanLine)
      .filter(Boolean);
    const periodPart = parts.find(
      (part) => parsePeriod(part) || /\b(19|20)\d{2}\b/.test(part),
    );
    const statusPart = parts.find((part) =>
      /cursando|em andamento|conclu[ií]d|completo|incompleto/i.test(part),
    );
    const educationPart = parts.find((part) => normalizeEducationLevel(part));
    const contentParts = parts.filter(
      (part) => part !== periodPart && part !== statusPart,
    );
    let course: string | null =
      labeledCourse ?? educationPart ?? contentParts[0] ?? null;
    let institution: string | null =
      labeledInstitution ??
      contentParts.find(
        (part) =>
          part !== course &&
          /universidade|faculdade|centro universit[aá]rio|instituto|escola|col[eé]gio|senac|senai|est[aá]cio|unopar|unifap|ueap/i.test(
            part,
          ),
      ) ??
      null;
    if (!institution && block.length > 1)
      institution =
        block.find((part) => part !== course && !parsePeriod(part)) ?? null;
    course = limit(
      course?.replace(
        /^(?:curso|forma[cç][aã]o|gradua[cç][aã]o)\s*[:|-]\s*/i,
        "",
      ),
      180,
    );
    institution = limit(
      institution?.replace(
        /^(?:institui[cç][aã]o|faculdade|universidade|escola|col[eé]gio)\s*[:|-]\s*/i,
        "",
      ),
      180,
    );
    if (!course || !institution) continue;
    const periodLine = block.find((line) => parsePeriod(line)) ?? periodPart;
    const period = periodLine ? parsePeriod(periodLine) : null;
    const singleMonth = periodLine ? parseMonth(periodLine) : null;
    const inProgress = /cursando|em andamento|previs[aã]o/i.test(combined);
    const completed = /conclu[ií]d|completo|finalizado/i.test(combined);
    const startMonth = period?.startMonth ?? singleMonth;
    const endMonth = inProgress
      ? null
      : (period?.endMonth ?? (completed ? singleMonth : null));
    const item = {
      educationLevel,
      course,
      institution,
      startMonth,
      endMonth,
      inProgress,
    };
    unique.set(
      normalizedKey(`${course}|${institution}|${startMonth ?? ""}`),
      item,
    );
  }
  return [...unique.values()].slice(0, 30);
}

function extractCertifications(lines: string[] | undefined) {
  if (!lines) return [];
  const unique = new Map<string, ResumeExtraction["certifications"][number]>();
  for (const block of splitBlocks(lines).flatMap((item) =>
    item.length > 1 &&
    !item.some((line) =>
      /^(?:curso|certifica[cç][aã]o|nome|institui[cç][aã]o|entidade)\s*[:|-]/i.test(
        line,
      ),
    )
      ? item.map((line) => [line])
      : [item],
  )) {
    const combined = block.join(" | ");
    const parts = combined
      .split(/\s*[|•·—–]\s*|\s+-\s+/)
      .map(cleanLine)
      .filter(Boolean);
    const name =
      labeledValue(block, ["curso", "certificacao", "certificação", "nome"]) ??
      parts[0];
    if (!name || sectionHeading(name)) continue;
    const institution =
      labeledValue(block, [
        "instituicao",
        "instituição",
        "entidade",
        "emissor",
      ]) ??
      parts.slice(1).find((part) => !/^\d{4}$/.test(part)) ??
      null;
    const yearMatch = combined.match(/\b(19\d{2}|20\d{2})\b/);
    const item = {
      name: cleanLine(
        name.replace(/^(?:curso|certifica[cç][aã]o|nome)\s*[:|-]\s*/i, ""),
      ).slice(0, 180),
      institution: limit(institution, 180),
      completionYear: yearMatch ? Number(yearMatch[1]) : null,
    };
    if (item.name.length < 2) continue;
    const key = normalizedKey(
      `${item.name}|${item.institution ?? ""}|${item.completionYear ?? ""}`,
    );
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].slice(0, 50);
}

function extractSkills(lines: string[] | undefined) {
  if (!lines) return [];
  const unique = new Map<string, string>();
  for (const item of lines.flatMap((line) => line.split(/[,;|•·\n]/))) {
    const skill = cleanLine(item);
    if (skill.length < 2 || skill.length > 80 || skill.split(/\s+/).length > 8)
      continue;
    const key = normalizedKey(skill);
    if (!unique.has(key)) unique.set(key, skill);
  }
  return [...unique.values()].slice(0, 60);
}

export function parseResumeText(rawText: string): ResumeExtraction {
  const { text, lines } = prepareResumeLines(rawText);
  const nonEmptyLines = lines.filter(Boolean);
  const sections = splitSections(lines);
  const email =
    text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  const location = extractLocation(nonEmptyLines.slice(0, 30).join("\n"));
  return resumeExtractionSchema.parse({
    fullName: extractName(nonEmptyLines),
    email,
    whatsapp: extractPhone(nonEmptyLines.slice(0, 35).join("\n")),
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

export function isCompleteResumeExperience(
  item: ResumeExtraction["experiences"][number],
) {
  return Boolean(
    item.startMonth &&
    (item.isCurrent || item.endMonth) &&
    item.activities?.trim(),
  );
}

export function isCompleteResumeEducation(
  item: ResumeExtraction["education"][number],
) {
  return Boolean(
    item.educationLevel &&
    item.startMonth &&
    (item.inProgress || item.endMonth),
  );
}

export function isCompleteResumeCertification(
  item: ResumeExtraction["certifications"][number],
) {
  return Boolean(item.institution?.trim() && item.completionYear);
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
