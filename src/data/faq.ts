import type { FaqItem } from "@/types/faq";

export const faqItems: FaqItem[] = [
  {
    id: "agendamento",
    question: "Como faço para agendar um exame?",
    answer:
      "Acesse o Portal de Agendamento da INNEURO, informe seus dados, anexe o pedido médico e indique os melhores dias e períodos. Esse é o canal oficial para registrar uma nova solicitação.",
  },
  {
    id: "pedido-medico",
    question: "Preciso de pedido médico?",
    answer:
      "A necessidade de pedido médico pode variar conforme o exame. Confirme a exigência com nossa equipe antes do atendimento.",
  },
  {
    id: "preparo",
    question: "Onde encontro o preparo do meu exame?",
    answer:
      "Consulte a área de preparos do site. Para orientações específicas, confirme as informações diretamente com nossa equipe.",
  },
  {
    id: "documentos",
    question: "Quais documentos devo levar?",
    answer:
      "Os documentos necessários podem variar conforme o exame e o atendimento. Nossa equipe informará o que apresentar no agendamento.",
  },
  {
    id: "resultados",
    question: "Como acesso meus resultados?",
    answer:
      "Os resultados disponíveis podem ser consultados no ambiente externo e seguro do Portal de Exames da INNEURO, fornecido pelo Image2Doc.",
  },
  {
    id: "exames-anteriores",
    question: "Posso consultar exames anteriores?",
    answer:
      "Quando disponíveis, laudos, imagens e exames anteriores podem ser consultados pelo Portal de Exames da INNEURO.",
  },
  {
    id: "convenio",
    question: "Como confirmo se meu convênio é aceito?",
    answer:
      "Consulte nossa equipe para confirmar cobertura, autorização e disponibilidade do exame antes do atendimento.",
  },
  {
    id: "pedido-whatsapp",
    question: "Posso enviar meu pedido pelo WhatsApp?",
    answer:
      "Não. Para garantir mais segurança, organização e continuidade do atendimento, os agendamentos são solicitados exclusivamente pelo nosso Portal de Agendamento. Acesse o Portal, informe seus dados e anexe o pedido médico. Após o envio, nossa equipe dará continuidade ao atendimento.",
  },
];
