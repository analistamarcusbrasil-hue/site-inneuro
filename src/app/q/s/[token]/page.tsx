import { PublicSurvey } from "@/components/surveys/public-survey";
import { getSurveyPublicDefinition } from "@/lib/surveys/server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sua experiência | INNEURO",
  robots: { index: false, follow: false },
};

export default async function SurveyQrPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const survey = await getSurveyPublicDefinition(token);
  if (!survey)
    return (
      <main className="grid min-h-dvh place-items-center bg-emerald-50 px-5 text-center">
        <div className="max-w-md rounded-[2rem] bg-white p-8 shadow-xl shadow-emerald-950/5">
          <p className="font-heading text-xl font-extrabold tracking-widest text-emerald-900">
            INNEURO
          </p>
          <h1 className="font-heading mt-6 text-3xl font-semibold text-slate-900">
            Pesquisa indisponível
          </h1>
          <p className="mt-4 leading-relaxed text-slate-600">
            Este QR Code não está ativo no momento. Confirme a peça impressa com nossa equipe.
          </p>
        </div>
      </main>
    );
  return <PublicSurvey survey={survey} />;
}
