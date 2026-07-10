import { assertEquals, assertRejects } from "@std/assert";
import { toFileUrl } from "@std/path";
import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import {
  defaultMigrationsUrl,
  migrate,
} from "../api/infrastructure/database/migrate.ts";
import { createLogger } from "../api/lib/logging/logger.ts";

const recordingLogger = (events: string[]) =>
  createLogger({
    minimumLevel: "debug",
    context: { service: "migration", method: "migrate" },
    write: (_destination, line) => {
      const entry = JSON.parse(line) as { event: string };
      events.push(entry.event);
    },
  });

const recordingLogEntries = (entries: Array<Record<string, unknown>>) =>
  createLogger({
    minimumLevel: "info",
    context: { service: "migration", method: "migrate" },
    write: (_destination, line) => {
      entries.push(JSON.parse(line) as Record<string, unknown>);
    },
  });

Deno.test("migrations initialize a fresh database and are idempotent", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    await Effect.runPromise(migrate(database));

    const migrations = database
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all();

    assertEquals(migrations, [
      { version: "0001_initial.sql" },
      { version: "0002-states.sql" },
      { version: "0003-stacks.sql" },
    ]);
  } finally {
    database.close();
  }
});

Deno.test("migration logging is lazy and records successful execution", async () => {
  const database = new DatabaseSync(":memory:");
  const events: string[] = [];

  try {
    const migration = migrate(database, { logger: recordingLogger(events) });
    assertEquals(events, []);

    await Effect.runPromise(migration);

    assertEquals(events, ["migration_started", "migration_completed"]);
  } finally {
    database.close();
  }
});

Deno.test("migrations reject database versions unknown to the application", async () => {
  const database = new DatabaseSync(":memory:");
  const events: string[] = [];

  try {
    await Effect.runPromise(migrate(database));
    database.prepare(
      "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
    ).run("9999_unknown.sql", new Date().toISOString());

    await assertRejects(
      () =>
        Effect.runPromise(
          migrate(database, {
            directory: defaultMigrationsUrl,
            logger: recordingLogger(events),
          }),
        ),
      Error,
      "unknown migrations",
    );
    assertEquals(events, ["migration_started", "migration_failed"]);
  } finally {
    database.close();
  }
});

Deno.test("migration logs do not expose SQL from dependency errors", async () => {
  const database = new DatabaseSync(":memory:");
  const directoryPath = await Deno.makeTempDir();
  const directory = toFileUrl(`${directoryPath}/`);
  const sqlSentinel = "PRIVATE_SQL_SENTINEL";
  const entries: Array<Record<string, unknown>> = [];

  try {
    await Deno.writeTextFile(
      new URL("0001-invalid.sql", directory),
      `${sqlSentinel} IS NOT VALID SQL;`,
    );

    await assertRejects(
      () =>
        Effect.runPromise(
          migrate(database, {
            directory,
            logger: recordingLogEntries(entries),
          }),
        ),
      Error,
      "Database migration failed.",
    );

    const failure = entries.find((entry) => entry.event === "migration_failed");
    const error = failure?.error as
      | { readonly message?: string; readonly cause?: unknown }
      | undefined;

    assertEquals(error?.message, "Database migration failed.");
    assertEquals(error?.cause, undefined);
    assertEquals(JSON.stringify(failure).includes(sqlSentinel), false);
  } finally {
    database.close();
    await Deno.remove(directoryPath, { recursive: true });
  }
});
