import type {
  CareerCommunicationTemplate,
  CareerCommunicationVariables,
} from "../types";
import { validateTemplateVariables } from "../validation";
import { applicationReceivedTemplate } from "./application-received";
import { applicationUnderReviewTemplate } from "./application-under-review";
import { approvedTemplate } from "./approved";
import { customMessageTemplate } from "./custom-message";
import { internalNewApplicationTemplate } from "./internal-new-application";
import { interviewInviteTemplate } from "./interview-invite";
import { practicalTestInviteTemplate } from "./practical-test-invite";
import { interviewReminderTemplate } from "./interview-reminder";
import { nextStageTemplate } from "./next-stage";
import { passwordRecoveryTemplate } from "./password-recovery";
import { processClosedTemplate } from "./process-closed";
import { rejectedTemplate } from "./rejected";
import { talentPoolTemplate } from "./talent-pool";
import {
  finalApprovedTemplate,
  stageOneApprovedTemplate,
  stageThreeApprovedTemplate,
  stageTwoApprovedTemplate,
} from "./stage-approved";

export function renderCareerCommunication(
  template: CareerCommunicationTemplate,
  variables: CareerCommunicationVariables,
) {
  const parsed = validateTemplateVariables(template, variables);
  switch (parsed.template) {
    case "APPLICATION_RECEIVED":
      return applicationReceivedTemplate(parsed);
    case "UNDER_REVIEW":
      return applicationUnderReviewTemplate(parsed);
    case "NEXT_STAGE":
      return nextStageTemplate(parsed);
    case "STAGE_1_APPROVED":
      return stageOneApprovedTemplate(parsed);
    case "STAGE_2_APPROVED":
      return stageTwoApprovedTemplate(parsed);
    case "STAGE_3_APPROVED":
      return stageThreeApprovedTemplate(parsed);
    case "FINAL_APPROVED":
      return finalApprovedTemplate(parsed);
    case "INTERVIEW_INVITE":
      return interviewInviteTemplate(parsed);
    case "PRACTICAL_TEST_INVITE":
      return practicalTestInviteTemplate(parsed);
    case "INTERVIEW_REMINDER":
      return interviewReminderTemplate(parsed);
    case "APPROVED":
      return approvedTemplate(parsed);
    case "TALENT_POOL":
      return talentPoolTemplate(parsed);
    case "REJECTED":
      return rejectedTemplate(parsed);
    case "PROCESS_CLOSED":
      return processClosedTemplate(parsed);
    case "CUSTOM_MESSAGE":
      return customMessageTemplate(parsed);
    case "INTERNAL_NEW_APPLICATION":
      return internalNewApplicationTemplate(parsed);
    case "PASSWORD_RECOVERY":
      return passwordRecoveryTemplate(parsed);
  }
}
