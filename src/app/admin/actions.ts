"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isCmsConfigured } from "@/lib/cms/config";
import {
  getAdminSession,
  requireAdmin,
  requireAdminPermission,
} from "@/lib/cms/auth";
import { getCmsModule, type CmsModuleKey } from "@/lib/cms/modules";
import { moduleSchemas } from "@/lib/cms/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  adminPermissions,
  hasAdminPermission,
  normalizeAdminPermissions,
  permissionsForProfile,
  type AccessProfile,
  type AdminPermission,
} from "@/lib/admin/permissions";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function loginAction(formData: FormData) {
  if (!isCmsConfigured) redirect("/admin?status=config-pending");
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/login?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { data: authData, error } = await supabase!.auth.signInWithPassword(
    parsed.data,
  );
  if (error) redirect("/admin/login?error=credentials");
  const { data: profile } = await supabase!
    .from("profiles")
    .select("active, must_change_password")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (!profile?.active) {
    await supabase!.auth.signOut();
    redirect("/admin/login?error=inactive");
  }
  const admin = createSupabaseAdminClient();
  await admin
    ?.from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", authData.user.id);
  if (profile.must_change_password) redirect("/admin/definir-senha");
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

export async function saveContentAction(
  formData: FormData,
): Promise<SaveContentResult> {
  const moduleKey = String(formData.get("module")) as CmsModuleKey;
  const cmsModule = getCmsModule(moduleKey);
  if (!cmsModule) throw new Error("Módulo inválido.");
  const { supabase, user, profile } =
    await requireAdminPermission("publications.edit");

  const failure = (
    code: SaveContentErrorCode,
    message: string,
    error?: {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    },
    stage?: string,
  ): SaveContentResult => {
    const errorId = crypto.randomUUID().slice(0, 8).toUpperCase();
    if (error) {
      console.error("Falha ao salvar conteúdo do CMS", {
        errorId,
        module: moduleKey,
        stage,
        actorId: user.id,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
    }
    return { ok: false, code, message, errorId: error ? errorId : undefined };
  };

  const raw = Object.fromEntries(
    cmsModule.fields.map((field) => [
      field.name,
      formValue(formData, field.name, field.type),
    ]),
  );
  const parsed = moduleSchemas[moduleKey].safeParse(raw);
  if (!parsed.success) {
    const firstField = parsed.error.issues[0]?.path[0];
    return failure(
      "validation",
      firstField === "title"
        ? "O título principal é obrigatório."
        : firstField === "image_alt"
          ? "A descrição da imagem é obrigatória."
          : "Revise os campos destacados e tente novamente.",
    );
  }

  const intent = String(formData.get("intent") || "draft");
  const id = String(formData.get("id") || "");
  if (
    ["publish", "schedule"].includes(intent) &&
    !hasAdminPermission(profile, "publications.publish")
  ) {
    return failure(
      "permission",
      "Sua conta pode salvar rascunhos, mas não tem permissão para publicar.",
    );
  }
  if (intent === "schedule" && !String(formData.get("publish_at") || "")) {
    return failure(
      "validation",
      "Escolha a data e o horário antes de agendar.",
    );
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
    if (!linkedNews)
      return failure(
        "validation",
        "A matéria vinculada não foi encontrada. Escolha outra opção.",
      );
    payload.cta_url = `/noticias/${linkedNews.slug}`;
    payload.open_in_new_tab = false;
  }
  if (moduleKey === "carrossel") {
    // Selects HTML enviam a opção vazia como "". A coluna é UUID e precisa
    // receber null quando nenhuma matéria estiver vinculada.
    payload.linked_news_id = payload.linked_news_id || null;
  }
  if (moduleKey === "preparos") {
    payload.search_terms = nonEmptyLines(raw.search_terms_text);
    payload.override_days = nonEmptyLines(raw.override_days_text);
    payload.override_periods = nonEmptyLines(raw.override_periods_text);
    payload.schedules = raw.use_general_schedule
      ? []
      : parseSchedules(raw.schedules_text);
    payload.preparation_groups = parsePreparationGroups(
      raw.preparation_groups_text,
    );
    payload.documents = nonEmptyLines(raw.documents_text);
    payload.safety_questions = nonEmptyLines(raw.safety_questions_text);
    for (const key of [
      "search_terms_text",
      "override_days_text",
      "override_periods_text",
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
      return failure(
        "image-required",
        "Escolha uma imagem principal antes de publicar o slide.",
      );
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
    if (error)
      return failure(
        "save",
        moduleKey === "carrossel"
          ? "Não foi possível salvar o slide. Tente novamente."
          : "Não foi possível salvar o conteúdo. Tente novamente.",
        error,
        "database-update",
      );
  } else {
    payload.created_by = user.id;
    const { data, error } = await supabase
      .from(cmsModule.table)
      .insert(payload)
      .select("id")
      .single();
    if (error)
      return failure(
        "save",
        moduleKey === "carrossel"
          ? "A imagem está pronta, mas não foi possível salvar o slide."
          : "Não foi possível salvar o conteúdo. Tente novamente.",
        error,
        "database-insert",
      );
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
      if (carouselError)
        return failure(
          "save",
          "A notícia foi salva, mas não foi possível atualizar o carrossel.",
          carouselError,
          "carousel-link",
        );
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
  return {
    ok: true,
    message: "Pronto! A alteração foi salva com sucesso.",
    id: savedId,
  };
}

type SaveContentErrorCode =
  "validation" | "permission" | "image-required" | "save";

export type SaveContentResult =
  | { ok: true; message: string; id: string }
  | {
      ok: false;
      code: SaveContentErrorCode;
      message: string;
      errorId?: string;
    };

export async function contentCommandAction(formData: FormData) {
  const moduleKey = String(formData.get("module")) as CmsModuleKey;
  const cmsModule = getCmsModule(moduleKey);
  const id = String(formData.get("id") || "");
  const command = String(formData.get("command") || "");
  if (!cmsModule || !id) throw new Error("Comando inválido.");

  const { supabase, user, profile } =
    await requireAdminPermission("publications.edit");
  const supportsActive = cmsModule.fields.some(
    (field) => field.name === "active",
  );
  const managerOnly = ["publish", "activate", "deactivate"];
  if (
    managerOnly.includes(command) &&
    !hasAdminPermission(profile, "publications.publish")
  ) {
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
  if (!hasAdminPermission(session.profile, "publications.edit"))
    return {
      ok: false,
      code: "session",
      message: "Sua conta não possui permissão para enviar mídias.",
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

  if (file.size === 0)
    return {
      ok: false,
      code: "file",
      message: "O arquivo selecionado está vazio.",
    };

  if (file.size > 10 * 1024 * 1024)
    return {
      ok: false,
      code: "size",
      message: "A imagem excede o limite de 10 MB.",
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

const accessProfileSchema = z.enum([
  "super_admin",
  "manager",
  "reception",
  "hr",
  "evaluator",
  "publications",
  "attendance",
  "custom",
]);

function parsePermissions(formData: FormData): AdminPermission[] {
  const requested = new Set(formData.getAll("permissions").map(String));
  return adminPermissions.filter((permission) => requested.has(permission));
}

function legacyRoleForAccessProfile(accessProfile: AccessProfile) {
  if (accessProfile === "super_admin") return "super_admin" as const;
  if (accessProfile === "manager") return "admin" as const;
  if (accessProfile === "reception") return "reception" as const;
  return "editor" as const;
}

async function findCandidateAccountByEmail(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  email: string,
) {
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) return false;
  const user = data.users.find(
    (item) => item.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!user) return false;
  const { data: candidate } = await admin
    .from("candidate_accounts")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  return Boolean(candidate);
}

function allowedPermissionsForAccessProfile(
  accessProfile: AccessProfile,
  requested: AdminPermission[],
) {
  if (accessProfile === "super_admin") return [...adminPermissions];
  return normalizeAdminPermissions(
    requested.filter(
      (permission) =>
        !["users.manage", "audit.view", "settings.manage"].includes(permission),
    ),
  );
}

async function requireSuperAdministrator() {
  const session = await requireAdmin(["super_admin"]);
  if (
    session.profile.access_profile === "super_admin" ||
    session.profile.role === "super_admin"
  )
    return session;
  redirect("/admin?error=permission");
}

export async function createAdminUserAction(formData: FormData) {
  const { user } = await requireSuperAdministrator();
  const parsed = z
    .object({
      full_name: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(254),
      password: z.string().min(8).max(128),
      password_confirmation: z.string().min(8).max(128),
      access_profile: accessProfileSchema,
      active: z.boolean(),
      must_change_password: z.boolean(),
    })
    .safeParse({
      full_name: formData.get("full_name"),
      email: formData.get("email"),
      password: formData.get("password"),
      password_confirmation: formData.get("password_confirmation"),
      access_profile: formData.get("access_profile"),
      active: formData.get("active") !== "inactive",
      must_change_password: formData.get("must_change_password") === "on",
    });
  if (
    !parsed.success ||
    parsed.data.password !== parsed.data.password_confirmation
  )
    redirect("/admin/usuarios?error=validation");
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/admin/usuarios?error=config");
  if (await findCandidateAccountByEmail(admin, parsed.data.email)) {
    redirect("/admin/usuarios?error=candidate-email");
  }
  const requestedPermissions = formData.has("permissions_customized")
    ? parsePermissions(formData)
    : permissionsForProfile(parsed.data.access_profile);
  const permissions = allowedPermissionsForAccessProfile(
    parsed.data.access_profile,
    requestedPermissions,
  );
  const role = legacyRoleForAccessProfile(parsed.data.access_profile);
  const hrRole =
    parsed.data.access_profile === "hr"
      ? "hr_manager"
      : parsed.data.access_profile === "evaluator"
        ? "reviewer"
        : null;
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      account_type: "staff",
    },
    app_metadata: { account_type: "staff" },
  });
  if (error || !data.user)
    redirect(
      `/admin/usuarios?error=${error?.message.includes("registered") ? "exists" : "create"}`,
    );
  const profilePayload = {
    id: data.user.id,
    full_name: parsed.data.full_name,
    email: parsed.data.email.toLowerCase(),
    role,
    hr_role: hrRole,
    active: parsed.data.active,
    access_profile: parsed.data.access_profile,
    permissions,
    must_change_password: parsed.data.must_change_password,
  };
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(profilePayload);
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    redirect("/admin/usuarios?error=profile");
  }
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "USER_CREATED",
    entity_type: "profiles",
    entity_id: data.user.id,
    after_data: {
      full_name: parsed.data.full_name,
      email: parsed.data.email.toLowerCase(),
      access_profile: parsed.data.access_profile,
      permissions,
      active: parsed.data.active,
      must_change_password: parsed.data.must_change_password,
    },
  });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?success=created");
}

export async function updateAdminUserAction(formData: FormData) {
  const { user } = await requireSuperAdministrator();
  const parsed = z
    .object({
      id: z.string().uuid(),
      full_name: z.string().trim().min(2).max(120),
      access_profile: accessProfileSchema,
      active: z.boolean(),
    })
    .safeParse({
      id: formData.get("id"),
      full_name: formData.get("full_name"),
      access_profile: formData.get("access_profile"),
      active: formData.get("active") !== "inactive",
    });
  if (!parsed.success || parsed.data.id === user.id)
    redirect("/admin/usuarios?error=self");
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/admin/usuarios?error=config");
  const { data: current } = await admin
    .from("profiles")
    .select("id, full_name, email, role, access_profile, permissions, active")
    .eq("id", parsed.data.id)
    .single();
  if (!current) redirect("/admin/usuarios?error=not-found");
  const { data: candidateAccount } = await admin
    .from("candidate_accounts")
    .select("id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (candidateAccount) redirect("/admin/usuarios?error=candidate-email");
  const currentIsSuper =
    current.role === "super_admin" || current.access_profile === "super_admin";
  const nextIsSuper = parsed.data.access_profile === "super_admin";
  if (currentIsSuper && (!nextIsSuper || !parsed.data.active)) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .or("role.eq.super_admin,access_profile.eq.super_admin");
    if ((count ?? 0) <= 1) redirect("/admin/usuarios?error=last-super-admin");
  }
  const requestedPermissions = formData.has("permissions_customized")
    ? parsePermissions(formData)
    : permissionsForProfile(parsed.data.access_profile);
  const permissions = allowedPermissionsForAccessProfile(
    parsed.data.access_profile,
    requestedPermissions,
  );
  const next = {
    full_name: parsed.data.full_name,
    role: legacyRoleForAccessProfile(parsed.data.access_profile),
    hr_role:
      parsed.data.access_profile === "hr"
        ? "hr_manager"
        : parsed.data.access_profile === "evaluator"
          ? "reviewer"
          : null,
    access_profile: parsed.data.access_profile,
    permissions,
    active: parsed.data.active,
  };
  const { error } = await admin
    .from("profiles")
    .update(next)
    .eq("id", parsed.data.id);
  if (error) redirect("/admin/usuarios?error=update");
  await admin.auth.admin.updateUserById(parsed.data.id, {
    user_metadata: {
      full_name: parsed.data.full_name,
      account_type: "staff",
    },
    app_metadata: { account_type: "staff" },
  });
  const action =
    current.active !== next.active
      ? next.active
        ? "USER_ACTIVATED"
        : "USER_DEACTIVATED"
      : JSON.stringify(current.permissions ?? []) !==
          JSON.stringify(permissions)
        ? "USER_PERMISSIONS_CHANGED"
        : "USER_UPDATED";
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action,
    entity_type: "profiles",
    entity_id: parsed.data.id,
    before_data: {
      full_name: current.full_name,
      access_profile: current.access_profile,
      permissions: current.permissions,
      active: current.active,
    },
    after_data: next,
  });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?success=updated");
}

export async function resetAdminUserPasswordAction(formData: FormData) {
  const { user } = await requireSuperAdministrator();
  const parsed = z
    .object({
      id: z.string().uuid(),
      password: z.string().min(8).max(128),
      password_confirmation: z.string().min(8).max(128),
    })
    .safeParse(Object.fromEntries(formData));
  if (
    !parsed.success ||
    parsed.data.password !== parsed.data.password_confirmation
  )
    redirect("/admin/usuarios?error=password");
  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/admin/usuarios?error=config");
  const { error } = await admin.auth.admin.updateUserById(parsed.data.id, {
    password: parsed.data.password,
  });
  if (error) redirect("/admin/usuarios?error=password");
  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", parsed.data.id);
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "USER_PASSWORD_RESET",
    entity_type: "profiles",
    entity_id: parsed.data.id,
    after_data: { must_change_password: true },
  });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?success=password");
}

