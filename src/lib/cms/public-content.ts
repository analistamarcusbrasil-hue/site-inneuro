import { connection } from "next/server";
import { companyHighlights } from "@/data/company-highlights";
import { convenios } from "@/data/convenios";
import { isCmsConfigured } from "@/lib/cms/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CompanyHighlight } from "@/types/company-highlight";
import type { Convenio } from "@/types/convenio";

type PublicNews = {
  id: string;
  title: string;
  summary: string;
  category: string | null;
  slug: string;
};
type PublicSocial = {
  id: string;
  title: string;
  callout: string | null;
  network: string;
  url: string;
  cta_label: string | null;
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

async function publicClient() {
  if (!isCmsConfigured) return null;
  await connection();
  return createSupabaseServerClient();
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
  if (error) return companyHighlights.filter((item) => item.published);
  return (data ?? []).map((item) => {
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
  if (error) return convenios.filter((item) => item.active);
  return (data ?? []).map((item) => {
    const path = mediaPath(item.logo);
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      website: item.website_url ?? undefined,
      logo: path
        ? supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl
        : undefined,
      logoStatus: path ? "official" : "pending",
      active: true,
      category: item.kind,
    };
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
      .select("id,title,summary,category,slug")
      .eq("featured_on_home", true)
      .order("published_at", { ascending: false })
      .limit(3),
    supabase
      .from("social_posts")
      .select("id,title,callout,network,url,cta_label")
      .order("sort_order")
      .limit(3),
  ]);
  return {
    news: (news ?? []) as PublicNews[],
    social: (social ?? []) as PublicSocial[],
  };
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
