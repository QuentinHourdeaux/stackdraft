import { Effect, Schema } from "effect";
import { ConfigError } from "./core/errors.ts";

export const DEFAULT_DEV_DATABASE_PATH = "./data/dev/stackdraft.sqlite";
export const DEFAULT_PROD_HOST_DATABASE_PATH = "./data/prod/stackdraft.sqlite";
export const CONTAINER_DATABASE_PATH = "/data/stackdraft.sqlite";

const PortSchema = Schema.NumberFromString.pipe(
  Schema.int(),
  Schema.between(1, 65_535),
);

const LogLevelSchema = Schema.Literal("debug", "info", "warn", "error");
type LogLevel = Schema.Schema.Type<typeof LogLevelSchema>;

export interface AppConfig {
  readonly host: string;
  readonly port: number;
  readonly databasePath: string;
  readonly logLevel: LogLevel;
}

export const loadConfig: Effect.Effect<AppConfig, ConfigError> = Effect.try({
  try: () => {
    const rawPort = Deno.env.get("STACKDRAFT_PORT") ?? "8000";
    const portResult = Schema.decodeUnknownEither(PortSchema)(rawPort);

    if (portResult._tag === "Left") {
      throw new Error(
        `STACKDRAFT_PORT must be an integer between 1 and 65535; received "${rawPort}"`,
      );
    }

    const rawLogLevel = Deno.env.get("STACKDRAFT_LOG_LEVEL") ?? "info";
    const logLevelResult = Schema.decodeUnknownEither(LogLevelSchema)(
      rawLogLevel,
    );

    if (logLevelResult._tag === "Left") {
      throw new Error(
        `STACKDRAFT_LOG_LEVEL must be debug, info, warn, or error; received "${rawLogLevel}"`,
      );
    }

    return {
      host: Deno.env.get("STACKDRAFT_HOST") ?? "127.0.0.1",
      port: portResult.right,
      databasePath: Deno.env.get("STACKDRAFT_DATABASE_PATH") ??
        DEFAULT_DEV_DATABASE_PATH,
      logLevel: logLevelResult.right,
    };
  },
  catch: (cause) =>
    new ConfigError({
      message: cause instanceof Error ? cause.message : String(cause),
    }),
});
