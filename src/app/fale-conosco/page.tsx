import { ContactForm } from "@/components/contact/contact-form";
import { InternalHero } from "@/components/layout/internal-hero";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Fale Conosco | INNEURO",
  description:
    "Entre em contato com a INNEURO para enviar dúvidas, sugestões, elogios ou falar sobre sua experiência com nossos serviços.",
  path: "/fale-conosco",
});

export default function ContactUsPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Fale com a INNEURO"
        title="Queremos ouvir você."
        description="Este é o espaço para enviar dúvidas, sugestões, elogios ou falar sobre sua experiência com a INNEURO. Sua mensagem será encaminhada para nossa equipe responsável."
      />
      <ContactForm />
    </main>
  );
}
