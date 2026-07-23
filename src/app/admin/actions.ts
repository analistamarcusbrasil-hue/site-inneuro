"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isCmsConfigured } from "@/lib/cms/config";
import { requireAdmin } from "@/lib/cms/auth";
import { getCmsModule, type CmsModuleKey } from "@/lib/cms/modules";
import { moduleSchemas } from "@/lib/cms/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function loginAction(formData: FormData) {
  if (!isCmsConfigured) redirect("/admin?status=config-pending");
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/login?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.auth.signInWithPassword(parsed.data);
  if (error) redirect("/admin/login?error=credentials");
  redirect("/admin");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/admin/login");
}

function formValue(formData: FormData, name: string, type?: string) {
  if (type === "checkbox") return formData.get(name) === "on";
  if (type === "number") return Number(formData.get(name) || 0);
  return String(formData.get(name) ?? "").trim();
}

async function audit(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  actorId: string,
  action: string,
  entityType: string,
  entityId?: string,
  afterData?: unknown,
) {
  await supabase?.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    after_data: afterData,
  });
}

export async function saveContentAction(formData: FormData) {
  const moduleKey = String(formData.get("module")) as CmsModuleKey;
  const cmsModule = getCmsModule(moduleKey);
  if (!cmsModule) throw new Error("Módulo inválido.");
  const { supabase, user, profile } = await requireAdmin();

  const raw = Object.fromEntries(
    cmsModule.fields.map((field) => [
      field.name,
      formValue(formData, field.name, field.type),
    ]),
  );
  const parsed = moduleSchemas[moduleKey].safeParse(raw);
  if (!parsed.success) redirect(`/admin/${moduleKey}?error=validation`);

  const intent = String(formData.get("intent") || "draft");
  const id = String(formData.get("id") || "");
  if (["publish", "schedule"].includes(intent) && profile.role === "editor") {
    redirect(`/admin/${moduleKey}?error=permission`);
  }
  if (intent === "schedule" && !String(formData.get("publish_at") || "")) {
    redirect(`/admin/${moduleKey}?error=validation`);
  }

  const payload: Record<string, unknown> = {
    ...parsed.data,
    updated_by: user.id,
  };
  const mediaFieldNames: Partial<Record<CmsModuleKey, string[]>> = {
    carrossel: ["desktop_media_id", "mobile_media_id"],
    noticias: ["cover_media_id"],
    convenios: ["logo_media_id"],
    "redes-sociais": ["thumbnail_media_id"],
    equipamentos: ["cover_media_id"],
  };
  for (const field of mediaFieldNames[moduleKey] ?? []) {
    payload[field] = String(formData.get(field) || "") || null;
  }
  if (moduleKey === "equipamentos") {
    payload.gallery_media_ids = formData
      .getAll("gallery_media_ids")
      .map(String)
      .filter(Boolean);
  }
  if (moduleKey === "noticias") {
    payload.content = raw.content_text
      ? [{ type: "paragraph", text: String(raw.content_text) }]
      : [];
    delete payload.content_text;
  }
  for (const key of ["publish_at", "occurred_at"]) {
    if (key in payload) payload[key] = payload[key] || null;
  }
  payload.status =
    intent === "publish"
      ? "published"
      : intent === "schedule"
        ? "scheduled"
        : "draft";
  if (intent === "publish" && moduleKey === "noticias") {
    payload.published_at = new Date().toISOString();
  }

  let savedId = id;
  if (id) {
    const { error } = await supabase
      .from(cmsModule.table)
      .update(payload)
      .eq("id", id);
    if (error) redirect(`/admin/${moduleKey}?error=save`);
  } else {
    payload.created_by = user.id;
    const { data, error } = await supabase
      .from(cmsModule.table)
      .insert(payload)
      .select("id")
      .single();
    if (error) redirect(`/admin/${moduleKey}?error=save`);
    savedId = String(data.id);
  }

  await audit(
    supabase,
    user.id,
    id ? "update" : "create",
    cmsModule.table,
    savedId,
    payload,
  );
  revalidatePath("/");
  revalidatePath("/convenios");
  revalidatePath(`/admin/${moduleKey}`);
  redirect(`/admin/${moduleKey}?success=saved`);
}

