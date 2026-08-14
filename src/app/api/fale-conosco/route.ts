import type { NextRequest } from "next/server";
import {
  createContactServiceDependencies,
  isSameOriginContactRequest,
  isSecureContactRequest,
} from "@/lib/contact/server";
import {
  ContactRateLimitError,
  processContactMessage,
} from "@/lib/contact/service";
import { contactMessageSchema } from "@/lib/contact/shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
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
    if (!isSecureContactRequest(request)) {
      return json({ error: "O envio seguro requer uma conexão HTTPS." }, 400);
    }
    if (!isSameOriginContactRequest(request)) {
      return json(
        { error: "Não foi possível validar a origem do envio." },
        403,
      );
    }
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      return json({ error: "Formato de envio inválido." }, 415);
    }
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 32 * 1024) {
      return json({ error: "A mensagem ultrapassa o tamanho permitido." }, 413);
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 32 * 1024) {
      return json({ error: "A mensagem ultrapassa o tamanho permitido." }, 413);
    }
    let body: Record<string, unknown>;
    try {
      const value = JSON.parse(rawBody) as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return json({ error: "Formato de envio inválido." }, 400);
      }
      body = value as Record<string, unknown>;
    } catch {
      return json({ error: "Formato de envio inválido." }, 400);
    }
    if (String(body.website ?? "").trim()) {
      return json({ ok: true });
    }
    const startedAt = Number(body.startedAt);
    const elapsed = Date.now() - startedAt;
    if (
      !Number.isFinite(startedAt) ||
      elapsed < 1500 ||
      elapsed > 2 * 60 * 60 * 1000
    ) {
      return json({ error: "Atualize a página e tente novamente." }, 400);
    }

    const parsed = contactMessageSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        {
          error: "Revise os campos destacados e tente novamente.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const result = await processContactMessage(
      parsed.data,
      createContactServiceDependencies(request),
    );
    return json({ ok: true, protocol: result.protocol });
  } catch (error) {
    if (error instanceof ContactRateLimitError) {
      return json(
        {
          error:
            "Muitas mensagens foram enviadas. Aguarde 15 minutos e tente novamente.",
        },
        429,
      );
    }
    const code = error instanceof Error ? error.message : "";
    if (
      [
        "CONTACT_NOT_CONFIGURED",
        "CONTACT_DATABASE_UNAVAILABLE",
        "CONTACT_RATE_LIMIT_UNAVAILABLE",
        "CONTACT_PROTOCOL_UNAVAILABLE",
      ].includes(code)
    ) {
      return json(
        {
          error:
            "Não foi possível enviar sua mensagem neste momento. Revise os dados e tente novamente.",
        },
        503,
      );
    }
    return json(
      {
        error:
          "Não foi possível enviar sua mensagem neste momento. Revise os dados e tente novamente.",
      },
      500,
    );
  }
}
