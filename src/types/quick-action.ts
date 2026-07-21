export type QuickActionIcon =
  "calendar" | "preparations" | "results" | "whatsapp";

type QuickActionBase = {
  id: string;
  title: string;
  description: string;
  icon: QuickActionIcon;
  featured?: boolean;
};

export type EnabledQuickAction = QuickActionBase & {
  disabled: false;
  href: string;
  external?: boolean;
};

export type DisabledQuickAction = QuickActionBase & {
  disabled: true;
  disabledReason: string;
};

export type QuickAction = EnabledQuickAction | DisabledQuickAction;
