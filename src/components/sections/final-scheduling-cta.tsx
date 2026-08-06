import { CalendarCheck, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { createWhatsAppUrl } from "@/lib/whatsapp";

const message =
  "Olá! Acessei o site da INNEURO e gostaria de informações sobre exames.";

export function FinalSchedulingCta({
  whatsappNumber,
}: {
  whatsappNumber: string;
}) {
  return (
    <section
      aria-labelledby="final-scheduling-title"
      className="bg-surface py-14 sm:py-18 lg:py-20"
    >
      <Container>
        <div className="bg-brand-dark rounded-[2rem] px-7 py-10 text-center text-white sm:px-10 sm:py-12">
          <p className="text-mint text-xs font-bold tracking-[0.14em] uppercase">
            Próximo passo
          </p>
          <h2
            id="final-scheduling-title"
            className="font-heading mx-auto mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl"
          >
            Organize seu pré-agendamento com a INNEURO.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/72 sm:text-base">
            Envie as informações do exame e os documentos solicitados para
            agilizar o atendimento da equipe.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/contato#pre-agendamento"
              className="bg-tech text-brand-dark focus-visible:ring-tech inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <CalendarCheck aria-hidden="true" size={18} />
              Solicitar pré-agendamento
            </Link>
            <a
              href={createWhatsAppUrl(whatsappNumber, message)}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-visible:ring-tech inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/22 px-6 text-sm font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <MessageCircle aria-hidden="true" size={18} />
              Falar pelo WhatsApp
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
