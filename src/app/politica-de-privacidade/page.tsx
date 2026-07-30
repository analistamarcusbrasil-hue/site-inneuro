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
            "No pré-agendamento, o usuário pode informar nome, telefone, data de nascimento, tipo de atendimento, convênio, exame, período de preferência e observações. Também pode enviar documento com foto, pedido médico e, quando aplicável, carteirinha do convênio.",
          ],
        },
        {
          title: "Finalidade e tratamento",
          paragraphs: [
            "Os dados e documentos são utilizados para organizar a solicitação, gerar um protocolo protegido e agilizar o atendimento pela equipe da INNEURO. O envio do formulário abre o WhatsApp para que o usuário conclua o contato; o pré-agendamento somente é confirmado pela equipe.",
            "Os arquivos são mantidos em armazenamento privado, com acesso por link temporário e restrito. A solicitação é configurada para expirar em 48 horas, quando os documentos deixam de ficar disponíveis e entram no fluxo de remoção automática.",
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
