export type SchedulingCompletionCounts = {
  scheduled: number;
  unscheduled: number;
};

export function calculateSchedulingConversionRate({
  scheduled,
  unscheduled,
}: SchedulingCompletionCounts) {
  const completed = Math.max(0, scheduled) + Math.max(0, unscheduled);
  if (!completed) return 0;
  return (Math.max(0, scheduled) / completed) * 100;
}

export function formatOperationalDuration(minutes: number | null | undefined) {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24)
    return `${hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
  return `${(hours / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;
}
