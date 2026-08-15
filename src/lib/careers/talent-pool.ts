export const talentPoolStatuses = [
  "active",
  "left",
  "deletion_requested",
] as const;

export type TalentPoolStatus = (typeof talentPoolStatuses)[number];

export const talentPoolStatusLabels: Record<TalentPoolStatus, string> = {
  active: "Participando",
  left: "Fora do banco",
  deletion_requested: "Exclusão solicitada",
};

export type TalentPoolMembership = {
  candidate_id: string;
  status: TalentPoolStatus;
  joined_at: string;
  left_at: string | null;
  deletion_requested_at: string | null;
  professional_updated_at: string;
  created_at: string;
  updated_at: string;
};

export type TalentPoolArea = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

export type TalentPoolSearchRecord = {
  candidateId: string;
  fullName: string;
  city: string;
  state: string;
  objective: string;
  about: string;
  availability: string;
  areaIds: string[];
  areaNames: string[];
  education: string[];
  experiences: string[];
  skills: string[];
  certifications: string[];
  professionalUpdatedAt: string;
};

export type TalentPoolFilters = {
  query: string;
  areaId: string;
  city: string;
  state: string;
  education: string;
  experience: string;
  skill: string;
  certification: string;
  availability: string;
  updatedWithinDays: number | null;
};

export function normalizeTalentPoolSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function contains(haystack: string | string[], needle: string) {
  if (!needle) return true;
  const normalizedHaystack = normalizeTalentPoolSearch(
    Array.isArray(haystack) ? haystack.join(" ") : haystack,
  );
  return normalizedHaystack.includes(normalizeTalentPoolSearch(needle));
}

export function matchesTalentPoolFilters(
  record: TalentPoolSearchRecord,
  filters: TalentPoolFilters,
  now = new Date(),
) {
  const professionalContent = [
    record.fullName,
    record.objective,
    record.about,
    record.availability,
    ...record.areaNames,
    ...record.education,
    ...record.experiences,
    ...record.skills,
    ...record.certifications,
  ];
  if (!contains(professionalContent, filters.query)) return false;
  if (filters.areaId && !record.areaIds.includes(filters.areaId)) return false;
  if (!contains(record.city, filters.city)) return false;
  if (
    filters.state &&
    normalizeTalentPoolSearch(record.state) !==
      normalizeTalentPoolSearch(filters.state)
  ) {
    return false;
  }
  if (!contains(record.education, filters.education)) return false;
  if (!contains(record.experiences, filters.experience)) return false;
  if (!contains(record.skills, filters.skill)) return false;
  if (!contains(record.certifications, filters.certification)) return false;
  if (!contains(record.availability, filters.availability)) return false;
  if (filters.updatedWithinDays) {
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() - filters.updatedWithinDays);
    if (new Date(record.professionalUpdatedAt) < threshold) return false;
  }
  return true;
}

export function formatTalentPoolUpdate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