export async function changeRequiredPasswordAction(formData: FormData) {
  const session = await getAdminSession();
  if (!session.user || !session.profile || !session.supabase)
    redirect("/admin/login");
  if (!session.profile.active) redirect("/admin/login?error=inactive");
  const parsed = z
    .object({
      password: z.string().min(8).max(128),
      password_confirmation: z.string().min(8).max(128),
    })
    .safeParse(Object.fromEntries(formData));
  if (
    !parsed.success ||
    parsed.data.password !== parsed.data.password_confirmation
  )
    redirect("/admin/definir-senha?error=validation");
  const { error } = await session.supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) redirect("/admin/definir-senha?error=save");
  const admin = createSupabaseAdminClient();
  await admin
    ?.from("profiles")
    .update({ must_change_password: false })
    .eq("id", session.user.id);
  redirect("/admin");
}

export async function mediaCommandAction(formData: FormData) {
  const { supabase, user, profile } =
    await requireAdminPermission("publications.edit");
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
  const { supabase, user } = await requireAdminPermission("publications.edit");
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
  const { supabase, user } = await requireAdminPermission("settings.manage");
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

const schedulingSettingsSchema = z.object({
  days: z
    .array(
      z.enum([
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ]),
    )
    .min(1),
  periods: z.array(z.enum(["morning", "afternoon", "evening"])).min(1),
  public_text: z.string().trim().min(20).max(300),
  short_text: z.string().trim().min(10).max(160),
  note: z.string().trim().min(5).max(240),
  sus_authorization_required: z.boolean(),
});

export async function saveSchedulingSettingsAction(formData: FormData) {
  const { supabase, user } = await requireAdminPermission("settings.manage");
  const parsed = schedulingSettingsSchema.safeParse({
    days: formData.getAll("days"),
    periods: formData.getAll("periods"),
    public_text: formData.get("public_text"),
    short_text: formData.get("short_text"),
    note: formData.get("note"),
    sus_authorization_required:
      formData.get("sus_authorization_required") === "on",
  });
  if (!parsed.success) redirect("/admin/horarios?error=validation");
  const value = { ...parsed.data, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("site_settings").upsert({
    key: "scheduling",
    category: "scheduling",
    is_public: true,
    value,
    updated_by: user.id,
  });
  if (error) redirect("/admin/horarios?error=save");
  await audit(
    supabase,
    user.id,
    "update",
    "site_settings",
    "scheduling",
    value,
  );
  for (const path of [
    "/",
    "/contato",
    "/exames",
    "/preparos",
    "/convenios",
    "/sobre",
    "/admin/horarios",
  ])
    revalidatePath(path);
  redirect("/admin/horarios?success=saved");
}

const requestStatuses = [
  "NEW",
  "IN_REVIEW",
  "DOCUMENT_PENDING",
  "AUTHORIZATION_PENDING",
  "AWAITING_CONTACT",
  "CONTACTED",
  "PARTIALLY_SCHEDULED",
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
] as const;

export async function updateAppointmentRequestAction(formData: FormData) {
  const { supabase, user } = await requireAdminPermission("scheduling.manage");
  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.enum(requestStatuses),
      note: z.string().trim().max(500),
      assign_to_me: z.boolean(),
    })
    .safeParse({
      id: formData.get("id"),
      status: formData.get("status"),
      note: formData.get("note") ?? "",
      assign_to_me: formData.get("assign_to_me") === "on",
    });
  if (!parsed.success) redirect("/admin/solicitacoes?error=validation");
  const { data: current } = await supabase
    .from("appointment_requests")
    .select("status")
    .eq("id", parsed.data.id)
    .single();
  const { error } = await supabase
    .from("appointment_requests")
    .update({
      status: parsed.data.status,
      ...(parsed.data.assign_to_me ? { assigned_to: user.id } : {}),
    })
    .eq("id", parsed.data.id);
  if (error) redirect(`/admin/solicitacoes?id=${parsed.data.id}&error=save`);
  await supabase.from("appointment_request_history").insert({
    appointment_request_id: parsed.data.id,
    actor_id: user.id,
    action: "Status atualizado",
    details: {
      from: current?.status ?? null,
      to: parsed.data.status,
      note: parsed.data.note || null,
    },
  });
  revalidatePath("/admin/solicitacoes");
  redirect(`/admin/solicitacoes?id=${parsed.data.id}&success=updated`);
}

