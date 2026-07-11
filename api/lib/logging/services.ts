export const logServices = [
  "app",
  "health",
  "http",
  "state",
  "stack",
  "draft",
  "migration",
  "database-command",
] as const;
export type LogService = (typeof logServices)[number];
