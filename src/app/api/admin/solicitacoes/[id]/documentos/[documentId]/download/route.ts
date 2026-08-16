import { serveAppointmentDocument } from "@/lib/scheduling/admin-document-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id, documentId } = await params;
  return serveAppointmentDocument(id, documentId, "attachment");
}
