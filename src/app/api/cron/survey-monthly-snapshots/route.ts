import { NextResponse } from "next/server";
import { getSurveyServiceClient } from "@/lib/surveys/server";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const db = getSurveyServiceClient();
  const date = new Date();
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1),
  );
  const { data: units, error } = await db
    .from("survey_units")
    .select("organization_id,id")
    .eq("active", true);
  if (error)
    return NextResponse.json({ error: "DATABASE_ERROR" }, { status: 500 });
  let generated = 0;
  for (const unit of units ?? []) {
    const result = await db.rpc("generate_survey_monthly_snapshot", {
      p_organization_id: unit.organization_id,
      p_unit_id: unit.id,
      p_year: start.getUTCFullYear(),
      p_month: start.getUTCMonth() + 1,
      p_force: false,
      p_actor_id: null,
    });
    if (!result.error) generated++;
  }
  return NextResponse.json({
    ok: true,
    generated,
    period: start.toISOString().slice(0, 7),
  });
}
