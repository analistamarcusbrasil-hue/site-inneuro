import { internalNewApplicationTemplate } from "./communications/templates/internal-new-application";

export type CareerApplicationEmailData = {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  submittedAt: Date;
  siteUrl: string;
};

export function buildCareerApplicationEmail(data: CareerApplicationEmailData) {
  const adminUrl = new URL(
    `/admin/rh/vagas/${data.jobId}/candidaturas/${data.applicationId}`,
    data.siteUrl,
  ).toString();
  const message = internalNewApplicationTemplate({
    candidateName: data.candidateName,
    candidateEmail: data.candidateEmail,
    candidatePhone: data.candidatePhone,
    jobTitle: data.jobTitle,
    submittedAt: data.submittedAt.toISOString(),
    applicationId: data.applicationId,
    adminUrl,
  });
  return { ...message, adminUrl };
}
