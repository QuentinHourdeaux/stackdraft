export const logLevels = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof logLevels)[number];

export const logOutcomes = ["success", "failure", "skipped"] as const;
export type LogOutcome = (typeof logOutcomes)[number];

export const logEvents = [
  "app_started",
  "app_startup_failed",
  "app_shutdown_started",
  "app_shutdown_completed",
  "app_shutdown_failed",
  "health_check_failed",
  "request_completed",
  "request_failed",
  "state_persistence_failed",
  "migration_started",
  "migration_completed",
  "migration_failed",
  "database_command_started",
  "database_command_completed",
  "database_command_failed",
] as const;
export type LogEvent = (typeof logEvents)[number];
