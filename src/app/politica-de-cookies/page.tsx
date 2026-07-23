import { LegalPage } from "@/components/legal/legal-page";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Política de Cookies | INNEURO",
  description: "Informações sobre cookies no site institucional da INNEURO.",
  path: "/politica-de-cookies",
});

export default function CookiePolicyPage() {
  return (
    <LegalPage
      eyebrow="Navegação"
      title="Política de Cookies"
      description="Informações sobre tecnologias de navegação utilizadas na versão atual do site."
      sections={[
        {
          title: "Versão atual",
          paragraphs: [
            "Na auditoria desta versão não foram identificados scripts de publicidade, rastreamento comportamental ou analytics adicionados pela INNEURO. Recursos técnicos da plataforma de hospedagem podem usar mecanismos estritamente necessários para segurança e entrega do site.",
          ],
        },
        {
          title: "Serviços externos",
          paragraphs: [
            "WhatsApp, Google Maps, Instagram e Portal de Exames somente são acessados após uma ação do visitante. Ao abrir esses serviços, cookies e tecnologias semelhantes podem ser utilizados conforme as políticas de cada fornecedor.",
          ],
        },
        {
          title: "Controle pelo navegador",
          paragraphs: [
            "O visitante pode consultar, bloquear ou remover cookies nas configurações do navegador. O bloqueio de recursos essenciais pode afetar o funcionamento de alguns serviços externos.",
          ],
        },
        {
          title: "Revisão necessária",
          items: [
            "Reavaliar esta política se forem instaladas ferramentas de analytics, marketing, chat ou consentimento.",
            "Validar a classificação dos cookies da hospedagem antes da publicação no domínio oficial.",
            "Submeter o texto à revisão jurídica.",
          ],
        },
      ]}
    />
  );
}