export async function markAppointmentDocumentAction(formData: FormData) {
  const { supabase, user } = await requireAdminPermission("scheduling.manage");
  const parsed = z
    .object({ id: z.string().uuid(), request_id: z.string().uuid() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/solicitacoes?error=validation");
  const { error } = await supabase
    .from("appointment_request_documents")
    .update({ checked_at: new Date().toISOString(), checked_by: user.id })
    .eq("id", parsed.data.id);
  if (error)
    redirect(`/admin/solicitacoes?id=${parsed.data.request_id}&error=document`);
  await supabase.from("appointment_request_history").insert({
    appointment_request_id: parsed.data.request_id,
    actor_id: user.id,
    action: "Documento conferido",
    details: { document_id: parsed.data.id },
  });
  revalidatePath("/admin/solicitacoes");
  redirect(`/admin/solicitacoes?id=${parsed.data.request_id}&success=document`);
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
  const { supabase, user, profile } =
    await requireAdminPermission("publications.edit");
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

export async function updateContactMessageAction(formData: FormData) {
  const { supabase, user } = await requireAdminPermission("contact.manage");
  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["NEW", "IN_REVIEW", "ANSWERED", "CLOSED"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/fale-conosco?error=validation");
  const { data: current } = await supabase
    .from("contact_messages")
    .select("status")
    .eq("id", parsed.data.id)
    .single();
  const { error } = await supabase
    .from("contact_messages")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);
  if (error) redirect("/admin/fale-conosco?error=save");
  await audit(
    supabase,
    user.id,
    "CONTACT_STATUS_UPDATED",
    "contact_messages",
    parsed.data.id,
    { from: current?.status ?? null, to: parsed.data.status },
  );
  revalidatePath("/admin/fale-conosco");
  redirect(`/admin/fale-conosco?id=${parsed.data.id}&success=updated`);
}
