import { LegalPage } from "@/components/legal/legal-page";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Política de Privacidade | INNEURO",
  description:
    "Saiba como o site da INNEURO trata dados e documentos enviados no pré-agendamento.",
  path: "/politica-de-privacidade",
});

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Privacidade"
      title="Política de Privacidade"
      description="Como os dados informados no site são utilizados no pré-agendamento e no acesso a serviços externos."
      sections={[
        {
          title: "Dados fornecidos pelo usuário",
          paragraphs: [
            "No pré-agendamento, o usuário pode informar dados de identificação e contato, um ou vários exames, forma de atendimento, disponibilidade e observações. Para convênio ou SUS, pode informar os dados necessários à análise. Também pode enviar pedido médico, autorização da regulação, carteirinha e outros documentos relacionados à solicitação.",
          ],
        },
        {
          title: "Finalidade e tratamento",
          paragraphs: [
            "Os dados e documentos são utilizados para analisar e organizar a solicitação, gerar um protocolo protegido e permitir o contato pela equipe da INNEURO. O usuário pode enviar a notificação também pelo WhatsApp; a solicitação não representa confirmação automática de agendamento.",
            "Os arquivos são mantidos em armazenamento privado, com acesso temporário e restrito à equipe autorizada. O acesso aos documentos expira em 48 horas e os arquivos entram no fluxo de remoção automática.",
          ],
        },
        {
          title: "Serviços externos",
          paragraphs: [
            "WhatsApp, Google Maps, Instagram e o Portal de Exames são serviços de terceiros acessados após uma ação do visitante. Esses serviços tratam dados conforme suas próprias políticas. O Portal de Exames é externo, e este site não armazena suas credenciais, laudos ou imagens.",
          ],
        },
        {
          title: "Segurança e escolhas do usuário",
          items: [
            "Envie somente os documentos necessários para o pré-agendamento.",
            "Não compartilhe o link protegido da solicitação com terceiros.",
            "Para dúvidas ou solicitações relacionadas aos dados enviados, utilize os canais oficiais disponíveis na página de contato.",
          ],
        },
      ]}
    />
  );
}
