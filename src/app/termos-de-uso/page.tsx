import { LegalPage } from "@/components/legal/legal-page";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Termos de Uso | INNEURO",
  description:
    "Condições informativas de uso do site institucional da INNEURO.",
  path: "/termos-de-uso",
});

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Uso do site"
      title="Termos de Uso"
      description="Orientações para utilização responsável das informações e dos links disponíveis."
      sections={[
        {
          title: "Finalidade",
          paragraphs: [
            "O conteúdo do site tem caráter institucional e informativo. Ele não substitui avaliação profissional, pedido médico, orientação individual ou contato direto com a equipe da INNEURO.",
          ],
        },
        {
          title: "Agendamento e cobertura",
          paragraphs: [
            "O envio de uma mensagem não confirma agendamento, autorização ou cobertura. Essas condições dependem da confirmação da equipe e, quando aplicável, do plano contratado.",
          ],
        },
        {
          title: "Portal de Exames",
          paragraphs: [
            "O Portal de Exames é externo. O site da INNEURO apenas oferece o link de acesso e não armazena credenciais, laudos ou imagens disponibilizados nesse serviço.",
          ],
        },
        {
          title: "Responsabilidade do visitante",
          items: [
            "Verificar se está usando os canais oficiais apresentados no site.",
            "Não inserir dados clínicos detalhados no formulário de pré-atendimento.",
            "Confirmar diretamente com a equipe informações que dependam de avaliação individual.",
          ],
        },
        {
          title: "Revisão necessária",
          items: [
            "Definir foro, responsabilidades e versão formal com assessoria jurídica.",
            "Confirmar a data de vigência após aprovação institucional.",
          ],
        },
      ]}
    />
  );
}
