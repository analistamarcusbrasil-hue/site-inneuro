import type { QuickAction } from "@/types/quick-action";
import { siteConfig } from "@/config/site";

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
  {
    id: "insurance",
    title: "Ver convênios",
    description: "Consulte as opções de atendimento disponíveis.",
    icon: "insurance",
    disabled: false,
    href: "/convenios",
  },
  {
    id: "location",
    title: "Como chegar",
    description: "Veja a localização da INNEURO em Macapá.",
    icon: "location",
    disabled: false,
    href: siteConfig.mapsUrl,
    external: true,
  },
];
