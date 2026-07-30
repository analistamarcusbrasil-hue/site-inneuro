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
      description="Informações sobre as tecnologias necessárias ao funcionamento do site e de serviços externos."
      sections={[
        {
          title: "Uso atual",
          paragraphs: [
            "A versão atual não inclui ferramentas próprias de publicidade, analytics ou rastreamento comportamental. Por isso, o site não apresenta um painel de consentimento para cookies opcionais que não são utilizados.",
            "Recursos técnicos estritamente necessários podem ser utilizados para segurança, autenticação da área administrativa e entrega do site.",
          ],
        },
        {
          title: "Serviços externos",
          paragraphs: [
            "WhatsApp, Google Maps, Instagram e Portal de Exames somente são abertos após uma ação do visitante. Nesses ambientes, cookies e tecnologias semelhantes podem ser utilizados conforme as políticas de cada fornecedor.",
          ],
        },
        {
          title: "Controle pelo navegador",
          paragraphs: [
            "O visitante pode consultar, bloquear ou remover cookies nas configurações do navegador. O bloqueio de recursos essenciais pode afetar a autenticação administrativa ou a abertura de serviços externos.",
          ],
        },
      ]}
    />
  );
}
