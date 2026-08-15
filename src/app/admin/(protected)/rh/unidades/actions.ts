"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import { companyUnitSchema } from "@/lib/careers/logistics-validation";

const unitsPath = "/admin/rh/unidades";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function revalidateUnits() {
  revalidatePath(unitsPath);
  revalidatePath("/admin/rh/vagas");
  revalidatePath("/admin/rh/vagas/nova");
  revalidatePath("/admin/rh");
}

export async function saveCompanyUnitAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("jobs:manage");
  const parsed = companyUnitSchema.safeParse({
    id: value(formData, "id") || undefined,
    name: value(formData, "name"),
    address: value(formData, "address"),
    neighborhood: value(formData, "neighborhood"),
    city: value(formData, "city"),
    state: value(formData, "state"),
    postalCode: value(formData, "postal_code"),
  });
  if (!parsed.success) redirect(`${unitsPath}?error=validation`);
  const payload = {
    name: parsed.data.name,
    address: parsed.data.address,
    neighborhood: parsed.data.neighborhood,
    city: parsed.data.city,
    state: parsed.data.state,
    postal_code: parsed.data.postalCode,
  };
  const result = parsed.data.id
    ? await supabase
        .from("company_units")
        .update(payload)
        .eq("id", parsed.data.id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("company_units")
        .insert(payload)
        .select("id")
        .single();
  if (result.error || !result.data) redirect(`${unitsPath}?error=save`);
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: parsed.data.id ? "company_unit_updated" : "company_unit_created",
    entity_type: "company_unit",
    entity_id: result.data.id,
    after_data: payload,
  });
  revalidateUnits();
  redirect(`${unitsPath}?status=${parsed.data.id ? "updated" : "created"}`);
}

export async function toggleCompanyUnitAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("jobs:manage");
  const parsed = companyUnitSchema.shape.id.safeParse(value(formData, "id"));
  const nextActive = value(formData, "active") === "true";
  if (!parsed.success || !parsed.data)
    redirect(`${unitsPath}?error=validation`);
  if (!nextActive) {
    const { count } = await supabase
      .from("career_jobs")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", parsed.data)
      .eq("status", "published");
    if (count) redirect(`${unitsPath}?error=in-use`);
  }
  const { error } = await supabase
    .from("company_units")
    .update({ active: nextActive })
    .eq("id", parsed.data);
  if (error) redirect(`${unitsPath}?error=save`);
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: nextActive ? "company_unit_activated" : "company_unit_deactivated",
    entity_type: "company_unit",
    entity_id: parsed.data,
    after_data: { active: nextActive },
  });
  revalidateUnits();
  redirect(`${unitsPath}?status=${nextActive ? "activated" : "deactivated"}`);
}
