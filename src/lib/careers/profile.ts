export const CANDIDATE_RESUME_BUCKET = "candidate-resumes";
export const CANDIDATE_RESUME_MAX_BYTES = 10 * 1024 * 1024;

export type CandidateProfessionalProfile = {
  candidate_id: string;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  professional_objective: string | null;
  about: string | null;
  availability: string | null;
  created_at: string;
  updated_at: string;
};

export type CandidateExperience = {
  id: string;
  candidate_id: string;
  company: string;
  job_title: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  activities: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CandidateEducation = {
  id: string;
  candidate_id: string;
  education_level: string;
  course: string;
  institution: string;
  start_date: string;
  end_date: string | null;
  in_progress: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CandidateCertification = {
  id: string;
  candidate_id: string;
  name: string;
  institution: string;
  completion_year: number;
  expires_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CandidateSkill = {
  id: string;
  candidate_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type CandidateResume = {
  id: string;
  candidate_id: string;
  original_name: string;
  storage_path: string;
  size_bytes: number;
  mime_type: "application/pdf";
  version: number;
  created_at: string;
};

export type CandidateProfileCompletionInput = {
  fullName?: string | null;
  email?: string | null;
  emailPresent?: boolean;
  profile?: Partial<CandidateProfessionalProfile> | null;
  experienceCount: number;
  educationCount: number;
  skillCount: number;
  resumeCount: number;
};

export function calculateCandidateProfileCompletion(
  input: CandidateProfileCompletionInput,
) {
  const checks = [
    Boolean(input.fullName?.trim()),
    input.emailPresent ?? Boolean(input.email?.trim()),
    Boolean(input.profile?.whatsapp?.trim()),
    Boolean(input.profile?.city?.trim() && input.profile?.state?.trim()),
    Boolean(input.profile?.professional_objective?.trim()),
    Boolean(input.profile?.about?.trim()),
    Boolean(input.profile?.availability?.trim()),
    input.experienceCount > 0,
    input.educationCount > 0,
    input.skillCount > 0,
    input.resumeCount > 0,
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

export function hasPdfMagicNumber(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
}

export function monthInputValue(date: string | null | undefined) {
  return date ? date.slice(0, 7) : "";
}

export function formatCandidateMonth(date: string | null | undefined) {
  if (!date) return "Atual";
  const [year, month] = date.slice(0, 7).split("-");
  return `${month}/${year}`;
}

export function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
