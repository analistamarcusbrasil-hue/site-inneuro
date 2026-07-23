import type { LucideIcon } from "lucide-react";
import { Images, Newspaper, Handshake, Share2, MonitorCog } from "lucide-react";

export type CmsModuleKey =
  "carrossel" | "noticias" | "convenios" | "redes-sociais" | "equipamentos";

export type CmsField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "url"
    | "number"
    | "datetime-local"
    | "select"
    | "checkbox";
  required?: boolean;
  options?: { label: string; value: string }[];
};

export type CmsModule = {
  key: CmsModuleKey;
  label: string;
  singular: string;
  table:
    | "carousel_slides"
    | "news_posts"
    | "health_partners"
    | "social_posts"
    | "equipment";
  icon: LucideIcon;
  fields: CmsField[];
};

export type CmsModuleFormConfig = Omit<CmsModule, "icon">;

export const cmsModules: CmsModule[] = [
  {
    key: "carrossel",
    label: "Carrossel",
    singular: "slide",
    table: "carousel_slides",
    icon: Images,
    fields: [
      { name: "title", label: "Título", required: true },
      { name: "description", label: "Descrição", type: "textarea" },
      { name: "category", label: "Categoria" },
      { name: "image_alt", label: "Texto alternativo", required: true },
      { name: "cta_label", label: "Texto do CTA" },
      { name: "cta_url", label: "Destino do CTA" },
      {
        name: "publish_at",
        label: "Agendar publicação",
        type: "datetime-local",
      },
      { name: "active", label: "Slide ativo", type: "checkbox" },
      { name: "sort_order", label: "Ordem", type: "number" },
    ],
  },
  {
    key: "noticias",
    label: "Notícias",
    singular: "notícia",
    table: "news_posts",
    icon: Newspaper,
    fields: [
      { name: "title", label: "Título", required: true },
      { name: "slug", label: "Slug", required: true },
      { name: "summary", label: "Resumo", type: "textarea", required: true },
      { name: "category", label: "Categoria" },
      { name: "content_text", label: "Conteúdo", type: "textarea" },
      { name: "seo_title", label: "Título SEO" },
      { name: "seo_description", label: "Descrição SEO", type: "textarea" },
      {
        name: "publish_at",
        label: "Agendar publicação",
        type: "datetime-local",
      },
      { name: "featured_on_home", label: "Destaque na Home", type: "checkbox" },
      {
        name: "show_in_carousel",
        label: "Exibir no carrossel",
        type: "checkbox",
      },
    ],
  },
  {
    key: "convenios",
    label: "Convênios",
    singular: "convênio ou parceria",
    table: "health_partners",
    icon: Handshake,
    fields: [
      { name: "name", label: "Nome", required: true },
      { name: "slug", label: "Slug", required: true },
      { name: "website_url", label: "Site institucional", type: "url" },
      {
        name: "kind",
        label: "Classificação",
        type: "select",
        options: [
          { label: "Convênio", value: "convenio" },
          { label: "Parceria", value: "parceria" },
        ],
      },
      { name: "active", label: "Ativo", type: "checkbox" },
      { name: "sort_order", label: "Ordem", type: "number" },
    ],
  },
  {
    key: "redes-sociais",
    label: "Redes sociais",
    singular: "chamada social",
    table: "social_posts",
    icon: Share2,
    fields: [
      { name: "network", label: "Rede", required: true },
      { name: "url", label: "URL", type: "url", required: true },
      { name: "title", label: "Título", required: true },
      { name: "callout", label: "Chamada", type: "textarea" },
      { name: "occurred_at", label: "Data", type: "datetime-local" },
      { name: "cta_label", label: "CTA" },
      { name: "featured", label: "Destaque", type: "checkbox" },
      { name: "active", label: "Ativo", type: "checkbox" },
      { name: "sort_order", label: "Ordem", type: "number" },
    ],
  },
  {
    key: "equipamentos",
    label: "Equipamentos",
    singular: "equipamento",
    table: "equipment",
    icon: MonitorCog,
    fields: [
      { name: "name", label: "Nome", required: true },
      { name: "modality", label: "Modalidade", required: true },
      {
        name: "description",
        label: "Descrição",
        type: "textarea",
        required: true,
      },
      { name: "featured", label: "Destaque", type: "checkbox" },
      { name: "active", label: "Ativo", type: "checkbox" },
      { name: "sort_order", label: "Ordem", type: "number" },
    ],
  },
];

export function getCmsModule(key: string) {
  return cmsModules.find((module) => module.key === key);
}
