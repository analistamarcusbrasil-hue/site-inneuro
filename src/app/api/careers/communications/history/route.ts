import { NextResponse } from "next/server";
import { getCareerCommunicationsApiSession } from "@/lib/careers/communications/api-auth";
import { communicationHistoryQuerySchema } from "@/lib/careers/communications/validation";

export async function GET(request: Request) {
  const access = await getCareerCommunicationsApiSession();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "unauthorized" : "forbidden" },
      { status: access.status },
    );
  }
  const url = new URL(request.url);
  const parsed = communicationHistoryQuerySchema.safeParse({
    applicationId: url.searchParams.get("applicationId"),
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { data, error } = await access.session.supabase
    .from("career_communications")
    .select(
      "id, type, subject, recipient_email, status, attempt_count, last_attempt_at, sent_at, failed_at, last_error_code, triggered_by, created_by, created_at",
    )
    .eq("application_id", parsed.data.applicationId)
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);
  if (error) {
    return NextResponse.json({ error: "history_unavailable" }, { status: 500 });
  }
  return NextResponse.json({ communications: data ?? [] });
}
