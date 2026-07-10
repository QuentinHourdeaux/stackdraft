export const logServices = [
  "app",
  "health",
  "http",
  "state",
  "migration",
  "database-command",
] as const;
export type LogService = (typeof logServices)[number];
