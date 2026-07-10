import { dirname, normalize, resolve } from "@std/path";
import { Effect, Schema } from "effect";
import { ConfigError } from "./core/errors.ts";
import { type LogLevel, logLevels } from "./lib/logging/events.ts";

export const DEFAULT_DEV_DATABASE_PATH = "./data/dev/stackdraft.sqlite";
export const DEFAULT_PROD_HOST_DATABASE_PATH = "./data/prod/stackdraft.sqlite";
export const CONTAINER_DATABASE_PATH = "/data/stackdraft.sqlite";

const PortSchema = Schema.NumberFromString.pipe(
  Schema.int(),
  Schema.between(1, 65_535),
);

const LogLevelSchema = Schema.Literal(...logLevels);
const BooleanStringSchema = Schema.Literal("true", "false");

export const databasePathCategories = [
  "development",
  "production",
  "container",
  "custom",
] as const;
export type DatabasePathCategory = (typeof databasePathCategories)[number];

const pathIsWithin = (path: string, directory: string): boolean =>
  path === directory || path.startsWith(`${directory}/`);

export const classifyDatabasePath = (
  databasePath: string,
): DatabasePathCategory => {
  // Logs need operational context without revealing an absolute host path. This
  // categorization is descriptive only and does not enforce reset safety.
  const absolutePath = normalize(resolve(databasePath));

  if (absolutePath === normalize(CONTAINER_DATABASE_PATH)) {
    return "container";
  }

  if (
    pathIsWithin(
      absolutePath,
      normalize(resolve(dirname(DEFAULT_DEV_DATABASE_PATH))),
    )
  ) {
    return "development";
  }

  if (
    pathIsWithin(
      absolutePath,
      normalize(resolve(dirname(DEFAULT_PROD_HOST_DATABASE_PATH))),
    )
  ) {
    return "production";
  }

  return "custom";
};

export interface AppConfig {
  readonly host: string;
  readonly port: number;
  readonly databasePath: string;
  readonly logLevel: LogLevel;
  readonly printRoutes: boolean;
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

    const rawPrintRoutes = Deno.env.get("STACKDRAFT_PRINT_ROUTES") ?? "false";
    const printRoutesResult = Schema.decodeUnknownEither(BooleanStringSchema)(
      rawPrintRoutes,
    );

    if (printRoutesResult._tag === "Left") {
      throw new Error(
        `STACKDRAFT_PRINT_ROUTES must be true or false; received "${rawPrintRoutes}"`,
      );
    }

    return {
      host: Deno.env.get("STACKDRAFT_HOST") ?? "127.0.0.1",
      port: portResult.right,
      databasePath: Deno.env.get("STACKDRAFT_DATABASE_PATH") ??
        DEFAULT_DEV_DATABASE_PATH,
      logLevel: logLevelResult.right,
      printRoutes: printRoutesResult.right === "true",
    };
  },
  catch: (cause) =>
    new ConfigError({
      message: cause instanceof Error ? cause.message : String(cause),
    }),
});
