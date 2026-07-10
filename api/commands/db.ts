import { dirname, normalize, resolve } from "@std/path";
import { Effect } from "effect";
import {
  type AppConfig,
  classifyDatabasePath,
  DEFAULT_DEV_DATABASE_PATH,
  DEFAULT_PROD_HOST_DATABASE_PATH,
  loadConfig,
} from "../config.ts";
import { migrate } from "../infrastructure/database/migrate.ts";
import { closeSqlite, openSqlite } from "../infrastructure/database/sqlite.ts";
import {
  createLogger,
  type Logger,
  noopLogger,
} from "../lib/logging/logger.ts";

export type DatabaseCommand = "migrate" | "reset";

export const DEV_DATA_DIRECTORY = "./data/dev";
export const PROD_DATA_DIRECTORY = "./data/prod";

export function sqliteDatabaseFiles(databasePath: string): readonly string[] {
  return [
    databasePath,
    `${databasePath}-wal`,
    `${databasePath}-shm`,
  ];
}

export function assertDevDatabaseResetAllowed(databasePath: string): void {
  const absolutePath = normalize(resolve(databasePath));
  const devDirectory = normalize(resolve(DEV_DATA_DIRECTORY));
  const prodDirectory = normalize(resolve(PROD_DATA_DIRECTORY));
  const prodDatabasePath = normalize(resolve(DEFAULT_PROD_HOST_DATABASE_PATH));

  if (
    absolutePath === prodDatabasePath ||
    absolutePath === prodDirectory ||
    absolutePath.startsWith(`${prodDirectory}/`)
  ) {
    throw new Error(
      `Refusing to reset production-style database at ${databasePath}`,
    );
  }

  if (
    absolutePath !== devDirectory &&
    !absolutePath.startsWith(`${devDirectory}/`)
  ) {
    throw new Error(
      `Refusing to reset database outside ${DEV_DATA_DIRECTORY}: ${databasePath}`,
    );
  }
}

export async function deleteSqliteFiles(databasePath: string): Promise<void> {
  for (const path of sqliteDatabaseFiles(databasePath)) {
    try {
      await Deno.remove(path);
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  }
}

export async function migrateDatabaseAtPath(
  databasePath: string,
  logger: Logger = noopLogger,
): Promise<void> {
  const database = await Effect.runPromise(openSqlite(databasePath));

  try {
    await Effect.runPromise(migrate(database, { logger }));
  } finally {
    await Effect.runPromise(closeSqlite(database));
  }
}

export async function resetDevDatabase(
  databasePath: string,
  logger: Logger = noopLogger,
): Promise<void> {
  assertDevDatabaseResetAllowed(databasePath);
  await deleteSqliteFiles(databasePath);
  await Deno.mkdir(dirname(databasePath), { recursive: true });
  await migrateDatabaseAtPath(databasePath, logger);
}

export async function runDatabaseCommand(
  command: DatabaseCommand,
  databasePath: string,
  logger: Logger,
  action: () => Promise<void>,
): Promise<void> {
  // Command events wrap the complete action, while nested migration events use
  // their own service scope and preserve the same underlying failure.
  const log = logger.with({ service: "database-command", method: command });
  const input = {
    fields: {
      databasePathCategory: classifyDatabasePath(databasePath),
    },
  };

  log.info({
    event: "database_command_started",
    message: `Started database ${command} command.`,
    ...input,
  });

  try {
    await action();
    log.info({
      event: "database_command_completed",
      message: `Completed database ${command} command.`,
      outcome: "success",
      ...input,
    });
  } catch (cause) {
    log.error({
      event: "database_command_failed",
      message: `Database ${command} command failed.`,
      outcome: "failure",
      cause,
      ...input,
    });
    throw cause;
  }
}

export async function loadDatabaseCommandConfig(
  command: DatabaseCommand,
  logger: Logger,
  load: () => Promise<AppConfig> = () => Effect.runPromise(loadConfig),
): Promise<AppConfig> {
  // The configured log level is unavailable when configuration itself fails.
  // A bootstrap logger keeps this early failure structured with a safe default.
  try {
    return await load();
  } catch (cause) {
    logger.with({ service: "database-command", method: command }).error({
      event: "database_command_failed",
      message: `Database ${command} command configuration failed.`,
      outcome: "failure",
      cause,
    });
    throw cause;
  }
}

const usage = `Usage:
  deno run --allow-env --allow-read --allow-write api/commands/db.ts migrate
  deno run --allow-env --allow-read --allow-write api/commands/db.ts reset

Defaults to ${DEFAULT_DEV_DATABASE_PATH} unless STACKDRAFT_DATABASE_PATH is set.`;

if (import.meta.main) {
  const command = Deno.args[0];

  if (command !== "migrate" && command !== "reset") {
    console.error(usage);
    Deno.exit(1);
  }

  const bootstrapLogger = createLogger({
    minimumLevel: "info",
    context: { service: "database-command", method: command },
  });
  let config: AppConfig;

  try {
    config = await loadDatabaseCommandConfig(command, bootstrapLogger);
  } catch {
    Deno.exit(1);
  }

  const logger = createLogger({
    minimumLevel: config.logLevel,
    context: { service: "database-command", method: command },
  });

  try {
    if (command === "migrate") {
      await runDatabaseCommand(
        command,
        config.databasePath,
        logger,
        () => migrateDatabaseAtPath(config.databasePath, logger),
      );
      console.log(`Applied migrations to ${config.databasePath}`);
    } else {
      await runDatabaseCommand(
        command,
        config.databasePath,
        logger,
        () => resetDevDatabase(config.databasePath, logger),
      );
      console.log(`Reset development database at ${config.databasePath}`);
    }
  } catch {
    Deno.exit(1);
  }
}
