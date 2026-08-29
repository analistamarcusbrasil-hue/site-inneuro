/* eslint-disable @next/next/no-img-element -- QR gerado em data URL, sem origem remota. */
import QRCode from "qrcode";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { SurveyNavigation, surveyNavigationPermissions } from "@/components/admin/survey-navigation";
import { requireAdminPermission } from "@/lib/cms/auth";
import { getSurveyAdminContext } from "@/lib/surveys/server";

export default async function QrCodePage() {
  const { user, profile } = await requireAdminPermission("surveys.qrcode");
  const context = await getSurveyAdminContext(user.id);
  if (!context) return <p>Acesso não configurado.</p>;
  const { data: qr } = await context.admin
    .from("survey_qr_codes")
    .select("stable_token,label,updated_at")
    .eq("campaign_id", context.campaign.id)
    .eq("active", true)
    .limit(1)
    .single();
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://inneuroap.com.br";
  const url = `${base}/q/s/${qr?.stable_token}`;
  const image = qr
    ? await QRCode.toDataURL(url, {
        width: 720,
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#063b2a", light: "#ffffff" },
      })
    : null;
  return (
    <>
      <AdminPageHeading
        eyebrow="Satisfação do Cliente"
        title="QR Code permanente"
        description="O mesmo endereço continua válido após alterações nas perguntas."
      />
      <SurveyNavigation
        current="qrcode"
        {...surveyNavigationPermissions(profile)}
      />
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <section className="border-border-light rounded-3xl border bg-white p-8 text-center">
          <p className="text-brand text-xs font-extrabold tracking-widest uppercase">Sua opinião importa 💚</p>
          <h2 className="font-heading text-brand-dark mt-2 text-2xl font-semibold">Conte como foi sua experiência conosco.</h2>
          <p className="mt-2 text-sm text-slate-500">Leva menos de 1 minuto.</p>
          {image ? (
            <img
              src={image}
              alt="QR Code da pesquisa de satisfação"
              className="mx-auto w-full max-w-80"
            />
          ) : null}
          <p className="font-heading text-brand-dark mt-4 text-xl font-semibold">
            {qr?.label ?? "Pesquisa de satisfação"}
          </p>
        </section>
        <section className="border-border-light rounded-3xl border bg-white p-7">
          <h2 className="font-heading text-2xl font-semibold">
            Materiais para recepção
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            Baixe o QR Code para impressão ou use o cartaz pronto em PDF. Não
            substitua o token por links manuais.
          </p>
          <label className="mt-6 block text-sm font-bold">
            Link permanente
            <input
              readOnly
              value={url}
              className="border-border-light mt-2 min-h-11 w-full rounded-xl border bg-slate-50 px-3 font-normal"
            />
          </label>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/api/admin/pesquisas/qrcode?formato=png"
              className="bg-brand rounded-full px-6 py-3 font-bold text-white"
            >
              Baixar PNG
            </a>
            <a
              href="/api/admin/pesquisas/qrcode?formato=pdf"
              className="rounded-full bg-slate-100 px-6 py-3 font-bold"
            >
              Baixar cartaz PDF
            </a>
          </div>
          <div className="mt-7 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Importante:</strong> regenerar a imagem não altera o
            endereço permanente.
          </div>
        </section>
      </div>
    </>
  );
}
