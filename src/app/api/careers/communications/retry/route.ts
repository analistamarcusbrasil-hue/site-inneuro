import { NextResponse } from "next/server";
import { getCareerCommunicationsApiSession } from "@/lib/careers/communications/api-auth";
import { consumeCareerAdminMailRateLimit } from "@/lib/careers/communications/rate-limit";
import { getCareerCommunicationService } from "@/lib/careers/communications/service";
import { retryCareerCommunicationSchema } from "@/lib/careers/communications/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const access = await getCareerCommunicationsApiSession();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "unauthorized" : "forbidden" },
      { status: access.status },
    );
  }
  const parsed = retryCareerCommunicationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  if (
    !admin ||
    !(await consumeCareerAdminMailRateLimit(admin, access.session.user.id))
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const { data } = await access.session.supabase
    .from("career_communications")
    .select("id, status, attempt_count, type")
    .eq("id", parsed.data.communicationId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!["PENDING", "FAILED"].includes(data.status) || data.attempt_count >= 3) {
    return NextResponse.json({ error: "retry_not_allowed" }, { status: 409 });
  }
  if (data.type === "PASSWORD_RECOVERY") {
    return NextResponse.json({ error: "retry_not_allowed" }, { status: 409 });
  }
  const result = await getCareerCommunicationService().process(data.id);
  return NextResponse.json({
    id: result.id,
    status: result.status,
    attemptCount: result.attempt_count,
    smtpAccepted: result.status === "SENT",
  });
}
