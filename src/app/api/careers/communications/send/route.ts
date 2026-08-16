import { NextResponse } from "next/server";
import { sendApplicationCommunication } from "@/lib/careers/communications/application-service";
import { getCareerCommunicationsApiSession } from "@/lib/careers/communications/api-auth";
import { consumeCareerAdminMailRateLimit } from "@/lib/careers/communications/rate-limit";
import { adminSendCommunicationSchema } from "@/lib/careers/communications/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const access = await getCareerCommunicationsApiSession();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "unauthorized" : "forbidden" },
      { status: access.status },
    );
  }
  const parsed = adminSendCommunicationSchema.safeParse(
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

  try {
    const communication = await sendApplicationCommunication({
      applicationId: parsed.data.applicationId,
      template: parsed.data.template,
      fields: parsed.data,
      triggeredBy: "admin",
      createdBy: access.session.user.id,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return NextResponse.json({
      id: communication.id,
      status: communication.status,
      attemptCount: communication.attempt_count,
      smtpAccepted: communication.status === "SENT",
    });
  } catch {
    return NextResponse.json(
      { error: "communication_failed" },
      { status: 500 },
    );
  }
}
