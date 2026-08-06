"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isCmsConfigured } from "@/lib/cms/config";
import { getAdminSession, requireAdmin } from "@/lib/cms/auth";
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

function nonEmptyLines(value: unknown) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSchedules(value: unknown) {
  return nonEmptyLines(value).flatMap((line) => {
    const [label, days, periodsValue] = line
      .split("|")
      .map((item) => item.trim());
    if (!label || !days || !periodsValue) return [];
    const periods = periodsValue.split(";").flatMap((period) => {
      const [start, end] = period
        .split(/\s*[-–—]\s*/)
        .map((item) => item.trim());
      return start && end ? [{ start, end }] : [];
    });
    return periods.length ? [{ label, days, periods }] : [];
  });
}

function parsePreparationGroups(value: unknown) {
  return nonEmptyLines(value).flatMap((line) => {
    const [title, appliesToValue, instructionsValue, warning] = line
      .split("|")
      .map((item) => item.trim());
    if (!title || !appliesToValue || !instructionsValue) return [];
    return [
      {
        title,
        appliesTo: appliesToValue
          .split(";")
          .map((item) => item.trim())
          .filter(Boolean),
        instructions: instructionsValue
          .split(";")
          .map((item) => item.trim())
          .filter(Boolean),
        ...(warning ? { warning } : {}),
      },
    ];
  });
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
    exames: ["cover_media_id"],
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
  if (moduleKey === "carrossel" && payload.linked_news_id) {
    const { data: linkedNews } = await supabase
      .from("news_posts")
      .select("slug")
      .eq("id", String(payload.linked_news_id))
      .maybeSingle();
    if (!linkedNews) redirect(`/admin/${moduleKey}?error=validation`);
    payload.cta_url = `/noticias/${linkedNews.slug}`;
    payload.open_in_new_tab = false;
  }
  if (moduleKey === "preparos") {
    payload.search_terms = nonEmptyLines(raw.search_terms_text);
    payload.schedules = parseSchedules(raw.schedules_text);
    payload.preparation_groups = parsePreparationGroups(
      raw.preparation_groups_text,
    );
    payload.documents = nonEmptyLines(raw.documents_text);
    payload.safety_questions = nonEmptyLines(raw.safety_questions_text);
    for (const key of [
      "search_terms_text",
      "schedules_text",
      "preparation_groups_text",
      "documents_text",
      "safety_questions_text",
    ])
      delete payload[key];
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
  if (moduleKey === "carrossel" && intent !== "draft") {
    let hasPersistedImage = false;
    if (id) {
      const { data: current } = await supabase
        .from("carousel_slides")
        .select("image_url,desktop_media_id")
        .eq("id", id)
        .maybeSingle();
      hasPersistedImage = Boolean(
        current?.image_url || current?.desktop_media_id,
      );
    }
    if (!payload.desktop_media_id && !hasPersistedImage)
      redirect(`/admin/${moduleKey}?error=image-required`);
  }
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

  if (moduleKey === "noticias") {
    const newsData = parsed.data as z.infer<typeof moduleSchemas.noticias>;
    if (newsData.show_in_carousel) {
      const coverId = String(formData.get("cover_media_id") || "") || null;
      const { data: cover } = coverId
        ? await supabase
            .from("media_assets")
            .select("alt_text")
            .eq("id", coverId)
            .maybeSingle()
        : { data: null };
      const carouselPayload = {
        title: newsData.title,
        description: newsData.summary,
        category: newsData.category || "Notícia",
        desktop_media_id: coverId,
        image_alt: cover?.alt_text || `Imagem de capa: ${newsData.title}`,
        cta_label: "Ler matéria",
        cta_url: `/noticias/${newsData.slug}`,
        linked_news_id: savedId,
        open_in_new_tab: false,
        status: payload.status,
        active: intent !== "draft",
        publish_at: payload.publish_at ?? null,
        updated_by: user.id,
      };
      const { data: linkedSlide } = await supabase
        .from("carousel_slides")
        .select("id")
        .eq("linked_news_id", savedId)
        .maybeSingle();
      const { error: carouselError } = linkedSlide
        ? await supabase
            .from("carousel_slides")
            .update(carouselPayload)
            .eq("id", linkedSlide.id)
        : await supabase.from("carousel_slides").insert({
            ...carouselPayload,
            sort_order: 999,
            created_by: user.id,
          });
      if (carouselError) redirect(`/admin/${moduleKey}?error=carousel-link`);
    } else {
      await supabase
        .from("carousel_slides")
        .update({ active: false, updated_by: user.id })
        .eq("linked_news_id", savedId);
    }
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
  revalidatePath("/noticias");
  revalidatePath("/exames");
  revalidatePath("/preparos");
  revalidatePath("/contato");
  revalidatePath("/sobre");
  if (moduleKey === "noticias") {
    revalidatePath(`/noticias/${String(raw.slug ?? "")}`);
  }
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
  const supportsActive = cmsModule.fields.some(
    (field) => field.name === "active",
  );
  const managerOnly = ["publish", "activate", "deactivate"];
  if (managerOnly.includes(command) && profile.role === "editor") {
    redirect(`/admin/${moduleKey}?error=permission`);
  }

  if (command === "duplicate") {
    const { data: original, error: readError } = await supabase
      .from(cmsModule.table)
      .select("*")
      .eq("id", id)
      .single();
    if (readError || !original) redirect(`/admin/${moduleKey}?error=duplicate`);
    if (original) {
      const copy = {
        ...original,
        id: undefined,
        status: "draft",
        created_by: user.id,
        updated_by: user.id,
        created_at: undefined,
        updated_at: undefined,
      };
      if (supportsActive) copy.active = false;
      if ("slug" in copy) copy.slug = `${copy.slug}-copia-${Date.now()}`;
      if ("title" in copy) copy.title = `${copy.title} (cópia)`;
      const { error } = await supabase.from(cmsModule.table).insert(copy);
      if (error) redirect(`/admin/${moduleKey}?error=duplicate`);
    }
  } else {
    const updates: Record<string, unknown> = { updated_by: user.id };
    if (command === "archive")
      Object.assign(updates, {
        status: "archived",
        archived_at: new Date().toISOString(),
        ...(supportsActive ? { active: false } : {}),
      });
    if (command === "restore")
      Object.assign(updates, { status: "draft", archived_at: null });
    if (command === "publish")
      Object.assign(updates, {
        status: "published",
        ...(moduleKey === "noticias"
          ? { published_at: new Date().toISOString() }
          : {}),
      });
    if (command === "activate") updates.active = true;
    if (command === "deactivate") updates.active = false;
    const { error } = await supabase
      .from(cmsModule.table)
      .update(updates)
      .eq("id", id);
    if (error) redirect(`/admin/${moduleKey}?error=command`);
  }

  await audit(supabase, user.id, command, cmsModule.table, id);
  revalidatePath("/");
  revalidatePath("/convenios");
  revalidatePath("/noticias");
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

export type MediaUploadResult = {
  ok: boolean;
  message: string;
  code?: "validation" | "file" | "size" | "session" | "storage" | "save";
};

export async function uploadMediaAction(
  formData: FormData,
): Promise<MediaUploadResult> {
  const session = await getAdminSession();
  if (!session.user || !session.profile || !session.supabase)
    return {
      ok: false,
      code: "session",
      message: "Sua sessão expirou. Entre novamente.",
    };
  const { supabase, user } = session;
  const file = formData.get("file");
  const parsed = mediaSchema.safeParse(Object.fromEntries(formData));
  if (!(file instanceof File) || !parsed.success)
    return {
      ok: false,
      code: "validation",
      message: "Preencha a descrição e escolha uma imagem válida.",
    };

  if (file.size > 8 * 1024 * 1024)
    return {
      ok: false,
      code: "size",
      message: "A imagem excede o limite de 8 MB.",
    };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (
    !detected ||
    detected.mime !== file.type ||
    !detected.extensions.includes(extension)
  ) {
    return {
      ok: false,
      code: "file",
      message: "Formato não permitido. Envie uma imagem JPG, PNG ou WebP.",
    };
  }

  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("site-media")
    .upload(path, bytes, { contentType: detected.mime, upsert: false });
  if (uploadError) {
    console.error("Falha no upload do CMS", {
      code: uploadError.name,
      message: uploadError.message,
    });
    return {
      ok: false,
      code: "storage",
      message: uploadError.message.toLowerCase().includes("bucket")
        ? "O armazenamento de imagens não está configurado."
        : "Não foi possível concluir o envio. Verifique sua conexão e tente novamente.",
    };
  }

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
    console.error("Falha ao registrar mídia do CMS", {
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      code: "save",
      message:
        "A imagem foi enviada, mas não pôde ser registrada. Tente novamente.",
    };
  }
  await audit(supabase, user.id, "upload", "media_assets", path);
  revalidatePath("/admin/midias");
  return { ok: true, message: "Imagem enviada com sucesso." };
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
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: data.user.id, role: parsed.data.role });
  if (profileError) redirect("/admin/usuarios?error=profile");
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
  const { error } = await admin
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.id);
  if (error) redirect("/admin/usuarios?error=role");
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "role_update",
    entity_type: "profiles",
    entity_id: parsed.data.id,
    after_data: { role: parsed.data.role },
  });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?success=role");
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
    const { error: deleteError } = await supabase
      .from("media_assets")
      .delete()
      .eq("id", id);
    if (deleteError) redirect("/admin/midias?error=in-use");
    if (data?.storage_path) {
      const { error: storageError } = await supabase.storage
        .from("site-media")
        .remove([data.storage_path]);
      if (storageError) redirect("/admin/midias?error=storage");
    }
  } else {
    const { error } = await supabase
      .from("media_assets")
      .update({
        archived_at: command === "archive" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) redirect("/admin/midias?error=command");
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
  const { error } = await supabase
    .from("media_assets")
    .update(metadata)
    .eq("id", id);
  if (error) redirect("/admin/midias?error=metadata");
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

const institutionalSchema = z.object({
  full_name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(500),
  phone: z.string().trim().max(40),
  email: z.string().trim().email().or(z.literal("")),
  opening_hours: z.string().trim().max(500),
  whatsapp_primary_label: z.string().trim().min(1).max(80),
  whatsapp_primary_display: z.string().trim().min(1).max(40),
  whatsapp_primary_number: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/),
  whatsapp_secondary_label: z.string().trim().min(1).max(80),
  whatsapp_secondary_display: z.string().trim().min(1).max(40),
  whatsapp_secondary_number: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/),
  instagram_url: z.string().trim().url(),
  instagram_handle: z.string().trim().min(1).max(80),
  address_street: z.string().trim().min(1).max(160),
  address_number: z.string().trim().min(1).max(30),
  address_neighborhood: z.string().trim().min(1).max(120),
  address_city: z.string().trim().min(1).max(120),
  address_state: z.string().trim().min(2).max(2),
  address_postal_code: z.string().trim().max(20),
  address_reference: z.string().trim().max(300),
  maps_url: z.string().trim().url(),
  patient_portal_url: z.string().trim().url(),
  about_title: z.string().trim().min(1).max(160),
  about_description: z.string().trim().min(1).max(500),
  about_purpose: z.string().trim().min(1).max(1000),
  about_technology: z.string().trim().min(1).max(1000),
});

