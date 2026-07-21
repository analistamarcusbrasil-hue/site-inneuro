export type JourneyIcon = "send" | "schedule" | "exam" | "result";

export type JourneyStep = {
  number: number;
  title: string;
  description: string;
  icon: JourneyIcon;
};
