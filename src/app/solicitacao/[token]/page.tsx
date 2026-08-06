import type { Metadata } from "next";
import { CalendarClock, FileCheck2, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/container";
import { documentLabels } from "@/lib/scheduling/shared";
import { getSchedulingRequest } from "@/lib/scheduling/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Solicitação temporária | INNEURO",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

function formatDate(value: string, includeTime = false) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    ...(includeTime ? { timeStyle: "short" } : {}),
    timeZone: "America/Sao_Paulo",
  }).format(new Date(includeTime ? value : `${value}T12:00:00Z`));
}

function StatusCard({ expired }: { expired: boolean }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-surface min-h-[70vh] pt-32 pb-20"
    >
      <Container className="max-w-3xl">
        <div className="border-border-light rounded-[2rem] border bg-white p-7 text-center sm:p-10">
          <CalendarClock
            aria-hidden="true"
            className="text-brand mx-auto"
            size={34}
          />
          <h1 className="font-heading text-ink mt-5 text-3xl font-semibold">
            {expired
              ? "Esta solicitação expirou."
              : "Solicitação não encontrada."}
          </h1>
          <p className="text-muted mx-auto mt-4 max-w-xl leading-relaxed">
            {expired
              ? "O acesso aos dados e documentos foi encerrado após 48 horas. Solicite um novo pré-agendamento se ainda precisar de atendimento."
              : "Confira se o link foi copiado por completo. Por segurança, não é possível buscar solicitações por nome ou telefone."}
          </p>
        </div>
      </Container>
    </main>
  );
}

export default async function SchedulingRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let request: Awaited<ReturnType<typeof getSchedulingRequest>>;
  try {
    request = await getSchedulingRequest(token);
  } catch {
    return <StatusCard expired={false} />;
  }
  if (request.status !== "active")
    return <StatusCard expired={request.status === "expired"} />;

  const { manifest } = request;
  const details = [
    ["Protocolo", manifest.protocol],
    ["Nome", manifest.patientName],
    ["Data de nascimento", formatDate(manifest.birthDate)],
    ["Telefone", manifest.phone],
    ["Modalidade", manifest.attendance],
    ["Convênio", manifest.insuranceName ?? "Não se aplica"],
    ["Exame ou procedimento", manifest.exam],
    ["Período preferido", manifest.preferredPeriod],
    ["Observações", manifest.observations ?? "Não informadas"],
    [
      "Datas preferenciais",
      manifest.preferredDates?.map((date) => formatDate(date)).join(" · ") ??
        "Não informadas",
    ],
    ["Solicitação criada em", formatDate(manifest.createdAt, true)],
  ];

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-surface pt-28 pb-20 sm:pt-32"
    >
      <Container className="max-w-5xl">
        <div className="border-border-light overflow-hidden rounded-[2rem] border bg-white">
          <header className="bg-brand-dark p-7 text-white sm:p-10">
            <div className="flex items-start gap-4">
              <ShieldCheck
                aria-hidden="true"
                className="text-tech mt-1 shrink-0"
                size={28}
              />
              <div>
                <p className="text-mint text-xs font-bold tracking-[0.14em] uppercase">
                  Acesso temporário e restrito
                </p>
                <h1 className="font-heading mt-3 text-3xl font-semibold sm:text-4xl">
                  Solicitação de pré-agendamento
                </h1>
                <p className="mt-3 text-sm text-white/70">
                  Disponível até {formatDate(manifest.expiresAt, true)}.
                </p>
              </div>
            </div>
          </header>

          <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1.2fr_.8fr]">
            <section aria-labelledby="patient-details-title">
              <h2
                id="patient-details-title"
                className="font-heading text-ink text-2xl font-semibold"
              >
                Dados da solicitação
              </h2>
              <dl className="border-border-light mt-5 divide-y rounded-2xl border px-5">
                {details.map(([label, value]) => (
                  <div
                    key={label}
                    className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-4"
                  >
                    <dt className="text-muted text-sm font-semibold">
                      {label}
                    </dt>
                    <dd className="text-ink text-sm break-words">{value}</dd>
                  </div>
                ))}
              </dl>
              {manifest.exams?.length ? (
                <div className="mt-6">
                  <h3 className="font-heading text-ink text-lg font-semibold">
                    Exames solicitados ({manifest.exams.length})
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {manifest.exams.map((exam) => (
                      <li
                        key={exam.id}
                        className="bg-surface rounded-xl p-3 text-sm"
                      >
                        <strong>{exam.name}</strong>
                        {exam.modality ? (
                          <span className="text-muted mt-1 block">
                            {exam.modality}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <section aria-labelledby="documents-title">
              <h2
                id="documents-title"
                className="font-heading text-ink text-2xl font-semibold"
              >
                Documentos enviados
              </h2>
              <div className="mt-5 grid gap-3">
                {manifest.documents.map((document) => (
                  <a
                    key={document.id ?? `${document.kind}-${document.path}`}
                    href={`/api/solicitacao/${token}/documento/${document.id ?? document.kind}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-brand/15 hover:border-brand/40 focus-visible:ring-tech text-brand-dark flex min-h-14 items-center gap-3 rounded-2xl border bg-white px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    aria-label={`Abrir ${documentLabels[document.kind]} em nova aba`}
                  >
                    <FileCheck2
                      aria-hidden="true"
                      className="text-brand"
                      size={20}
                    />
                    <span>
                      {documentLabels[document.kind]}
                      <span className="text-muted mt-1 block text-xs font-normal">
                        {document.name ?? "Arquivo enviado"}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
              <p className="text-muted mt-5 text-sm leading-relaxed">
                Os arquivos são privados e cada acesso gera uma autorização
                temporária de curta duração.
              </p>
            </section>
          </div>
        </div>
      </Container>
    </main>
  );
}
