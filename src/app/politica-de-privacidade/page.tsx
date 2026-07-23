import { LegalPage } from "@/components/legal/legal-page";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Política de Privacidade | INNEURO",
  description:
    "Informações sobre privacidade e uso de dados no site institucional da INNEURO.",
  path: "/politica-de-privacidade",
});

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Privacidade"
      title="Política de Privacidade"
      description="Como o site institucional trata informações durante a navegação e o contato com canais externos."
      sections={[
        {
          title: "Funcionamento do site",
          paragraphs: [
            "O site apresenta informações institucionais e não mantém prontuários, laudos ou imagens de exames. O Portal de Exames é um serviço externo, acessado por link, e possui regras próprias de privacidade.",
          ],
        },
        {
          title: "Formulário de contato",
          paragraphs: [
            "O pré-atendimento disponível neste site monta uma mensagem no navegador do visitante. O site não envia nem armazena os campos em banco de dados. Ao confirmar, o visitante é direcionado ao WhatsApp e decide se deseja enviar a mensagem.",
          ],
          items: [
            "Não informe diagnósticos, laudos, prontuários ou outros dados clínicos pelo formulário do site.",
            "O conteúdo enviado pelo WhatsApp passa a ser tratado conforme as regras do próprio serviço e os procedimentos internos da INNEURO.",
          ],
        },
        {
          title: "Links externos",
          paragraphs: [
            "Links para WhatsApp, Google Maps, Instagram e Portal de Exames abrem serviços de terceiros. Esses serviços podem tratar dados segundo suas próprias políticas.",
          ],
        },
        {
          title: "Revisão necessária",
          items: [
            "Confirmar responsável pelo tratamento e canal específico para solicitações de privacidade.",
            "Validar prazos internos de retenção aplicáveis aos canais de atendimento.",
            "Revisar o texto com assessoria jurídica antes do domínio oficial.",
          ],
        },
      ]}
    />
  );
}
