import { assertEquals, assertRejects } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { migrate } from "../api/infrastructure/database/migrate.ts";

const expectSqliteConstraintFailure = async (
  run: () => void,
): Promise<void> => {
  await assertRejects(async () => {
    await Promise.resolve();
    run();
  }, Error);
};

Deno.test("stacks migration creates the stacks table with constraints", async () => {
  const database = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
  });

  try {
    await Effect.runPromise(migrate(database));

    const table = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'stacks'",
      )
      .get() as { name: string } | undefined;
    assertEquals(table, { name: "stacks" });

    const indexes = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'stacks'",
      )
      .all() as Array<{ name: string }>;
    assertEquals(
      indexes.map((index) => index.name).includes("stacks_state_id_idx"),
      true,
    );
  } finally {
    database.close();
  }
});

Deno.test("stacks migration rejects invalid titles and descriptions", async () => {
  const database = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
  });

  try {
    await Effect.runPromise(migrate(database));

    await expectSqliteConstraintFailure(() => {
      database.prepare(
        `
          INSERT INTO stacks (
            id,
            title,
            description,
            state_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "00000000-0000-4000-8000-000000000101",
        "",
        "",
        "00000000-0000-4000-8000-000000000001",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      );
    });

    await expectSqliteConstraintFailure(() => {
      database.prepare(
        `
          INSERT INTO stacks (
            id,
            title,
            description,
            state_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "00000000-0000-4000-8000-000000000102",
        "x".repeat(161),
        "",
        "00000000-0000-4000-8000-000000000001",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      );
    });

    await expectSqliteConstraintFailure(() => {
      database.prepare(
        `
          INSERT INTO stacks (
            id,
            title,
            description,
            state_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "00000000-0000-4000-8000-000000000103",
        "Valid title",
        "x".repeat(20001),
        "00000000-0000-4000-8000-000000000001",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      );
    });
  } finally {
    database.close();
  }
});

Deno.test("stacks migration enforces the state foreign key", async () => {
  const database = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
  });

  try {
    await Effect.runPromise(migrate(database));

    await expectSqliteConstraintFailure(() => {
      database.prepare(
        `
          INSERT INTO stacks (
            id,
            title,
            description,
            state_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "00000000-0000-4000-8000-000000000104",
        "Valid title",
        "",
        "00000000-0000-4000-8000-00000000ffff",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      );
    });
  } finally {
    database.close();
  }
});
