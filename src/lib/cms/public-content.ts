import { connection } from "next/server";
import { companyHighlights } from "@/data/company-highlights";
import { convenios } from "@/data/convenios";
import { exames } from "@/data/exames";
import { modalities } from "@/data/modalidades";
import { clinicalServices } from "@/data/clinical-services";
import { siteConfig, type SiteConfig } from "@/config/site";
import { isCmsConfigured } from "@/lib/cms/config";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import type { CompanyHighlight } from "@/types/company-highlight";
import type { Convenio } from "@/types/convenio";
import type { Exame } from "@/types/exame";
import type { Modality } from "@/types/modality";
import type { ClinicalService } from "@/types/clinical-service";
import {
  createGeneralExamSchedules,
  defaultSchedulingSettings,
  parseSchedulingSettings,
  type SchedulingSettings,
} from "@/lib/scheduling/settings";

export type SchedulingExamOption = {
  id: string;
  name: string;
  modality: string;
};

export async function getPublicSchedulingSettings(): Promise<SchedulingSettings> {
  const supabase = await publicClient();
  if (!supabase) return defaultSchedulingSettings;
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "scheduling")
    .maybeSingle();
  return error
    ? defaultSchedulingSettings
    : parseSchedulingSettings(data?.value);
}

export async function getPublicSchedulingExams(): Promise<
  SchedulingExamOption[]
> {
  const supabase = await publicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("exams")
    .select("id,name,modality")
    .eq("active", true)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("name");
  if (error) return [];
  return (data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    modality: item.modality,
  }));
}

export type PublicNews = {
  id: string;
  title: string;
  summary: string;
  category: string | null;
  author: string | null;
  slug: string;
  content: unknown;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  coverUrl: string | null;
  coverAlt: string;
};
export type PublicSocial = {
  id: string;
  title: string;
  callout: string | null;
  network: string;
  url: string;
  cta_label: string | null;
  thumbnailUrl: string | null;
  thumbnailAlt: string;
};
type PublicEquipment = {
  id: string;
  name: string;
  modality: string;
  description: string;
};

function mediaPath(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" && "storage_path" in relation
    ? String((relation as { storage_path: string }).storage_path)
    : null;
}

function mediaAlt(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" && "alt_text" in relation
    ? String((relation as { alt_text: string }).alt_text ?? "")
    : "";
}

function publicMediaUrl(
  supabase: NonNullable<ReturnType<typeof createSupabasePublicClient>>,
  value: unknown,
) {
  const path = mediaPath(value);
  return path
    ? supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl
    : null;
}

async function publicClient() {
  if (!isCmsConfigured) return null;
  await connection();
  return createSupabasePublicClient();
}

async function hasCompleteCms(
  supabase: NonNullable<ReturnType<typeof createSupabasePublicClient>>,
) {
  const { data } = await supabase
    .from("site_settings")
    .select("key")
    .eq("key", "institutional")
    .maybeSingle();
  return Boolean(data);
}

export async function getPublicCarousel(): Promise<CompanyHighlight[]> {
  const supabase = await publicClient();
  if (!supabase) return companyHighlights.filter((item) => item.published);
  const { data, error } = await supabase
    .from("carousel_slides")
    .select(
      "id,title,description,category,image_alt,cta_label,cta_url,image_url,open_in_new_tab,sort_order,desktop:media_assets!desktop_media_id(storage_path),linked_news:news_posts!linked_news_id(slug)",
    )
    .order("sort_order");
  if (error) return companyHighlights.filter((item) => item.published);
  if (!data?.length) {
    return (await hasCompleteCms(supabase))
      ? []
      : companyHighlights.filter((item) => item.published);
  }
  return (data ?? []).map((item) => {
    const path = mediaPath(item.desktop);
    const linkedNews = Array.isArray(item.linked_news)
      ? item.linked_news[0]
      : item.linked_news;
    return {
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      category: item.category ?? "INNEURO",
      image: path
        ? supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl
        : (item.image_url ?? undefined),
      imageAlt: item.image_alt,
      href:
        linkedNews && typeof linkedNews === "object" && "slug" in linkedNews
          ? `/noticias/${String(linkedNews.slug)}`
          : (item.cta_url ?? undefined),
      ctaLabel: item.cta_label ?? undefined,
      openInNewTab: item.open_in_new_tab,
      published: true,
    };
  });
}

