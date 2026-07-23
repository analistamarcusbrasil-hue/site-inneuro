export type WhatsAppChannel = {
  label: string;
  display: string;
  number: string;
};

export type SiteAddress = {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  reference: string;
  formatted: string;
};

type SiteConfig = {
  name: string;
  fullName: string;
  description: string;
  url: string;
  patientPortalUrl: string;
  patientPortal: {
    name: string;
    provider: string;
    url: string;
    external: true;
  };
  whatsapp: { primary: WhatsAppChannel; secondary: WhatsAppChannel };
  instagram: { url: string; handle: string };
  phone: string;
  address: SiteAddress;
  openingHours: string;
  email: string;
  mapsUrl: string;
  navigation: ReadonlyArray<{ label: string; href: string }>;
};

const patientPortalUrl =
  process.env.NEXT_PUBLIC_PATIENT_PORTAL_URL ??
  "https://exames.image2doc.com.br/#/login/protocolo";

export const siteConfig: SiteConfig = {
  name: "INNEURO",
  fullName: "Instituto de Neurologia do Amapá",
  description:
    "Diagnóstico por imagem, neurologia e medicina nuclear com tecnologia, precisão e cuidado.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  patientPortalUrl,
  patientPortal: {
    name: "Portal de Exames",
    provider: "Image2Doc",
    url: patientPortalUrl,
    external: true,
  },
  whatsapp: {
    primary: {
      label: "WhatsApp principal",
      display: "(96) 98112-2434",
      number: "5596981122434",
    },
    secondary: {
      label: "WhatsApp alternativo",
      display: "(96) 99113-4201",
      number: "5596991134201",
    },
  },
  instagram: {
    url: "https://www.instagram.com/inneuroap/",
    handle: "@inneuroap",
  },
  phone: "",
  address: {
    street: "Rua Marcelo Cândia",
    number: "535",
    neighborhood: "Santa Rita",
    city: "Macapá",
    state: "AP",
    postalCode: "",
    reference: "Esquina com a Duque de Caxias.",
    formatted: "Rua Marcelo Cândia, 535 — Santa Rita, Macapá/AP",
  },
  openingHours: "",
  email: "",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Rua%20Marcelo%20C%C3%A2ndia%2C%20535%2C%20Santa%20Rita%2C%20Macap%C3%A1%20-%20AP",
  navigation: [
    { label: "Início", href: "/" },
    { label: "Exames", href: "/exames" },
    { label: "Preparos", href: "/preparos" },
    { label: "Convênios", href: "/convenios" },
    { label: "Sobre a INNEURO", href: "/sobre" },
    { label: "Contato", href: "/contato" },
  ],
};
