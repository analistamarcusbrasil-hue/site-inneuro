import type { NextRequest } from "next/server";
import {
  consumeSchedulingRateLimit,
  createPreparedUploadSession,
  ensureSchedulingBucket,
  getSchedulingAdminClient,
  isSecureSchedulingRequest,
} from "@/lib/scheduling/server";
import {
  serviceTypes,
  type SchedulingFileDescriptor,
  type ServiceType,
} from "@/lib/scheduling/shared";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: responseHeaders });
}

export async function POST(request: NextRequest) {
  try {
    if (!isSecureSchedulingRequest(request))
      return json({ error: "O envio seguro requer uma conexão HTTPS." }, 400);

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 64 * 1024)
      return json({ error: "Solicitação inválida." }, 413);

    const body = (await request.json()) as {
      serviceType?: unknown;
      authorizationPending?: unknown;
      files?: unknown;
      website?: unknown;
      startedAt?: unknown;
    };
    if (String(body.website ?? "").trim()) return json({ ok: true });

    const startedAt = Number(body.startedAt);
    const elapsed = Date.now() - startedAt;
    if (
      !Number.isFinite(startedAt) ||
      elapsed < 1500 ||
      elapsed > 2 * 60 * 60 * 1000
    )
      return json({ error: "Atualize a página e tente novamente." }, 400);

    const serviceType = body.serviceType;
    if (!(serviceTypes as readonly unknown[]).includes(serviceType))
      return json({ error: "Selecione o tipo de atendimento." }, 400);
    if (
      !Array.isArray(body.files) ||
      body.files.length < 1 ||
      body.files.length > 12
    )
      return json({ error: "Revise os documentos selecionados." }, 400);

    const admin = getSchedulingAdminClient();
    await ensureSchedulingBucket(admin);
    const allowed = await consumeSchedulingRateLimit(admin, request);
    if (!allowed)
      return json(
        {
          error:
            "Muitas tentativas foram realizadas. Aguarde 15 minutos e tente novamente.",
        },
        429,
      );

    const prepared = await createPreparedUploadSession(
      admin,
      serviceType as ServiceType,
      body.files as SchedulingFileDescriptor[],
      body.authorizationPending === true,
    );
    return json(prepared);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message &&
      !message.startsWith("SCHEDULING_") &&
      message.length <= 140
    ) {
      return json({ error: message }, 400);
    }
    if (message === "SCHEDULING_NOT_CONFIGURED")
      return json(
        { error: "O envio de documentos está temporariamente indisponível." },
        503,
      );
    return json(
      {
        error:
          "Não foi possível preparar o envio. Tente novamente em instantes.",
      },
      500,
    );
  }
}
