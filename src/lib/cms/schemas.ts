import { z } from "zod";

const optionalText = z.string().trim().max(5000).optional().or(z.literal(""));
const slug = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const optionalUrl = z.string().trim().url().optional().or(z.literal(""));

export const moduleSchemas = {
  carrossel: z.object({
    title: z.string().trim().min(1).max(160),
    description: optionalText,
    category: z.string().trim().max(80).optional(),
    image_alt: z.string().trim().min(1).max(240),
    cta_label: z.string().trim().max(80).optional(),
    cta_url: z.string().trim().max(500).optional(),
    publish_at: z.string().optional(),
    active: z.boolean(),
    sort_order: z.number().int().min(0).max(9999),
  }),
  noticias: z.object({
    title: z.string().trim().min(1).max(180),
    slug,
    summary: z.string().trim().min(1).max(500),
    category: z.string().trim().max(80).optional(),
    content_text: z.string().trim().max(30000).optional(),
    seo_title: z.string().trim().max(70).optional(),
    seo_description: z.string().trim().max(170).optional(),
    publish_at: z.string().optional(),
    featured_on_home: z.boolean(),
    show_in_carousel: z.boolean(),
  }),
  convenios: z.object({
    name: z.string().trim().min(1).max(160),
    slug,
    website_url: optionalUrl,
    kind: z.enum(["convenio", "parceria"]),
    active: z.boolean(),
    sort_order: z.number().int().min(0).max(9999),
  }),
  "redes-sociais": z.object({
    network: z.string().trim().min(1).max(80),
    url: z.string().trim().url(),
    title: z.string().trim().min(1).max(180),
    callout: optionalText,
    occurred_at: z.string().optional(),
    cta_label: z.string().trim().max(80).optional(),
    featured: z.boolean(),
    active: z.boolean(),
    sort_order: z.number().int().min(0).max(9999),
  }),
  equipamentos: z.object({
    name: z.string().trim().min(1).max(160),
    modality: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(5000),
    featured: z.boolean(),
    active: z.boolean(),
    sort_order: z.number().int().min(0).max(9999),
  }),
};
