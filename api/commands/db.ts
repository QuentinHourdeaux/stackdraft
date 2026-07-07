import { dirname, normalize, resolve } from "@std/path";
import { Effect } from "effect";
import {
  DEFAULT_DEV_DATABASE_PATH,
  DEFAULT_PROD_HOST_DATABASE_PATH,
  loadConfig,
} from "../config.ts";
import { migrate } from "../infrastructure/database/migrate.ts";
import { closeSqlite, openSqlite } from "../infrastructure/database/sqlite.ts";

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
): Promise<void> {
  const database = await Effect.runPromise(openSqlite(databasePath));

  try {
    await Effect.runPromise(migrate(database));
  } finally {
    await Effect.runPromise(closeSqlite(database));
  }
}

export async function resetDevDatabase(databasePath: string): Promise<void> {
  assertDevDatabaseResetAllowed(databasePath);
  await deleteSqliteFiles(databasePath);
  await Deno.mkdir(dirname(databasePath), { recursive: true });
  await migrateDatabaseAtPath(databasePath);
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

  const config = await Effect.runPromise(loadConfig);

  if (command === "migrate") {
    await migrateDatabaseAtPath(config.databasePath);
    console.log(`Applied migrations to ${config.databasePath}`);
  } else {
    await resetDevDatabase(config.databasePath);
    console.log(`Reset development database at ${config.databasePath}`);
  }
}
