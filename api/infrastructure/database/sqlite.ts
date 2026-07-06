import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Data, Effect } from "effect";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly operation: "open" | "close";
  readonly cause: unknown;
}> {}

export const openSqlite = (
  path: string,
): Effect.Effect<DatabaseSync, DatabaseError> =>
  Effect.gen(function* () {
    if (path !== ":memory:") {
      yield* Effect.tryPromise({
        try: () => Deno.mkdir(dirname(path), { recursive: true }),
        catch: (cause) => new DatabaseError({ operation: "open", cause }),
      });
    }

    return yield* Effect.try({
      try: () => {
        const database = new DatabaseSync(path, {
          enableForeignKeyConstraints: true,
        });

        database.exec("PRAGMA busy_timeout = 5000");
        database.exec("PRAGMA journal_mode = WAL");
        database.exec("PRAGMA synchronous = NORMAL");

        return database;
      },
      catch: (cause) => new DatabaseError({ operation: "open", cause }),
    });
  });

export const closeSqlite = (
  database: DatabaseSync,
): Effect.Effect<void, DatabaseError> =>
  Effect.try({
    try: () => database.close(),
    catch: (cause) => new DatabaseError({ operation: "close", cause }),
  });
