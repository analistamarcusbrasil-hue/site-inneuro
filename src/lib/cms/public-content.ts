import { connection } from "next/server";
import { companyHighlights } from "@/data/company-highlights";
import { convenios } from "@/data/convenios";
import { isCmsConfigured } from "@/lib/cms/config";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import type { CompanyHighlight } from "@/types/company-highlight";
import type { Convenio } from "@/types/convenio";

export type PublicNews = {
  id: string;
  title: string;
  summary: string;
  category: string | null;
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

export async function getPublicCarousel(): Promise<CompanyHighlight[]> {
  const supabase = await publicClient();
  if (!supabase) return companyHighlights.filter((item) => item.published);
  const { data, error } = await supabase
    .from("carousel_slides")
    .select(
      "id,title,description,category,image_alt,cta_label,cta_url,sort_order,desktop:media_assets!desktop_media_id(storage_path)",
    )
    .order("sort_order");
  if (error || !data?.length)
    return companyHighlights.filter((item) => item.published);
  const cmsHighlights = (data ?? []).map((item) => {
    const path = mediaPath(item.desktop);
    return {
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      category: item.category ?? "INNEURO",
      image: path
        ? supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl
        : undefined,
      imageAlt: item.image_alt,
      href: item.cta_url ?? undefined,
      ctaLabel: item.cta_label ?? undefined,
      published: true,
    };
  });
  const institutional = companyHighlights[0];
  return [
    institutional,
    ...cmsHighlights.filter((item) => item.title !== institutional.title),
  ];
}

export async function getPublicPartners(): Promise<Convenio[]> {
  const supabase = await publicClient();
  if (!supabase) return convenios.filter((item) => item.active);
  const { data, error } = await supabase
    .from("health_partners")
    .select(
      "id,name,slug,kind,website_url,sort_order,logo:media_assets!logo_media_id(storage_path)",
    )
    .order("sort_order");
  if (error || !data?.length) return convenios.filter((item) => item.active);
  const cmsPartners = (data ?? []).map((item) => {
    const path = mediaPath(item.logo);
    const fallback = convenios.find((partner) => partner.slug === item.slug);
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      website: item.website_url ?? undefined,
      logo: path
        ? supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl
        : fallback?.logo,
      logoStatus: path ? "official" : (fallback?.logoStatus ?? "pending"),
      active: item.slug !== "capsaude",
      category: item.kind,
    } satisfies Convenio;
  });
  const cmsSlugs = new Set(cmsPartners.map((item) => item.slug));
  return [
    ...cmsPartners,
    ...convenios.filter((item) => item.active && !cmsSlugs.has(item.slug)),
  ];
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
        "id,title,summary,category,slug,content,seo_title,seo_description,published_at,cover:media_assets!cover_media_id(storage_path,alt_text)",
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
      "id,title,summary,category,slug,content,seo_title,seo_description,published_at,cover:media_assets!cover_media_id(storage_path,alt_text)",
    )
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    category: item.category,
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
      "id,title,summary,category,slug,content,seo_title,seo_description,published_at,cover:media_assets!cover_media_id(storage_path,alt_text)",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    title: data.title,
    summary: data.summary,
    category: data.category,
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