export async function saveInstitutionalSettingsAction(formData: FormData) {
  const { supabase, user } = await requireAdmin(["super_admin", "admin"]);
  const parsed = institutionalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/informacoes?error=validation");
  const { data: current } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "institutional")
    .maybeSingle();
  const value = {
    ...((current?.value && typeof current.value === "object"
      ? current.value
      : {}) as Record<string, unknown>),
    ...parsed.data,
  };
  const { error } = await supabase.from("site_settings").upsert({
    key: "institutional",
    category: "institutional",
    is_public: true,
    value,
    updated_by: user.id,
  });
  if (error) redirect("/admin/informacoes?error=save");
  await audit(
    supabase,
    user.id,
    "update",
    "site_settings",
    "institutional",
    parsed.data,
  );
  for (const path of [
    "/",
    "/contato",
    "/sobre",
    "/exames",
    "/preparos",
    "/convenios",
    "/admin/informacoes",
  ])
    revalidatePath(path);
  redirect("/admin/informacoes?success=saved");
}

const restorableTables = [
  "carousel_slides",
  "news_posts",
  "health_partners",
  "social_posts",
  "equipment",
  "exams",
  "preparations",
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
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) redirect("/admin/lixeira?error=delete");
  } else {
    const { error } = await supabase
      .from(table)
      .update({ status: "draft", archived_at: null, updated_by: user.id })
      .eq("id", id);
    if (error) redirect("/admin/lixeira?error=restore");
  }
  await audit(supabase, user.id, command, table, id);
  revalidatePath("/admin/lixeira");
}
