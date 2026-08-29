import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { SurveyNavigation, surveyNavigationPermissions } from "@/components/admin/survey-navigation";
import { SurveySettingsForm } from "@/components/admin/survey-settings-form";
import { requireAdminPermission } from "@/lib/cms/auth";
import { getSurveyAdminContext } from "@/lib/surveys/server";
export default async function SettingsPage() {
  const { user, profile } = await requireAdminPermission("surveys.manage");
  const context = await getSurveyAdminContext(user.id);
  if (!context) return <p>Acesso não configurado.</p>;
  return (
    <>
      <AdminPageHeading
        eyebrow="Satisfação do Cliente"
        title="Configurações"
        description="Identidade da campanha, disponibilidade e preferências públicas."
      />
      <SurveyNavigation
        current="settings"
        {...surveyNavigationPermissions(profile)}
      />
      <SurveySettingsForm
        campaign={{
          ...context.campaign,
          settings: context.campaign.settings as Record<string, unknown>,
        }}
      />
    </>
  );
}
