import { NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { getAdminSession } from "@/lib/cms/auth";
import { getSurveyAdminContext } from "@/lib/surveys/server";
const schema = z.object({
  year: z.number().int().min(2020).max(2200),
  month: z.number().int().min(1).max(12),
});
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (
    !session.user ||
    !session.profile ||
    !hasAdminPermission(session.profile, "surveys.admin")
  )
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const context = await getSurveyAdminContext(session.user.id);
  if (!context)
    return NextResponse.json({ error: "NO_SCOPE" }, { status: 403 });
  const { data, error } = await context.admin.rpc(
    "generate_survey_monthly_snapshot",
    {
      p_organization_id: context.organization.id,
      p_unit_id: context.unit?.id ?? null,
      p_year: parsed.data.year,
      p_month: parsed.data.month,
      p_actor_id: session.user.id,
      p_force: true,
    },
  );
  if (error)
    return NextResponse.json({ error: "SNAPSHOT_ERROR" }, { status: 400 });
  return NextResponse.json({ ok: true, id: data });
}
