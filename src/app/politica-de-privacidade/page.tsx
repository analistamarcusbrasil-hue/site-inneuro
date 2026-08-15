import { LegalPage } from "@/components/legal/legal-page";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Política de Privacidade | INNEURO",
  description:
    "Saiba como o site da INNEURO trata dados e documentos enviados no pré-agendamento e no portal de carreiras.",
  path: "/politica-de-privacidade",
});

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Privacidade"
      title="Política de Privacidade"
      description="Como os dados informados no site são utilizados no pré-agendamento, no recrutamento e no acesso a serviços externos."
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
          title: "Portal de carreiras e recrutamento",
          paragraphs: [
            "No portal de carreiras, o candidato poderá informar dados de contato, localização geral, objetivo profissional, experiências, formação, cursos, habilidades, disponibilidade e currículo. Esses dados serão usados para manter o perfil profissional, receber candidaturas, conduzir processos seletivos e, quando houver autorização, permitir a participação no Banco de Talentos.",
            "O currículo ficará em armazenamento privado. O acesso administrativo utilizará links temporários e será registrado para auditoria. O candidato poderá revisar informações identificadas no PDF antes de incorporá-las ao perfil.",
            "Ferramentas automatizadas poderão apoiar a organização e a comparação de informações profissionais com os requisitos de uma vaga. Elas não tomarão decisões de contratação, não rejeitarão candidaturas automaticamente e não substituirão a avaliação humana do RH.",
          ],
        },
        {
          title: "Escolhas, consentimentos e retenção no recrutamento",
          paragraphs: [
            "O candidato poderá consultar autorizações registradas, sair do Banco de Talentos e solicitar a exclusão dos próprios dados. Solicitações de exclusão serão analisadas considerando candidaturas, obrigações aplicáveis e a política de retenção vigente.",
            "A INNEURO manterá a exclusão automática desabilitada até que os prazos de retenção sejam formalmente definidos e validados. Somente usuários administrativos autorizados poderão consultar os dados profissionais necessários às atividades de recrutamento.",
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
