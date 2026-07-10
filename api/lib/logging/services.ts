export const logServices = [
  "app",
  "http",
  "state",
  "migration",
  "database-command",
] as const;
export type LogService = (typeof logServices)[number];
