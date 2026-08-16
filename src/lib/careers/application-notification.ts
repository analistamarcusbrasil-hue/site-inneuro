import "server-only";

import { notifyCareerApplicationCreated } from "./communications/application-service";

type CareerApplicationNotificationInput = {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  submittedAt: Date;
};

export async function notifyNewCareerApplication(
  input: CareerApplicationNotificationInput,
) {
  try {
    return await notifyCareerApplicationCreated({
      ...input,
      submittedAt: input.submittedAt.toISOString(),
    });
  } catch {
    return { candidate: null, internal: null };
  }
}
