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
  help: string;
  example?: string;
  location: string;
  recommendedMax?: number;
  maxLength?: number;
  fullWidth?: boolean;
  richText?: boolean;
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
    label: "Página inicial",
    singular: "slide",
    table: "carousel_slides",
    icon: Images,
    fields: [
      {
        name: "title",
        label: "Título principal",
        required: true,
        help: "Use uma frase curta e direta.",
        example: "Conheça a INNEURO",
        location: "Aparece em destaque sobre a imagem da página inicial.",
        recommendedMax: 60,
        maxLength: 160,
      },
      {
        name: "description",
        label: "Texto de apoio",
        type: "textarea",
        help: "Explique o destaque em uma ou duas frases.",
        example: "Tecnologia e acolhimento em cada etapa do atendimento.",
        location: "Aparece logo abaixo do título no banner.",
        recommendedMax: 160,
        maxLength: 500,
        fullWidth: true,
      },
      {
        name: "category",
        label: "Categoria",
        help: "Uma palavra que identifica o assunto.",
        example: "Institucional",
        location: "Aparece acima do título.",
        recommendedMax: 30,
        maxLength: 80,
      },
      {
        name: "image_alt",
        label: "Descrição da imagem",
        required: true,
        help: "Descreva o que aparece na foto para pessoas que usam leitor de tela.",
        example: "Fachada da INNEURO em Macapá.",
        location: "Não fica visível; é usada para acessibilidade.",
        recommendedMax: 160,
        maxLength: 240,
      },
      {
        name: "cta_label",
        label: "Texto do botão",
        help: "Diga claramente o que acontece ao clicar.",
        example: "Conhecer a INNEURO",
        location: "Aparece no botão do banner.",
        recommendedMax: 30,
        maxLength: 80,
      },
      {
        name: "cta_url",
        label: "Destino do botão",
        help: "Use um caminho do site, como /sobre, ou uma URL completa.",
        example: "/sobre",
        location: "Define a página aberta pelo botão.",
        maxLength: 500,
      },
      {
        name: "publish_at",
        label: "Agendar publicação",
        type: "datetime-local",
        help: "Opcional. Escolha quando o conteúdo deve entrar no site.",
        location: "Controla a data de publicação.",
      },
      {
        name: "active",
        label: "Exibir este destaque",
        type: "checkbox",
        help: "Ative para permitir que o destaque apareça no carrossel.",
        location: "Página inicial.",
      },
      {
        name: "sort_order",
        label: "Ordem de exibição",
        type: "number",
        help: "Use 0 para aparecer primeiro, 1 para o segundo e assim por diante.",
        example: "0",
        location: "Define a posição no carrossel.",
      },
    ],
  },
  {
    key: "noticias",
    label: "Notícias",
    singular: "notícia",
    table: "news_posts",
    icon: Newspaper,
    fields: [
      {
        name: "title",
        label: "Título da notícia",
        required: true,
        help: "Informe o assunto principal com linguagem clara.",
        example: "INNEURO amplia atendimento em Macapá",
        location: "Aparece na lista de notícias e no topo da publicação.",
        recommendedMax: 60,
        maxLength: 180,
      },
      {
        name: "slug",
        label: "Endereço da notícia",
        required: true,
        help: "Use letras minúsculas, números e hífens, sem espaços ou acentos.",
        example: "inneuro-amplia-atendimento",
        location: "Forma o endereço /noticias/endereco-da-noticia.",
        maxLength: 120,
      },
      {
        name: "summary",
        label: "Resumo",
        type: "textarea",
        required: true,
        help: "Resuma a notícia em uma ou duas frases.",
        example: "Veja as principais informações desta atualização.",
        location: "Aparece nos cards e abaixo do título da notícia.",
        recommendedMax: 160,
        maxLength: 500,
        fullWidth: true,
      },
      {
        name: "category",
        label: "Categoria",
        help: "Agrupe a publicação por assunto.",
        example: "Institucional",
        location: "Aparece acima do título.",
        recommendedMax: 30,
        maxLength: 80,
      },
      {
        name: "content_text",
        label: "Texto completo",
        type: "textarea",
        help: "Escreva em parágrafos curtos. Use os botões de formatação quando necessário.",
        example: "Comece com a informação mais importante...",
        location: "Aparece no corpo da notícia.",
        fullWidth: true,
        richText: true,
      },
      {
        name: "seo_title",
        label: "Título para buscadores",
        help: "Opcional. Se ficar vazio, será usado o título da notícia.",
        example: "Atendimento INNEURO em Macapá",
        location: "Aparece no Google e na aba do navegador.",
        recommendedMax: 60,
        maxLength: 70,
      },
      {
        name: "seo_description",
        label: "Descrição para buscadores",
        type: "textarea",
        help: "Opcional. Resuma a página para resultados de busca.",
        example: "Conheça as novidades e serviços da INNEURO em Macapá.",
        location: "Pode aparecer nos resultados do Google.",
        recommendedMax: 160,
        maxLength: 170,
        fullWidth: true,
      },
      {
        name: "publish_at",
        label: "Agendar publicação",
        type: "datetime-local",
        help: "Opcional. Escolha a data e o horário de publicação.",
        location: "Controla quando a notícia entra no site.",
      },
      {
        name: "featured_on_home",
        label: "Destacar na página inicial",
        type: "checkbox",
        help: "Marque para mostrar a notícia entre os destaques recentes.",
        location: "Página inicial.",
      },
      {
        name: "show_in_carousel",
        label: "Exibir no carrossel",
        type: "checkbox",
        help: "Marque apenas para uma notícia que mereça grande destaque.",
        location: "Carrossel da página inicial.",
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
      {
        name: "name",
        label: "Nome exibido",
        required: true,
        help: "Use o nome completo da operadora ou parceria.",
        example: "CAPE Saúde — CAPESESP",
        location: "Aparece na página de convênios.",
        recommendedMax: 60,
        maxLength: 160,
      },
      {
        name: "slug",
        label: "Identificador",
        required: true,
        help: "Use letras minúsculas e hífens, sem espaços ou acentos.",
        example: "cape-saude-capesesp",
        location: "Usado internamente para identificar o cadastro.",
        maxLength: 120,
      },
      {
        name: "website_url",
        label: "Site institucional",
        type: "url",
        help: "Opcional. Informe o endereço completo, começando com https://.",
        example: "https://www.exemplo.com.br/",
        location: "Referência institucional do cadastro.",
        maxLength: 500,
      },
      {
        name: "kind",
        label: "Classificação",
        type: "select",
        help: "Escolha como a marca deve ser identificada.",
        location: "Aparece abaixo da marca.",
        options: [
          { label: "Convênio", value: "convenio" },
          { label: "Parceria", value: "parceria" },
        ],
      },
      {
        name: "active",
        label: "Exibir no site",
        type: "checkbox",
        help: "Marque para mostrar este cadastro ao público.",
        location: "Home e página de convênios.",
      },
      {
        name: "sort_order",
        label: "Ordem de exibição",
        type: "number",
        help: "Use 0 para aparecer primeiro, 1 para o segundo e assim por diante.",
        example: "0",
        location: "Lista de convênios.",
      },
    ],
  },
  {
    key: "redes-sociais",
    label: "Contatos e redes sociais",
    singular: "chamada social",
    table: "social_posts",
    icon: Share2,
    fields: [
      {
        name: "network",
        label: "Rede",
        required: true,
        help: "Informe a rede social.",
        example: "Instagram",
        location: "Card da publicação.",
        recommendedMax: 30,
        maxLength: 80,
      },
      {
        name: "url",
        label: "Link da publicação",
        type: "url",
        required: true,
        help: "Cole o endereço completo da publicação.",
        example: "https://www.instagram.com/p/...",
        location: "Abre ao clicar no card.",
        maxLength: 500,
      },
      {
        name: "title",
        label: "Título",
        required: true,
        help: "Explique o assunto em uma frase curta.",
        example: "Cuidados antes do exame",
        location: "Título do card.",
        recommendedMax: 60,
        maxLength: 180,
      },
      {
        name: "callout",
        label: "Texto curto",
        type: "textarea",
        help: "Escreva uma chamada simples para a publicação.",
        example: "Confira as orientações da nossa equipe.",
        location: "Descrição do card.",
        recommendedMax: 300,
        maxLength: 500,
        fullWidth: true,
      },
      {
        name: "occurred_at",
        label: "Data da publicação",
        type: "datetime-local",
        help: "Informe quando o conteúdo foi publicado.",
        location: "Organização cronológica.",
      },
      {
        name: "cta_label",
        label: "Texto do botão",
        help: "Diga o que acontece ao clicar.",
        example: "Ver publicação",
        location: "Botão do card.",
        recommendedMax: 30,
        maxLength: 80,
      },
      {
        name: "featured",
        label: "Destacar",
        type: "checkbox",
        help: "Marque para dar mais visibilidade a este item.",
        location: "Página inicial.",
      },
      {
        name: "active",
        label: "Exibir no site",
        type: "checkbox",
        help: "Marque para permitir a exibição pública.",
        location: "Página inicial.",
      },
      {
        name: "sort_order",
        label: "Ordem de exibição",
        type: "number",
        help: "Use 0 para aparecer primeiro.",
        example: "0",
        location: "Lista de publicações.",
      },
    ],
  },
  {
    key: "equipamentos",
    label: "Exames e equipamentos",
    singular: "equipamento",
    table: "equipment",
    icon: MonitorCog,
    fields: [
      {
        name: "name",
        label: "Nome do equipamento",
        required: true,
        help: "Use o nome pelo qual o público reconhece o equipamento.",
        example: "Ressonância magnética",
        location: "Seção institucional de equipamentos.",
        recommendedMax: 60,
        maxLength: 160,
      },
      {
        name: "modality",
        label: "Modalidade do exame",
        required: true,
        help: "Informe a modalidade relacionada.",
        example: "Ressonância magnética",
        location: "Identificação do equipamento.",
        recommendedMax: 60,
        maxLength: 120,
      },
      {
        name: "description",
        label: "Descrição",
        type: "textarea",
        required: true,
        help: "Explique a função do equipamento sem criar promessa médica.",
        example: "Equipamento utilizado para aquisição de imagens detalhadas.",
        location: "Texto do card institucional.",
        recommendedMax: 300,
        maxLength: 5000,
        fullWidth: true,
      },
      {
        name: "featured",
        label: "Destacar",
        type: "checkbox",
        help: "Marque para dar mais visibilidade ao equipamento.",
        location: "Seção institucional.",
      },
      {
        name: "active",
        label: "Exibir no site",
        type: "checkbox",
        help: "Marque para permitir a exibição pública.",
        location: "Seção institucional.",
      },
      {
        name: "sort_order",
        label: "Ordem de exibição",
        type: "number",
        help: "Use 0 para aparecer primeiro.",
        example: "0",
        location: "Lista de equipamentos.",
      },
    ],
  },
];

export function getCmsModule(key: string) {
  return cmsModules.find((module) => module.key === key);
}
