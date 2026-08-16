import type { Metadata } from "next";
import { createHash } from "node:crypto";
import { AlertCircle, FileUp, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/container";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isPatientTokenActive } from "@/lib/scheduling/communications/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Corrigir pré-agendamento | INNEURO",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function CorrectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const validToken = /^[A-Za-z0-9_-]{40,64}$/.test(token);
  const admin = createSupabaseAdminClient();
  const hash = validToken
    ? createHash("sha256").update(token).digest("hex")
    : "invalid";
  const { data: access } = admin
    ? await admin
        .from("appointment_request_patient_tokens")
        .select("appointment_request_id,expires_at,used_at")
        .eq("token_hash", hash)
        .maybeSingle()
    : { data: null };
  const active =
    access && isPatientTokenActive(access.expires_at, access.used_at);
  const { data: appointment } =
    active && admin
      ? await admin
          .from("appointment_requests")
          .select(
            "patient_name,protocol,pending_reason,pending_correction,pending_guidance",
          )
          .eq("id", access.appointment_request_id)
          .single()
      : { data: null };

  return (
    <main id="main-content" className="bg-surface min-h-screen pt-28 pb-20">
      <Container className="max-w-3xl">
        <section className="border-border-light overflow-hidden rounded-[2rem] border bg-white">
          <header className="bg-brand-dark p-7 text-white sm:p-9">
            <ShieldCheck className="text-tech" aria-hidden="true" />
            <p className="text-mint mt-4 text-xs font-bold tracking-widest uppercase">
              Acesso seguro e temporário
            </p>
            <h1 className="font-heading mt-2 text-3xl font-semibold">
              Correção do pré-agendamento
            </h1>
          </header>
          <div className="p-7 sm:p-9">
            {query.status === "received" ? (
              <div
                role="status"
                className="bg-mint text-brand rounded-2xl p-6 text-center"
              >
                <FileUp className="mx-auto" aria-hidden="true" />
                <h2 className="font-heading mt-3 text-2xl font-semibold">
                  Documentação recebida
                </h2>
                <p className="mt-2 text-sm">
                  A recepção foi avisada e continuará a análise do seu
                  protocolo.
                </p>
              </div>
            ) : appointment ? (
              <>
                {query.error ? (
                  <p
                    role="alert"
                    className="bg-error/10 text-error mb-5 rounded-xl p-4 text-sm font-bold"
                  >
                    Não foi possível receber a correção. Revise o arquivo e
                    tente novamente.
                  </p>
                ) : null}
                <p className="text-muted text-sm">
                  {appointment.patient_name} · Protocolo{" "}
                  <strong className="text-ink">{appointment.protocol}</strong>
                </p>
                <div className="bg-surface mt-6 space-y-4 rounded-2xl p-5 text-sm">
                  <div>
                    <strong className="text-brand block text-xs uppercase">
                      Pendência
                    </strong>
                    <p className="mt-1">{appointment.pending_reason}</p>
                  </div>
                  <div>
                    <strong className="text-brand block text-xs uppercase">
                      O que corrigir
                    </strong>
                    <p className="mt-1">{appointment.pending_correction}</p>
                  </div>
                  <div>
                    <strong className="text-brand block text-xs uppercase">
                      Como proceder
                    </strong>
                    <p className="mt-1">{appointment.pending_guidance}</p>
                  </div>
                </div>
                <form
                  action={`/api/solicitacao/correcao/${token}`}
                  method="post"
                  encType="multipart/form-data"
                  className="mt-7 space-y-5"
                >
                  <label className="block text-sm font-bold">
                    Documento corrigido
                    <input
                      name="documents"
                      type="file"
                      multiple
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      className="border-border-light mt-2 block w-full rounded-xl border p-3 font-normal"
                    />
                    <span className="text-muted mt-1 block text-xs font-normal">
                      PDF, JPG, PNG ou WebP. Até 10 MB por arquivo.
                    </span>
                  </label>
                  <label className="block text-sm font-bold">
                    Informação complementar
                    <textarea
                      name="additional_information"
                      rows={4}
                      maxLength={1000}
                      className="border-border-light mt-2 w-full rounded-xl border p-3 font-normal"
                    />
                  </label>
                  <button className="bg-brand min-h-12 w-full rounded-full px-5 font-bold text-white">
                    Enviar correção
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center">
                <AlertCircle
                  className="text-warning mx-auto"
                  aria-hidden="true"
                />
                <h2 className="font-heading mt-3 text-2xl font-semibold">
                  Link indisponível
                </h2>
                <p className="text-muted mt-2 text-sm">
                  Este link expirou ou já foi utilizado. Entre em contato com a
                  INNEURO se ainda precisar enviar uma correção.
                </p>
              </div>
            )}
          </div>
        </section>
      </Container>
    </main>
  );
}
