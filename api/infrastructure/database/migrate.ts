import type { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { MigrationError } from "../../core/errors.ts";
import type { Logger } from "../../lib/logging/logger.ts";
import { noopLogger } from "../../lib/logging/logger.ts";

export const defaultMigrationsUrl = new URL(
  "../../../migrations/",
  import.meta.url,
);

interface Migration {
  readonly version: string;
  readonly sql: string;
}

export interface MigrationOptions {
  readonly directory?: URL;
  readonly logger?: Logger;
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
  {
    directory = defaultMigrationsUrl,
    logger = noopLogger,
  }: MigrationOptions = {},
): Effect.Effect<void, MigrationError> => {
  const log = logger.with({ service: "migration", method: "migrate" });
  // Keep the migration itself separate from its boundary events so every log is
  // emitted when the Effect runs, never when a lazy Effect is merely created.
  const migration = Effect.gen(function* () {
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

  // tapError observes the typed MigrationError and then preserves it for the
  // application or command boundary to handle and log at its own scope.
  return Effect.gen(function* () {
    yield* Effect.sync(() => {
      log.info({
        event: "migration_started",
        message: "Started database migration.",
      });
    });

    yield* migration.pipe(
      Effect.tapError((cause) =>
        Effect.sync(() => {
          log.error({
            event: "migration_failed",
            message: "Database migration failed.",
            outcome: "failure",
            cause,
          });
        })
      ),
    );

    yield* Effect.sync(() => {
      log.info({
        event: "migration_completed",
        message: "Completed database migration.",
        outcome: "success",
      });
    });
  });
};