export async function getPublicPartners(): Promise<Convenio[]> {
  const supabase = await publicClient();
  if (!supabase) return convenios.filter((item) => item.active);
  const { data, error } = await supabase
    .from("health_partners")
    .select(
      "id,name,slug,kind,website_url,logo_url,logo_alt,notes,restrictions,sort_order,logo:media_assets!logo_media_id(storage_path,alt_text)",
    )
    .order("sort_order");
  if (error) return convenios.filter((item) => item.active);
  if (!data?.length) {
    return (await hasCompleteCms(supabase))
      ? []
      : convenios.filter((item) => item.active);
  }
  return (data ?? []).map((item) => {
    const path = mediaPath(item.logo);
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      website: item.website_url ?? undefined,
      logo: path
        ? supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl
        : (item.logo_url ?? undefined),
      logoAlt: mediaAlt(item.logo) || item.logo_alt || `Logo ${item.name}`,
      notes: item.notes ?? undefined,
      restrictions: item.restrictions ?? undefined,
      logoStatus: path || item.logo_url ? "official" : "pending",
      active: true,
      category: item.kind,
    } satisfies Convenio;
  });
}

export async function getPublicNewsAndSocial(): Promise<{
  news: PublicNews[];
  social: PublicSocial[];
}> {
  const supabase = await publicClient();
  if (!supabase) return { news: [], social: [] };
  const [{ data: news }, { data: social }] = await Promise.all([
    supabase
      .from("news_posts")
      .select(
        "id,title,summary,category,author,slug,content,seo_title,seo_description,published_at,cover:media_assets!cover_media_id(storage_path,alt_text)",
      )
      .eq("featured_on_home", true)
      .order("published_at", { ascending: false })
      .limit(3),
    supabase
      .from("social_posts")
      .select(
        "id,title,callout,network,url,cta_label,thumbnail:media_assets!thumbnail_media_id(storage_path,alt_text)",
      )
      .order("sort_order")
      .limit(3),
  ]);
  return {
    news: (news ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      category: item.category,
      author: item.author,
      slug: item.slug,
      content: item.content,
      seoTitle: item.seo_title,
      seoDescription: item.seo_description,
      publishedAt: item.published_at,
      coverUrl: publicMediaUrl(supabase, item.cover),
      coverAlt: mediaAlt(item.cover) || `Imagem de capa: ${item.title}`,
    })),
    social: (social ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      callout: item.callout,
      network: item.network,
      url: item.url,
      cta_label: item.cta_label,
      thumbnailUrl: publicMediaUrl(supabase, item.thumbnail),
      thumbnailAlt: mediaAlt(item.thumbnail) || `Publicação: ${item.title}`,
    })),
  };
}

export async function getPublicNews(limit = 24): Promise<PublicNews[]> {
  const supabase = await publicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("news_posts")
    .select(
      "id,title,summary,category,author,slug,content,seo_title,seo_description,published_at,cover:media_assets!cover_media_id(storage_path,alt_text)",
    )
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    category: item.category,
    author: item.author,
    slug: item.slug,
    content: item.content,
    seoTitle: item.seo_title,
    seoDescription: item.seo_description,
    publishedAt: item.published_at,
    coverUrl: publicMediaUrl(supabase, item.cover),
    coverAlt: mediaAlt(item.cover) || `Imagem de capa: ${item.title}`,
  }));
}

export async function getPublicNewsBySlug(slug: string) {
  const supabase = await publicClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("news_posts")
    .select(
      "id,title,summary,category,author,slug,content,seo_title,seo_description,published_at,cover:media_assets!cover_media_id(storage_path,alt_text)",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    title: data.title,
    summary: data.summary,
    category: data.category,
    author: data.author,
    slug: data.slug,
    content: data.content,
    seoTitle: data.seo_title,
    seoDescription: data.seo_description,
    publishedAt: data.published_at,
    coverUrl: publicMediaUrl(supabase, data.cover),
    coverAlt: mediaAlt(data.cover) || `Imagem de capa: ${data.title}`,
  } satisfies PublicNews;
}

