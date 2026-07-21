import { Container } from "@/components/layout/container";
import { QuickActionCard } from "@/components/ui/quick-action-card";
import { quickActions } from "@/data/quick-actions";

export function QuickActions() {
  return (
    <section
      aria-labelledby="quick-actions-title"
      className="bg-surface py-12 sm:py-16 lg:py-20"
    >
      <Container>
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
              Acesso rápido
            </p>
            <h2
              id="quick-actions-title"
              className="font-heading text-ink mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl"
            >
              Como podemos ajudar?
            </h2>
          </div>
          <span
            className="bg-border-light hidden h-px flex-1 sm:block"
            aria-hidden="true"
          />
        </div>

        <div className="mt-8 grid items-stretch gap-4 sm:grid-cols-2 lg:mt-10 xl:grid-cols-4">
          {quickActions.map((action) => (
            <QuickActionCard key={action.id} action={action} />
          ))}
        </div>
      </Container>
    </section>
  );
}
