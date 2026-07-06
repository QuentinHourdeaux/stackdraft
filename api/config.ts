import { Data, Effect } from "effect";

export interface AppConfig {
  readonly host: string;
  readonly port: number;
  readonly databasePath: string;
  readonly logLevel: "debug" | "info" | "warn" | "error";
}

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
}> {}

const logLevels = new Set<AppConfig["logLevel"]>([
  "debug",
  "info",
  "warn",
  "error",
]);

export const loadConfig: Effect.Effect<AppConfig, ConfigError> = Effect.try({
  try: () => {
    const rawPort = Deno.env.get("STACKDRAFT_PORT") ?? "8000";
    const port = Number(rawPort);

    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error(
        `STACKDRAFT_PORT must be an integer between 1 and 65535; received "${rawPort}"`,
      );
    }

    const rawLogLevel = Deno.env.get("STACKDRAFT_LOG_LEVEL") ?? "info";
    if (!logLevels.has(rawLogLevel as AppConfig["logLevel"])) {
      throw new Error(
        `STACKDRAFT_LOG_LEVEL must be debug, info, warn, or error; received "${rawLogLevel}"`,
      );
    }

    return {
      host: Deno.env.get("STACKDRAFT_HOST") ?? "127.0.0.1",
      port,
      databasePath: Deno.env.get("STACKDRAFT_DATABASE_PATH") ??
        "./data/stackdraft.sqlite",
      logLevel: rawLogLevel as AppConfig["logLevel"],
    };
  },
  catch: (cause) =>
    new ConfigError({
      message: cause instanceof Error ? cause.message : String(cause),
    }),
});
