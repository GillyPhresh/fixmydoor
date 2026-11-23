export const nextStates: Record<string, string[]> = {
  DRAFT: ["READY", "CANCELLED"],
  READY: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["ASSIGNED", "SCHEDULED", "READY", "CANCELLED"],
  SCHEDULED: ["ASSIGNED", "SCHEDULED", "IN_PROGRESS", "READY", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "ON_HOLD"],
  ON_HOLD: ["READY", "CANCELLED"],
};
export const categories = [
  "ASSEMBLY",
  "MAINTENANCE",
  "LOCKSMITH",
  "SECURITY_SYSTEM",
  "ELECTRICAL",
] as const;
