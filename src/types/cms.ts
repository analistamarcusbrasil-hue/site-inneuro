export type AppRole = "super_admin" | "admin" | "editor";
export type ContentStatus = "draft" | "scheduled" | "published" | "archived";

export type AdminProfile = {
  id: string;
  full_name: string | null;
  role: AppRole;
};

export type CmsCarouselSlide = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  image_desktop_url: string;
  image_mobile_url: string | null;
  image_alt: string;
  cta_label: string | null;
  cta_url: string | null;
  sort_order: number;
};
