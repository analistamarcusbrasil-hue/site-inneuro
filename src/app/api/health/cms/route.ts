import { getCmsConnectionStatus } from "@/lib/cms/get-cms-connection-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getCmsConnectionStatus();

  return Response.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
