import { assertEquals, assertMatch, assertThrows } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import {
  assertDevDatabaseResetAllowed,
  migrateDatabaseAtPath,
  resetDevDatabase,
  sqliteDatabaseFiles,
} from "../api/commands/db.ts";
import { DEFAULT_DEV_DATABASE_PATH } from "../api/config.ts";

async function removeIfExists(path: string): Promise<void> {
  try {
    await Deno.remove(path);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
}

async function removeSqliteArtifacts(
  databasePath: string,
  extraPaths: string[] = [],
): Promise<void> {
  for (const path of [...sqliteDatabaseFiles(databasePath), ...extraPaths]) {
    await removeIfExists(path);
  }
}

Deno.test("sqliteDatabaseFiles includes SQLite sidecar files", () => {
  assertEquals(sqliteDatabaseFiles("./data/dev/stackdraft.sqlite"), [
    "./data/dev/stackdraft.sqlite",
    "./data/dev/stackdraft.sqlite-wal",
    "./data/dev/stackdraft.sqlite-shm",
  ]);
});

Deno.test("assertDevDatabaseResetAllowed permits development database paths", () => {
  assertDevDatabaseResetAllowed("./data/dev/stackdraft.sqlite");
  assertDevDatabaseResetAllowed("./data/dev/experiment.sqlite");
});

Deno.test("assertDevDatabaseResetAllowed rejects production-style paths", () => {
  assertThrows(
    () => assertDevDatabaseResetAllowed("./data/prod/stackdraft.sqlite"),
    Error,
    "production-style database",
  );
  assertThrows(
    () => assertDevDatabaseResetAllowed("./data/prod/other.sqlite"),
    Error,
    "production-style database",
  );
});

Deno.test("assertDevDatabaseResetAllowed rejects paths outside data/dev", () => {
  assertThrows(
    () => assertDevDatabaseResetAllowed("./data/stackdraft.sqlite"),
    Error,
    "outside ./data/dev",
  );
  assertThrows(
    () => assertDevDatabaseResetAllowed("/tmp/stackdraft.sqlite"),
    Error,
    "outside ./data/dev",
  );
});

Deno.test("migrateDatabaseAtPath applies migrations to the configured file", async () => {
  const databasePath = await Deno.makeTempFile({
    prefix: "stackdraft-migrate-",
    suffix: ".sqlite",
  });

  await migrateDatabaseAtPath(databasePath);

  const database = new DatabaseSync(databasePath);
  try {
    const migrations = database
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all();

    assertEquals(migrations.length > 0, true);
  } finally {
    database.close();
  }

  await removeSqliteArtifacts(databasePath);
});

Deno.test("resetDevDatabase recreates only the development database", async () => {
  const databasePath = `./data/dev/test-reset-${crypto.randomUUID()}.sqlite`;

  await migrateDatabaseAtPath(databasePath);
  await Deno.writeTextFile(`${databasePath}.marker`, "keep-me");

  await resetDevDatabase(databasePath);

  const marker = await Deno.readTextFile(`${databasePath}.marker`);
  assertEquals(marker, "keep-me");

  const database = new DatabaseSync(databasePath);
  try {
    const migrations = database
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all();

    assertEquals(migrations.length > 0, true);
  } finally {
    database.close();
  }

  await removeSqliteArtifacts(databasePath, [`${databasePath}.marker`]);
});

Deno.test("db:migrate:dev task targets the development database path", async () => {
  const task = JSON.parse(await Deno.readTextFile("deno.json")).tasks[
    "db:migrate:dev"
  ] as string;

  assertMatch(
    task,
    new RegExp(
      `STACKDRAFT_DATABASE_PATH=${
        DEFAULT_DEV_DATABASE_PATH.replaceAll(
          ".",
          "\\.",
        )
      }`,
    ),
  );
  assertMatch(task, /api\/commands\/db\.ts migrate/);
});

Deno.test("db:reset:dev task targets the development database path", async () => {
  const task = JSON.parse(await Deno.readTextFile("deno.json")).tasks[
    "db:reset:dev"
  ] as string;

  assertMatch(
    task,
    new RegExp(
      `STACKDRAFT_DATABASE_PATH=${
        DEFAULT_DEV_DATABASE_PATH.replaceAll(
          ".",
          "\\.",
        )
      }`,
    ),
  );
  assertMatch(task, /api\/commands\/db\.ts reset/);
});
