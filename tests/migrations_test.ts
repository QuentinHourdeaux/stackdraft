import { assertEquals, assertRejects } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import {
  defaultMigrationsUrl,
  migrate,
} from "../api/infrastructure/database/migrate.ts";

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
    ]);
  } finally {
    database.close();
  }
});

Deno.test("migrations reject database versions unknown to the application", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    database.prepare(
      "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
    ).run("9999_unknown.sql", new Date().toISOString());

    await assertRejects(
      () => Effect.runPromise(migrate(database, defaultMigrationsUrl)),
      Error,
      "unknown migrations",
    );
  } finally {
    database.close();
  }
});
