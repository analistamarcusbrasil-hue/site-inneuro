import { LegalPage } from "@/components/legal/legal-page";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Termos de Uso | INNEURO",
  description:
    "Condições de uso do site, do pré-agendamento e dos links externos da INNEURO.",
  path: "/termos-de-uso",
});

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Uso do site"
      title="Termos de Uso"
      description="Orientações para utilizar as informações, o pré-agendamento e os links disponíveis."
      sections={[
        {
          title: "Finalidade",
          paragraphs: [
            "O conteúdo do site tem caráter institucional e informativo. Ele não substitui avaliação profissional, pedido médico, orientação individual ou contato direto com a equipe da INNEURO.",
          ],
        },
        {
          title: "Pré-agendamento e cobertura",
          paragraphs: [
            "O envio de dados e documentos organiza uma solicitação e não confirma data, horário, autorização ou cobertura. Essas condições dependem da confirmação da equipe e, quando aplicável, do plano contratado.",
          ],
        },
        {
          title: "Preparos e orientações",
          paragraphs: [
            "As orientações publicadas devem ser conferidas para o exame solicitado. Em caso de dúvida ou de orientação individual recebida pela equipe, prevalece a instrução específica fornecida para o procedimento.",
          ],
        },
        {
          title: "Serviços externos",
          paragraphs: [
            "O WhatsApp, o Google Maps, o Instagram e o Portal de Exames são serviços externos. Este site oferece os links de acesso, mas o uso desses ambientes também está sujeito aos termos e políticas de seus fornecedores.",
          ],
        },
        {
          title: "Responsabilidade do visitante",
          items: [
            "Fornecer informações corretas e documentos legíveis no pré-agendamento.",
            "Verificar se está usando os canais oficiais apresentados no site.",
            "Confirmar diretamente com a equipe informações que dependam de avaliação individual.",
          ],
        },
      ]}
    />
  );
}