export async function getPublicEquipment(): Promise<PublicEquipment[]> {
  const supabase = await publicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("equipment")
    .select("id,name,modality,description")
    .order("sort_order")
    .limit(6);
  return (data ?? []) as PublicEquipment[];
}

export async function getPublicExams(): Promise<{
  exams: Exame[];
  modalities: Modality[];
}> {
  const supabase = await publicClient();
  if (!supabase) return { exams: exames, modalities };
  const { data, error } = await supabase
    .from("exams")
    .select(
      "slug,name,modality,modality_slug,short_description,preparation_slug,purpose,how_performed,general_guidance,documents,icon,featured,sort_order",
    )
    .order("sort_order");
  if (error) return { exams: exames, modalities };
  const publicExams = exames.map((exam) => {
    const saved = data?.find((item) => item.slug === exam.slug);
    if (!saved) return exam;
    return {
      ...exam,
      shortDescription:
        saved.short_description?.trim() || exam.shortDescription,
      preparationSlug:
        saved.preparation_slug ?? exam.preparationSlug ?? undefined,
      purpose: saved.purpose ?? undefined,
      howPerformed: saved.how_performed ?? undefined,
      generalGuidance: saved.general_guidance ?? undefined,
      documents: saved.documents ?? undefined,
    } satisfies Exame;
  });
  return { exams: publicExams, modalities };
}

export async function getPublicExamBySlug(slug: string) {
  const content = await getPublicExams();
  const exam = content.exams.find((item) => item.slug === slug) ?? null;
  return {
    exam,
    modality:
      content.modalities.find((item) => item.slug === exam?.modalitySlug) ??
      null,
  };
}

export async function getPublicPreparations(): Promise<ClinicalService[]> {
  const supabase = await publicClient();
  if (!supabase) return clinicalServices;
  const { data, error } = await supabase
    .from("preparations")
    .select(
      "slug,name,search_terms,attendance_mode,attendance_label,schedules,use_general_schedule,override_days,override_periods,schedule_note,preparation_groups,documents,safety_questions,previous_exams_recommended,validated_by_clinic,last_reviewed_at,sort_order",
    )
    .order("sort_order");
  if (error) return clinicalServices;
  if (!data?.length) {
    return (await hasCompleteCms(supabase)) ? [] : clinicalServices;
  }
  return data.map((item) => ({
    slug: item.slug,
    name: item.name,
    searchTerms: Array.isArray(item.search_terms)
      ? item.search_terms.map(String)
      : [],
    attendanceMode: item.attendance_mode as ClinicalService["attendanceMode"],
    attendanceLabel: item.attendance_label,
    schedules:
      item.use_general_schedule !== false
        ? createGeneralExamSchedules()
        : Array.isArray(item.schedules) && item.schedules.length
          ? (item.schedules as ClinicalService["schedules"])
          : Array.isArray(item.override_days) &&
              Array.isArray(item.override_periods) &&
              item.override_days.length &&
              item.override_periods.length
            ? [
                {
                  label: "Disponibilidade específica",
                  days: item.override_days.map(String).join(", "),
                  periods: item.override_periods.map((period) => ({
                    start: String(period),
                    end: "",
                  })),
                },
              ]
            : [],
    scheduleNote: item.schedule_note ?? undefined,
    preparationGroups: Array.isArray(item.preparation_groups)
      ? (item.preparation_groups as ClinicalService["preparationGroups"])
      : [],
    documents: Array.isArray(item.documents)
      ? item.documents.map(String)
      : undefined,
    safetyQuestions: Array.isArray(item.safety_questions)
      ? item.safety_questions.map(String)
      : undefined,
    previousExamsRecommended: item.previous_exams_recommended,
    validatedByClinic: item.validated_by_clinic,
    lastReviewedAt: item.last_reviewed_at,
  }));
}

export async function getPublicPreparationBySlug(slug: string) {
  const content = await getPublicPreparations();
  return content.find((item) => item.slug === slug) ?? null;
}

export type PublicInstitutionalContent = {
  config: SiteConfig;
  about: {
    title: string;
    description: string;
    purpose: string;
    technology: string;
  };
};

