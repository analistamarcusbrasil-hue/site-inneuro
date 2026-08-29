import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { SurveyNavigation, surveyNavigationPermissions } from "@/components/admin/survey-navigation";
import { SurveyQuestionBuilder } from "@/components/admin/survey-question-builder";
import { requireAdminPermission } from "@/lib/cms/auth";
import {
  getSurveyAdminContext,
  getSurveyPublicDefinition,
} from "@/lib/surveys/server";

export default async function SurveyQuestionsPage() {
  const { user, profile } = await requireAdminPermission("surveys.manage");
  const context = await getSurveyAdminContext(user.id);
  if (!context) return <p>Acesso não configurado.</p>;
  const { data: qr } = await context.admin
    .from("survey_qr_codes")
    .select("stable_token")
    .eq("campaign_id", context.campaign.id)
    .eq("active", true)
    .limit(1)
    .single();
  const definition = qr
    ? await getSurveyPublicDefinition(qr.stable_token)
    : null;
  return (
    <>
      <AdminPageHeading
        eyebrow="Satisfação do Cliente"
        title="Perguntas"
        description="Edite a pesquisa com histórico imutável de versões."
      />
      <SurveyNavigation
        current="questions"
        {...surveyNavigationPermissions(profile)}
      />
      <SurveyQuestionBuilder
        initial={(definition?.questions ?? []) as never[]}
      />
    </>
  );
}
