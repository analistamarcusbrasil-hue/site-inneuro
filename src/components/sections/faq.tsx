"use client";

import { ChevronDown, HelpCircle } from "lucide-react";
import { useState } from "react";
import { Container } from "@/components/layout/container";
import { SectionHeader } from "@/components/sections/section-header";
import { faqItems } from "@/data/faq";
import { cn } from "@/lib/utils";

export function Faq() {
  const [openId, setOpenId] = useState<string | null>(faqItems[0]?.id ?? null);

  return (
    <section
      id="faq"
      aria-label="Perguntas frequentes"
      className="bg-surface py-16 sm:py-20 lg:py-28"
    >
      <Container className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:gap-16">
        <div>
          <HelpCircle
            aria-hidden="true"
            className="text-brand"
            size={32}
            strokeWidth={1.5}
          />
          <SectionHeader
            className="mt-6"
            eyebrow="Dúvidas frequentes"
            title="Informações para seguir com mais clareza."
            description="Para situações específicas, confirme as orientações diretamente com nossa equipe."
          />
        </div>
        <div className="divide-border-light border-border-light divide-y border-y">
          {faqItems.map((item) => {
            const isOpen = openId === item.id;
            const buttonId = `faq-button-${item.id}`;
            const panelId = `faq-panel-${item.id}`;
            return (
              <div key={item.id}>
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="group font-heading text-ink focus-visible:ring-tech flex min-h-20 w-full items-center justify-between gap-6 py-5 text-left text-base font-semibold focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:text-lg"
                  >
                    {item.question}
                    <span className="bg-mint text-brand grid h-9 w-9 shrink-0 place-items-center rounded-full">
                      <ChevronDown
                        aria-hidden="true"
                        size={18}
                        className={cn(
                          "transition-transform duration-300",
                          isOpen && "rotate-180",
                        )}
                      />
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  aria-hidden={!isOpen}
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300",
                    isOpen
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="text-muted max-w-2xl pr-14 pb-6 text-sm leading-relaxed sm:text-base">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
