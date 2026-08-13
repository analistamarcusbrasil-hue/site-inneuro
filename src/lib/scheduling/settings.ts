import type { ServiceSchedule } from "@/types/clinical-service";

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
    "A INNEURO realiza atendimentos, agendamentos e exames todos os dias. Segunda a sábado, das 07h às 22h. Domingo, das 07h às 19h.",
  shortText: "Todos os dias • Seg. a sáb., 07h às 22h • Domingo, 07h às 19h",
  note: "Esta é uma solicitação de agendamento. Nossa equipe confirmará a data e o horário do exame.",
  susAuthorizationRequired: false,
};

export function createGeneralExamSchedules(): ServiceSchedule[] {
  return [
    {
      label: "Atendimentos, agendamentos e exames",
      days: "Segunda a sábado",
      periods: [{ start: "07h", end: "22h" }],
    },
    {
      label: "Atendimentos, agendamentos e exames",
      days: "Domingo",
      periods: [{ start: "07h", end: "19h" }],
    },
  ];
}

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
  const savedPublicText =
    typeof source.public_text === "string" ? source.public_text.trim() : "";
  const savedShortText =
    typeof source.short_text === "string" ? source.short_text.trim() : "";
  const hasCurrentHours = (text: string) =>
    text.includes("07h") && text.includes("22h") && text.includes("19h");
  return {
    days: days.length ? days : defaultSchedulingSettings.days,
    periods: periods.length ? periods : defaultSchedulingSettings.periods,
    publicText: hasCurrentHours(savedPublicText)
      ? savedPublicText.slice(0, 300)
      : defaultSchedulingSettings.publicText,
    shortText: hasCurrentHours(savedShortText)
      ? savedShortText.slice(0, 160)
      : defaultSchedulingSettings.shortText,
    note:
      typeof source.note === "string" && source.note.trim()
        ? source.note.trim().slice(0, 240)
        : defaultSchedulingSettings.note,
    susAuthorizationRequired: source.sus_authorization_required === true,
  };
}
