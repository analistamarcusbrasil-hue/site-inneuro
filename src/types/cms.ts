export type AppRole = "super_admin" | "admin" | "editor" | "reception";
export type HrAccessRole =
  "administrator" | "hr_manager" | "reviewer" | "viewer";
export type ContentStatus = "draft" | "scheduled" | "published" | "archived";

export type AdminProfile = {
  id: string;
  full_name: string | null;
  role: AppRole;
  hr_role: HrAccessRole | null;
  email: string | null;
  active: boolean;
  access_profile:
    | "super_admin"
    | "manager"
    | "reception"
    | "hr"
    | "evaluator"
    | "publications"
    | "attendance"
    | "custom"
    | null;
  permissions: import("@/lib/admin/permissions").AdminPermission[] | null;
  must_change_password: boolean;
  last_login_at: string | null;
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
