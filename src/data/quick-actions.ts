import { siteConfig } from "@/config/site";
import type { QuickAction } from "@/types/quick-action";

const whatsappNumber = siteConfig.whatsapp.primary.number;

export const quickActions: QuickAction[] = [
  {
    id: "schedule",
    title: "Agendar exame",
    description: "Envie seu pedido e fale com nossa equipe.",
    icon: "calendar",
    disabled: false,
    href: "/#agendamento",
  },
  {
    id: "preparations",
    title: "Consultar preparos",
    description: "Veja as orientações antes de realizar seu exame.",
    icon: "preparations",
    disabled: false,
    href: "/preparos",
  },
  siteConfig.patientPortal.url
    ? {
        id: "results",
        title: "Acessar exames e resultados",
        description:
          "Acesse seus laudos, imagens e exames anteriores pelo Portal de Exames da INNEURO.",
        icon: "results",
        featured: true,
        disabled: false,
        href: siteConfig.patientPortal.url,
        external: true,
      }
    : {
        id: "results",
        title: "Acessar exames e resultados",
        description:
          "Acesse seus laudos, imagens e exames anteriores pelo Portal de Exames da INNEURO.",
        icon: "results",
        featured: true,
        disabled: true,
        disabledReason: "Portal de Exames indisponível no momento",
      },
  whatsappNumber
    ? {
        id: "whatsapp",
        title: "Falar com a INNEURO",
        description: "Tire dúvidas diretamente pelo WhatsApp.",
        icon: "whatsapp",
        disabled: false,
        href: `https://wa.me/${whatsappNumber}`,
        external: true,
      }
    : {
        id: "whatsapp",
        title: "Falar com a INNEURO",
        description: "Tire dúvidas diretamente pelo WhatsApp.",
        icon: "whatsapp",
        disabled: true,
        disabledReason: "WhatsApp indisponível no momento",
      },
];
