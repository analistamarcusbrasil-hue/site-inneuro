export function classifyProtectedPdf(bytes: Uint8Array) {
  const sample = new TextDecoder("latin1").decode(bytes);
  if (/\/ByteRange\s*\[/.test(sample) && /\/Contents\s*</.test(sample)) {
    return "SKIPPED_SIGNED" as const;
  }
  if (/\/Encrypt\b/.test(sample)) return "SKIPPED_ENCRYPTED" as const;
  return null;
}

export function hasMinimumSavings(
  before: number,
  after: number,
  minimumPercent: number,
  minimumBytes: number,
) {
  const saved = before - after;
  return (
    saved >= minimumBytes ||
    (before > 0 && (saved / before) * 100 >= minimumPercent)
  );
}

export function isSchedulingAutoCloseEligible(input: {
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
  workflowStatus: string;
  now: Date;
  closeDays?: number;
}) {
  if (input.completedAt || input.deletedAt) return false;
  if (
    ["CONCLUIDO", "NAO_AGENDAVEL", "CANCELADO"].includes(input.workflowStatus)
  ) {
    return false;
  }
  const threshold = (input.closeDays ?? 20) * 86_400_000;
  return input.now.getTime() - Date.parse(input.createdAt) >= threshold;
}

export function retentionDueAt(completedAt: string, retentionDays = 7) {
  return new Date(Date.parse(completedAt) + retentionDays * 86_400_000);
}
