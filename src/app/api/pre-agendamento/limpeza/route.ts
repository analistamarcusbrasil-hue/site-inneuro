import type { NextRequest } from "next/server";
import {
  cleanupExpiredSchedulingRequests,
  getSchedulingAdminClient,
} from "@/lib/scheduling/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json(
      { error: "Não autorizado." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  try {
    const purged = await cleanupExpiredSchedulingRequests(
      getSchedulingAdminClient(),
    );
    return Response.json(
      { ok: true, purged },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Não foi possível concluir a limpeza." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
