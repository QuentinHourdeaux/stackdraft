import type { DatabaseSync } from "node:sqlite";
import { Data, Effect } from "effect";

export const defaultMigrationsUrl = new URL(
  "../../../migrations/",
  import.meta.url,
);

export class MigrationError extends Data.TaggedError("MigrationError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

interface Migration {
  readonly version: string;
  readonly sql: string;
}

const readMigrations = (
  directory: URL,
): Effect.Effect<readonly Migration[], MigrationError> =>
  Effect.tryPromise({
    try: async () => {
      const entries: string[] = [];

      for await (const entry of Deno.readDir(directory)) {
        if (entry.isFile && entry.name.endsWith(".sql")) {
          entries.push(entry.name);
        }
      }

      entries.sort();

      return await Promise.all(
        entries.map(async (version) => ({
          version,
          sql: await Deno.readTextFile(new URL(version, directory)),
        })),
      );
    },
    catch: (cause) =>
      new MigrationError({
        message: "Could not read database migrations.",
        cause,
      }),
  });

const bootstrapMigrationTable = (database: DatabaseSync): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT
  `);
};

export const migrate = (
  database: DatabaseSync,
  directory: URL = defaultMigrationsUrl,
): Effect.Effect<void, MigrationError> =>
  Effect.gen(function* () {
    const migrations = yield* readMigrations(directory);

    yield* Effect.try({
      try: () => {
        bootstrapMigrationTable(database);

        const appliedRows = database
          .prepare("SELECT version FROM schema_migrations ORDER BY version")
          .all() as Array<{ version: string }>;

        const knownVersions = new Set(
          migrations.map((migration) => migration.version),
        );

        const unknownVersions = appliedRows
          .map((row) => row.version)
          .filter((version) => !knownVersions.has(version));

        if (unknownVersions.length > 0) {
          throw new Error(
            `Database contains unknown migrations: ${
              unknownVersions.join(", ")
            }`,
          );
        }

        const appliedVersions = new Set(
          appliedRows.map((row) => row.version),
        );
        const recordMigration = database.prepare(
          "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
        );

        for (const migration of migrations) {
          if (appliedVersions.has(migration.version)) {
            continue;
          }

          database.exec("BEGIN IMMEDIATE");
          try {
            database.exec(migration.sql);
            recordMigration.run(migration.version, new Date().toISOString());
            database.exec("COMMIT");
          } catch (cause) {
            database.exec("ROLLBACK");
            throw cause;
          }
        }
      },
      catch: (cause) =>
        new MigrationError({
          message: cause instanceof Error
            ? cause.message
            : "Database migration failed.",
          cause,
        }),
    });
  });