export async function contentCommandAction(formData: FormData) {
  const moduleKey = String(formData.get("module")) as CmsModuleKey;
  const cmsModule = getCmsModule(moduleKey);
  const id = String(formData.get("id") || "");
  const command = String(formData.get("command") || "");
  if (!cmsModule || !id) throw new Error("Comando inválido.");

  const { supabase, user, profile } = await requireAdmin();
  const managerOnly = ["publish", "activate", "deactivate"];
  if (managerOnly.includes(command) && profile.role === "editor") {
    redirect(`/admin/${moduleKey}?error=permission`);
  }

  if (command === "duplicate") {
    const { data: original } = await supabase
      .from(cmsModule.table)
      .select("*")
      .eq("id", id)
      .single();
    if (original) {
      const copy = {
        ...original,
        id: undefined,
        status: "draft",
        active: false,
        created_by: user.id,
        updated_by: user.id,
        created_at: undefined,
        updated_at: undefined,
      };
      if ("slug" in copy) copy.slug = `${copy.slug}-copia-${Date.now()}`;
      if ("title" in copy) copy.title = `${copy.title} (cópia)`;
      await supabase.from(cmsModule.table).insert(copy);
    }
  } else {
    const updates: Record<string, unknown> = { updated_by: user.id };
    if (command === "archive")
      Object.assign(updates, {
        status: "archived",
        archived_at: new Date().toISOString(),
        active: false,
      });
    if (command === "restore")
      Object.assign(updates, { status: "draft", archived_at: null });
    if (command === "publish")
      Object.assign(updates, {
        status: "published",
        published_at:
          moduleKey === "noticias" ? new Date().toISOString() : undefined,
      });
    if (command === "activate") updates.active = true;
    if (command === "deactivate") updates.active = false;
    await supabase.from(cmsModule.table).update(updates).eq("id", id);
  }

  await audit(supabase, user.id, command, cmsModule.table, id);
  revalidatePath("/");
  revalidatePath("/convenios");
  revalidatePath(`/admin/${moduleKey}`);
}

const mediaSchema = z.object({
  kind: z.enum(["photo", "logo", "thumbnail"]),
  alt_text: z.string().trim().max(240),
  caption: z.string().trim().max(500).optional(),
  credit: z.string().trim().max(240).optional(),
  license: z.string().trim().max(240).optional(),
});

function detectImage(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mime: "image/jpeg", extensions: ["jpg", "jpeg"] };
  if (
    bytes
      .slice(0, 8)
      .every(
        (value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index],
      )
  )
    return { mime: "image/png", extensions: ["png"] };
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return { mime: "image/webp", extensions: ["webp"] };
  return null;
}

export async function uploadMediaAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const file = formData.get("file");
  const parsed = mediaSchema.safeParse(Object.fromEntries(formData));
  if (!(file instanceof File) || !parsed.success)
    redirect("/admin/midias?error=validation");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const limits = { photo: 8, logo: 2, thumbnail: 4 } as const;
  if (
    !detected ||
    detected.mime !== file.type ||
    !detected.extensions.includes(extension) ||
    file.size > limits[parsed.data.kind] * 1024 * 1024
  ) {
    redirect("/admin/midias?error=file");
  }

  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("site-media")
    .upload(path, bytes, { contentType: detected.mime, upsert: false });
  if (uploadError) redirect("/admin/midias?error=upload");

  const { error } = await supabase.from("media_assets").insert({
    bucket: "site-media",
    storage_path: path,
    original_name: file.name,
    mime_type: detected.mime,
    size_bytes: file.size,
    ...parsed.data,
    uploaded_by: user.id,
  });
  if (error) {
    await supabase.storage.from("site-media").remove([path]);
    redirect("/admin/midias?error=save");
  }
  await audit(supabase, user.id, "upload", "media_assets", path);
  revalidatePath("/admin/midias");
  redirect("/admin/midias?success=uploaded");
}

