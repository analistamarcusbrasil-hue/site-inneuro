export const jobStatuses = ["draft", "published", "paused", "closed"] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const jobStatusLabels: Record<JobStatus, string> = {
  draft: "Rascunho",
  published: "Publicada",
  paused: "Pausada",
  closed: "Encerrada",
};

export const workModes = ["onsite", "hybrid", "remote"] as const;
export type WorkMode = (typeof workModes)[number];

export const workModeLabels: Record<WorkMode, string> = {
  onsite: "Presencial",
  hybrid: "Híbrido",
  remote: "Remoto",
};

export type CareerJobArea = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CareerJob = {
  id: string;
  slug: string;
  title: string;
  area_id: string;
  unit_id?: string | null;
  positions: number | null;
  location: string;
  work_mode: WorkMode;
  work_schedule: string | null;
  description: string;
  activities: string;
  schooling: string;
  desirable_experience: string | null;
  required_requirements: string;
  desirable_requirements: string | null;
  skills: string;
  certifications: string | null;
  opens_on: string;
  closes_on: string | null;
  status: JobStatus;
  published_at: string | null;
  created_by: string;
  updated_by: string;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  area?: Pick<CareerJobArea, "id" | "name" | "slug" | "is_active"> | null;
  unit?: {
    id: string;
    name: string;
    address: string;
    neighborhood: string;
    city: string;
    state: string;
    postal_code: string | null;
    active: boolean;
  } | null;
};

export function currentMacapaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Belem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export function slugifyJobValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const allowedTransitions: Record<JobStatus, readonly JobStatus[]> = {
  draft: ["published", "closed"],
  published: ["paused", "closed"],
  paused: ["published", "closed"],
  closed: [],
};

export function canTransitionJob(from: JobStatus, to: JobStatus) {
  return allowedTransitions[from].includes(to);
}

export function formatJobDate(date: string | null | undefined) {
  if (!date) return "Sem data definida";
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}

export function isJobPubliclyAvailable(
  job: Pick<CareerJob, "status" | "opens_on" | "closes_on">,
  today = currentMacapaDate(),
) {
  return (
    job.status === "published" &&
    job.opens_on <= today &&
    (!job.closes_on || job.closes_on >= today)
  );
}
