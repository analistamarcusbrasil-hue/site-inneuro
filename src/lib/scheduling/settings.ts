export const schedulingDayOptions = [
  ["monday", "Segunda-feira"],
  ["tuesday", "Terça-feira"],
  ["wednesday", "Quarta-feira"],
  ["thursday", "Quinta-feira"],
  ["friday", "Sexta-feira"],
  ["saturday", "Sábado"],
  ["sunday", "Domingo"],
] as const;

export const schedulingPeriodOptions = [
  ["morning", "Manhã"],
  ["afternoon", "Tarde"],
  ["evening", "Noite"],
] as const;

export type SchedulingSettings = {
  days: string[];
  periods: string[];
  publicText: string;
  shortText: string;
  note: string;
  susAuthorizationRequired: boolean;
};

export const defaultSchedulingSettings: SchedulingSettings = {
  days: schedulingDayOptions.map(([value]) => value),
  periods: schedulingPeriodOptions.map(([value]) => value),
  publicText:
    "Realizamos exames de segunda a domingo, nos períodos da manhã, tarde e noite, mediante agendamento.",
  shortText: "Exames todos os dias — manhã, tarde e noite.",
  note: "A data e o horário serão confirmados pela equipe da INNEURO.",
  susAuthorizationRequired: false,
};

export function parseSchedulingSettings(value: unknown): SchedulingSettings {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const allowedDays = new Set(schedulingDayOptions.map(([key]) => key));
  const allowedPeriods = new Set(schedulingPeriodOptions.map(([key]) => key));
  const days = Array.isArray(source.days)
    ? source.days.map(String).filter((day) => allowedDays.has(day as never))
    : [];
  const periods = Array.isArray(source.periods)
    ? source.periods
        .map(String)
        .filter((period) => allowedPeriods.has(period as never))
    : [];
  return {
    days: days.length ? days : defaultSchedulingSettings.days,
    periods: periods.length ? periods : defaultSchedulingSettings.periods,
    publicText:
      typeof source.public_text === "string" && source.public_text.trim()
        ? source.public_text.trim().slice(0, 300)
        : defaultSchedulingSettings.publicText,
    shortText:
      typeof source.short_text === "string" && source.short_text.trim()
        ? source.short_text.trim().slice(0, 160)
        : defaultSchedulingSettings.shortText,
    note:
      typeof source.note === "string" && source.note.trim()
        ? source.note.trim().slice(0, 240)
        : defaultSchedulingSettings.note,
    susAuthorizationRequired: source.sus_authorization_required === true,
  };
}
