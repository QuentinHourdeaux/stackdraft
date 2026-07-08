import { assertEquals } from "@std/assert";
import {
  isSqliteForeignKeyError,
  isSqliteUniqueConstraintError,
} from "../api/lib/sqlite/errors.ts";
import { runInImmediateTransaction } from "../api/lib/sqlite/transaction.ts";

Deno.test("runInImmediateTransaction commits successful operations", () => {
  const statements: string[] = [];

  runInImmediateTransaction(
    { exec: (sql: string) => statements.push(sql) },
    () => {
      statements.push("WORK");
    },
  );

  assertEquals(statements, ["BEGIN IMMEDIATE", "WORK", "COMMIT"]);
});

Deno.test("runInImmediateTransaction rolls back thrown failures", () => {
  const statements: string[] = [];

  try {
    runInImmediateTransaction(
      { exec: (sql: string) => statements.push(sql) },
      () => {
        statements.push("WORK");
        throw new Error("boom");
      },
    );
  } catch (cause) {
    assertEquals(
      cause instanceof Error ? cause.message : String(cause),
      "boom",
    );
  }

  assertEquals(statements, ["BEGIN IMMEDIATE", "WORK", "ROLLBACK"]);
});

Deno.test("SQLite error helpers detect errcodes and message fallbacks", () => {
  assertEquals(isSqliteUniqueConstraintError({ errcode: 2067 }), true);
  assertEquals(
    isSqliteUniqueConstraintError(
      new Error("UNIQUE constraint failed: states.scope, states.name"),
    ),
    true,
  );
  assertEquals(isSqliteForeignKeyError({ errcode: 787 }), true);
  assertEquals(
    isSqliteForeignKeyError(new Error("FOREIGN KEY constraint failed")),
    true,
  );
  assertEquals(isSqliteUniqueConstraintError(new Error("other")), false);
  assertEquals(isSqliteForeignKeyError(new Error("other")), false);
});
