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

Deno.test("drafts migration creates the drafts table with constraints", async () => {
  const database = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
  });

  try {
    await Effect.runPromise(migrate(database));

    const table = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'drafts'",
      )
      .get() as { name: string } | undefined;
    assertEquals(table, { name: "drafts" });

    const indexes = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'drafts'",
      )
      .all() as Array<{ name: string }>;
    assertEquals(
      indexes.map((index) => index.name).includes("drafts_stack_id_idx"),
      true,
    );
    assertEquals(
      indexes.map((index) => index.name).includes("drafts_state_id_idx"),
      true,
    );
  } finally {
    database.close();
  }
});

Deno.test("drafts migration rejects invalid titles and descriptions", async () => {
  const database = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
  });

  try {
    await Effect.runPromise(migrate(database));

    await expectSqliteConstraintFailure(() => {
      database.prepare(
        `
          INSERT INTO drafts (
            id,
            stack_id,
            title,
            description,
            state_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "00000000-0000-4000-8000-000000000101",
        null,
        "",
        "",
        "00000000-0000-4000-8000-000000000005",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      );
    });

    await expectSqliteConstraintFailure(() => {
      database.prepare(
        `
          INSERT INTO drafts (
            id,
            stack_id,
            title,
            description,
            state_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "00000000-0000-4000-8000-000000000102",
        null,
        "x".repeat(161),
        "",
        "00000000-0000-4000-8000-000000000005",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      );
    });

    await expectSqliteConstraintFailure(() => {
      database.prepare(
        `
          INSERT INTO drafts (
            id,
            stack_id,
            title,
            description,
            state_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "00000000-0000-4000-8000-000000000103",
        null,
        "Valid title",
        "x".repeat(20001),
        "00000000-0000-4000-8000-000000000005",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      );
    });
  } finally {
    database.close();
  }
});

Deno.test("drafts migration enforces state and stack foreign keys", async () => {
  const database = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
  });

  try {
    await Effect.runPromise(migrate(database));

    await expectSqliteConstraintFailure(() => {
      database.prepare(
        `
          INSERT INTO drafts (
            id,
            stack_id,
            title,
            description,
            state_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "00000000-0000-4000-8000-000000000104",
        null,
        "Valid title",
        "",
        "00000000-0000-4000-8000-00000000ffff",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      );
    });

    await expectSqliteConstraintFailure(() => {
      database.prepare(
        `
          INSERT INTO drafts (
            id,
            stack_id,
            title,
            description,
            state_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "00000000-0000-4000-8000-000000000105",
        "00000000-0000-4000-8000-00000000ffff",
        "Valid title",
        "",
        "00000000-0000-4000-8000-000000000005",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      );
    });
  } finally {
    database.close();
  }
});

Deno.test("drafts migration allows nullable stack association", async () => {
  const database = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
  });

  try {
    await Effect.runPromise(migrate(database));

    database.prepare(
      `
        INSERT INTO drafts (
          id,
          stack_id,
          title,
          description,
          state_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      "00000000-0000-4000-8000-000000000106",
      null,
      "Standalone draft",
      "",
      "00000000-0000-4000-8000-000000000005",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    );

    const row = database
      .prepare("SELECT stack_id FROM drafts WHERE id = ?")
      .get("00000000-0000-4000-8000-000000000106") as {
        stack_id: string | null;
      };

    assertEquals(row.stack_id, null);
  } finally {
    database.close();
  }
});