function settingText(
  value: Record<string, unknown>,
  key: string,
  fallback: string,
) {
  return typeof value[key] === "string" ? String(value[key]) : fallback;
}

function publicServiceText(value: string, fallback: string) {
  return /medicina nuclear|cintilografia|mapeamento cerebral/i.test(value)
    ? fallback
    : value;
}

export async function getPublicInstitutionalContent(): Promise<PublicInstitutionalContent> {
  const fallback = {
    config: siteConfig,
    about: {
      title: "Tecnologia, precisão e cuidado.",
      description:
        "O Instituto de Neurologia do Amapá reúne exames e serviços de diagnóstico em Macapá.",
      purpose:
        "Facilitar o acesso a informações sobre exames, preparos, convênios e canais oficiais da INNEURO.",
      technology:
        "Tecnologia, comunicação clara e acesso digital aos resultados apoiam a jornada de atendimento.",
    },
  };
  const supabase = await publicClient();
  if (!supabase) return fallback;
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "institutional")
    .maybeSingle();
  if (error || !data?.value || typeof data.value !== "object") return fallback;
  const value = data.value as Record<string, unknown>;
  const address = {
    street: settingText(value, "address_street", siteConfig.address.street),
    number: settingText(value, "address_number", siteConfig.address.number),
    neighborhood: settingText(
      value,
      "address_neighborhood",
      siteConfig.address.neighborhood,
    ),
    city: settingText(value, "address_city", siteConfig.address.city),
    state: settingText(value, "address_state", siteConfig.address.state),
    postalCode: settingText(
      value,
      "address_postal_code",
      siteConfig.address.postalCode,
    ),
    reference: settingText(
      value,
      "address_reference",
      siteConfig.address.reference,
    ),
    formatted: "",
  };
  address.formatted = `${address.street}, ${address.number} — ${address.neighborhood}, ${address.city}/${address.state}`;
  const patientPortalUrl = settingText(
    value,
    "patient_portal_url",
    siteConfig.patientPortal.url,
  );
  const config: SiteConfig = {
    ...siteConfig,
    fullName: settingText(value, "full_name", siteConfig.fullName),
    description: publicServiceText(
      settingText(value, "description", siteConfig.description),
      siteConfig.description,
    ),
    phone: settingText(value, "phone", siteConfig.phone),
    email: settingText(value, "email", siteConfig.email),
    openingHours: settingText(value, "opening_hours", siteConfig.openingHours),
    whatsapp: {
      primary: {
        label: settingText(
          value,
          "whatsapp_primary_label",
          siteConfig.whatsapp.primary.label,
        ),
        display: settingText(
          value,
          "whatsapp_primary_display",
          siteConfig.whatsapp.primary.display,
        ),
        number: settingText(
          value,
          "whatsapp_primary_number",
          siteConfig.whatsapp.primary.number,
        ),
      },
      secondary: {
        label: settingText(
          value,
          "whatsapp_secondary_label",
          siteConfig.whatsapp.secondary.label,
        ),
        display: settingText(
          value,
          "whatsapp_secondary_display",
          siteConfig.whatsapp.secondary.display,
        ),
        number: settingText(
          value,
          "whatsapp_secondary_number",
          siteConfig.whatsapp.secondary.number,
        ),
      },
    },
    instagram: {
      url: settingText(value, "instagram_url", siteConfig.instagram.url),
      handle: settingText(
        value,
        "instagram_handle",
        siteConfig.instagram.handle,
      ),
    },
    address,
    mapsUrl: settingText(value, "maps_url", siteConfig.mapsUrl),
    patientPortalUrl,
    patientPortal: { ...siteConfig.patientPortal, url: patientPortalUrl },
  };
  return {
    config,
    about: {
      title: settingText(value, "about_title", fallback.about.title),
      description: publicServiceText(
        settingText(value, "about_description", fallback.about.description),
        fallback.about.description,
      ),
      purpose: settingText(value, "about_purpose", fallback.about.purpose),
      technology: settingText(
        value,
        "about_technology",
        fallback.about.technology,
      ),
    },
  };
}