export async function inviteUserAction(formData: FormData) {
  const { user } = await requireAdmin(["super_admin"]);
  const parsed = z
    .object({
      email: z.string().email(),
      role: z.enum(["super_admin", "admin", "editor"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/usuarios?error=validation");
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/admin/usuarios?error=config");
  const { data, error } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { data: { full_name: "" } },
  );
  if (error || !data.user) redirect("/admin/usuarios?error=invite");
  await admin
    .from("profiles")
    .upsert({ id: data.user.id, role: parsed.data.role });
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "invite",
    entity_type: "profiles",
    entity_id: data.user.id,
    after_data: { role: parsed.data.role },
  });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?success=invited");
}

export async function updateUserRoleAction(formData: FormData) {
  const { user } = await requireAdmin(["super_admin"]);
  const parsed = z
    .object({
      id: z.string().uuid(),
      role: z.enum(["super_admin", "admin", "editor"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.id === user.id)
    redirect("/admin/usuarios?error=validation");
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/admin/usuarios?error=config");
  await admin
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.id);
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "role_update",
    entity_type: "profiles",
    entity_id: parsed.data.id,
    after_data: { role: parsed.data.role },
  });
  revalidatePath("/admin/usuarios");
}

export async function mediaCommandAction(formData: FormData) {
  const { supabase, user, profile } = await requireAdmin();
  const id = String(formData.get("id") || "");
  const command = String(formData.get("command") || "");
  if (!id || !["archive", "restore", "delete"].includes(command))
    throw new Error("Comando inválido.");
  if (command === "delete" && profile.role !== "super_admin")
    redirect("/admin/midias?error=permission");
  if (command === "delete") {
    const { data } = await supabase
      .from("media_assets")
      .select("storage_path")
      .eq("id", id)
      .single();
    if (data?.storage_path)
      await supabase.storage.from("site-media").remove([data.storage_path]);
    await supabase.from("media_assets").delete().eq("id", id);
  } else {
    await supabase
      .from("media_assets")
      .update({
        archived_at: command === "archive" ? new Date().toISOString() : null,
      })
      .eq("id", id);
  }
  await audit(supabase, user.id, command, "media_assets", id);
  revalidatePath("/admin/midias");
  revalidatePath("/admin/lixeira");
}

export async function updateMediaMetadataAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const parsed = mediaSchema
    .omit({ kind: true })
    .extend({ id: z.string().uuid() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/midias?error=validation");
  const { id, ...metadata } = parsed.data;
  await supabase.from("media_assets").update(metadata).eq("id", id);
  await audit(
    supabase,
    user.id,
    "metadata_update",
    "media_assets",
    id,
    metadata,
  );
  revalidatePath("/admin/midias");
  redirect("/admin/midias?success=updated");
}

const restorableTables = [
  "carousel_slides",
  "news_posts",
  "health_partners",
  "social_posts",
  "equipment",
] as const;

export async function trashCommandAction(formData: FormData) {
  const { supabase, user, profile } = await requireAdmin();
  const table = String(
    formData.get("table"),
  ) as (typeof restorableTables)[number];
  const id = String(formData.get("id") || "");
  const command = String(formData.get("command") || "restore");
  if (!restorableTables.includes(table) || !id)
    throw new Error("Comando inválido.");
  if (command === "delete") {
    if (profile.role !== "super_admin")
      redirect("/admin/lixeira?error=permission");
    await supabase.from(table).delete().eq("id", id);
  } else {
    await supabase
      .from(table)
      .update({ status: "draft", archived_at: null, updated_by: user.id })
      .eq("id", id);
  }
  await audit(supabase, user.id, command, table, id);
  revalidatePath("/admin/lixeira");
}
