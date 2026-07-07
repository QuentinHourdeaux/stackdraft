import { assertEquals } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { migrate } from "../api/infrastructure/database/migrate.ts";
import {
  StateInUseError,
  UnknownStateRepositoryError,
} from "../api/application/state-repository.ts";
import { makeStateRepository } from "../api/infrastructure/database/state-repository.ts";

const stackSeedStates = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    scope: "stack" as const,
    name: "Planned",
    color: "#8d98a5",
    position: 0,
    isDefault: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    scope: "stack" as const,
    name: "Active",
    color: "#8fa8ff",
    position: 1,
    isDefault: false,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    scope: "stack" as const,
    name: "Paused",
    color: "#f0b35a",
    position: 2,
    isDefault: false,
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    scope: "stack" as const,
    name: "Completed",
    color: "#62d79b",
    position: 3,
    isDefault: false,
  },
];

const draftSeedStates = [
  {
    id: "00000000-0000-4000-8000-000000000005",
    scope: "draft" as const,
    name: "Backlog",
    color: "#8d98a5",
    position: 0,
    isDefault: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    scope: "draft" as const,
    name: "Todo",
    color: "#8fa8ff",
    position: 1,
    isDefault: false,
  },
  {
    id: "00000000-0000-4000-8000-000000000007",
    scope: "draft" as const,
    name: "In Progress",
    color: "#b28cff",
    position: 2,
    isDefault: false,
  },
  {
    id: "00000000-0000-4000-8000-000000000008",
    scope: "draft" as const,
    name: "Done",
    color: "#62d79b",
    position: 3,
    isDefault: false,
  },
  {
    id: "00000000-0000-4000-8000-000000000009",
    scope: "draft" as const,
    name: "Canceled",
    color: "#ff7b8a",
    position: 4,
    isDefault: false,
  },
];

Deno.test("state repository returns seeded stack states in position order", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const states = await Effect.runPromise(repository.listByScope("stack"));

    assertEquals(
      states.map(({ id, scope, name, color, position, isDefault }) => ({
        id,
        scope,
        name,
        color,
        position,
        isDefault,
      })),
      stackSeedStates,
    );
  } finally {
    database.close();
  }
});

Deno.test("state repository returns seeded draft states in position order", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const states = await Effect.runPromise(repository.listByScope("draft"));

    assertEquals(
      states.map(({ id, scope, name, color, position, isDefault }) => ({
        id,
        scope,
        name,
        color,
        position,
        isDefault,
      })),
      draftSeedStates,
    );
  } finally {
    database.close();
  }
});

Deno.test("state repository includes timestamps for each state", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const states = await Effect.runPromise(repository.listByScope("stack"));

    for (const state of states) {
      assertEquals(typeof state.createdAt, "string");
      assertEquals(typeof state.updatedAt, "string");
      assertEquals(state.createdAt.length > 0, true);
      assertEquals(state.updatedAt.length > 0, true);
    }
  } finally {
    database.close();
  }
});

Deno.test("state repository creates a state at the next position", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const created = await Effect.runPromise(
      repository.create({
        id: "00000000-0000-4000-8000-00000000aa01",
        scope: "stack",
        name: "Review",
        color: "#aabbcc",
        position: 4,
        isDefault: false,
        createdAt: "2026-02-01T12:00:00.000Z",
        updatedAt: "2026-02-01T12:00:00.000Z",
      }),
    );

    assertEquals(created.position, 4);
    assertEquals(created.isDefault, false);
    assertEquals(created.name, "Review");
    assertEquals(created.color, "#aabbcc");

    const states = await Effect.runPromise(repository.listByScope("stack"));
    assertEquals(states.length, 5);
    assertEquals(states[4]?.name, "Review");
  } finally {
    database.close();
  }
});

Deno.test("state repository rejects duplicate names within a scope", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const result = await Effect.runPromise(
      Effect.either(
        repository.create({
          id: "00000000-0000-4000-8000-00000000aa02",
          scope: "stack",
          name: "planned",
          color: "#112233",
          position: 4,
          isDefault: false,
          createdAt: "2026-02-01T12:00:00.000Z",
          updatedAt: "2026-02-01T12:00:00.000Z",
        }),
      ),
    );

    assertEquals(result._tag, "Left");
    if (result._tag === "Left") {
      assertEquals(result.left._tag, "StateNameConflictError");
    }
  } finally {
    database.close();
  }
});

Deno.test("state repository does not report non-name unique constraints as name conflicts", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const result = await Effect.runPromise(
      Effect.either(
        repository.create({
          id: "00000000-0000-4000-8000-00000000aa04",
          scope: "stack",
          name: "Review",
          color: "#112233",
          position: 3,
          isDefault: false,
          createdAt: "2026-02-01T12:00:00.000Z",
          updatedAt: "2026-02-01T12:00:00.000Z",
        }),
      ),
    );

    assertEquals(result._tag, "Left");
    if (result._tag === "Left") {
      assertEquals(result.left instanceof UnknownStateRepositoryError, true);
    }
  } finally {
    database.close();
  }
});

Deno.test("state repository allows the same name in different scopes", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const created = await Effect.runPromise(
      repository.create({
        id: "00000000-0000-4000-8000-00000000aa03",
        scope: "draft",
        name: "Planned",
        color: "#112233",
        position: 5,
        isDefault: false,
        createdAt: "2026-02-01T12:00:00.000Z",
        updatedAt: "2026-02-01T12:00:00.000Z",
      }),
    );

    assertEquals(created.scope, "draft");
    assertEquals(created.name, "Planned");
  } finally {
    database.close();
  }
});

Deno.test("state repository updates a state's mutable fields", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const existing = await Effect.runPromise(
      repository.findById("00000000-0000-4000-8000-000000000002"),
    );

    assertEquals(existing !== null, true);
    if (existing === null) {
      return;
    }

    const updated = await Effect.runPromise(
      repository.update({
        ...existing,
        name: "In Flight",
        color: "#223344",
        updatedAt: "2026-02-02T12:00:00.000Z",
      }),
    );

    assertEquals(updated.name, "In Flight");
    assertEquals(updated.color, "#223344");
    assertEquals(updated.updatedAt, "2026-02-02T12:00:00.000Z");
    assertEquals(updated.position, existing.position);
    assertEquals(updated.isDefault, existing.isDefault);
  } finally {
    database.close();
  }
});

Deno.test("state repository returns not found when updating a missing state", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const result = await Effect.runPromise(
      Effect.either(
        repository.update({
          id: "00000000-0000-4000-8000-000000000099",
          scope: "stack",
          name: "Missing",
          color: "#112233",
          position: 0,
          isDefault: false,
          createdAt: "2026-02-01T12:00:00.000Z",
          updatedAt: "2026-02-01T12:00:00.000Z",
        }),
      ),
    );

    assertEquals(result._tag, "Left");
    if (result._tag === "Left") {
      assertEquals(result.left._tag, "StateNotFoundError");
    }
  } finally {
    database.close();
  }
});

Deno.test("state repository reports max position in scope", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);

    assertEquals(
      await Effect.runPromise(repository.maxPositionInScope("stack")),
      3,
    );
    assertEquals(
      await Effect.runPromise(repository.maxPositionInScope("draft")),
      4,
    );
  } finally {
    database.close();
  }
});

Deno.test("state repository reorders a state within its scope", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const updatedAt = "2026-02-03T12:00:00.000Z";
    const states = await Effect.runPromise(
      repository.reorderState(
        "00000000-0000-4000-8000-000000000002",
        3,
        updatedAt,
      ),
    );

    assertEquals(
      states.map(({ id, position, updatedAt: stateUpdatedAt }) => ({
        id,
        position,
        updatedAt: stateUpdatedAt,
      })),
      [
        {
          id: "00000000-0000-4000-8000-000000000001",
          position: 0,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000003",
          position: 1,
          updatedAt,
        },
        {
          id: "00000000-0000-4000-8000-000000000004",
          position: 2,
          updatedAt,
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          position: 3,
          updatedAt,
        },
      ],
    );
  } finally {
    database.close();
  }
});

Deno.test("state repository treats a move to the current position as a no-op", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const before = await Effect.runPromise(repository.listByScope("stack"));
    const states = await Effect.runPromise(
      repository.reorderState(
        "00000000-0000-4000-8000-000000000002",
        1,
        "2026-02-03T12:00:00.000Z",
      ),
    );

    assertEquals(states, before);
  } finally {
    database.close();
  }
});

Deno.test("state repository keeps positions contiguous and unique after reordering", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);

    await Effect.runPromise(
      repository.reorderState(
        "00000000-0000-4000-8000-000000000007",
        0,
        "2026-02-03T12:00:00.000Z",
      ),
    );

    const states = await Effect.runPromise(repository.listByScope("draft"));
    assertEquals(
      states.map((state) => state.position),
      [0, 1, 2, 3, 4],
    );
    assertEquals(new Set(states.map((state) => state.position)).size, 5);
  } finally {
    database.close();
  }
});

Deno.test("state repository rejects an out-of-range position during reorder", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const result = await Effect.runPromise(
      Effect.either(
        repository.reorderState(
          "00000000-0000-4000-8000-000000000002",
          9,
          "2026-02-03T12:00:00.000Z",
        ),
      ),
    );

    assertEquals(result._tag, "Left");
    if (result._tag === "Left" && result.left._tag === "ValidationError") {
      assertEquals(
        result.left.fields.position,
        "Position must be between 0 and 3.",
      );
    } else {
      throw new Error("Expected ValidationError.");
    }
  } finally {
    database.close();
  }
});

Deno.test("state repository returns not found when reordering a missing state", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const result = await Effect.runPromise(
      Effect.either(
        repository.reorderState(
          "00000000-0000-4000-8000-000000000099",
          0,
          "2026-02-03T12:00:00.000Z",
        ),
      ),
    );

    assertEquals(result._tag, "Left");
    if (result._tag === "Left") {
      assertEquals(result.left._tag, "StateNotFoundError");
    }
  } finally {
    database.close();
  }
});

Deno.test("state repository rolls back reorder changes on mid-operation failure", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const before = await Effect.runPromise(repository.listByScope("stack"));
    const originalPrepare = database.prepare.bind(database);
    let updateCount = 0;

    database.prepare = ((sql: string) => {
      const statement = originalPrepare(sql);

      if (!sql.includes("UPDATE states")) {
        return statement;
      }

      const originalRun = statement.run.bind(statement);

      statement.run = ((...args: Parameters<typeof statement.run>) => {
        updateCount += 1;

        if (updateCount === 2) {
          throw new Error("Injected reorder failure.");
        }

        return originalRun(...args);
      }) as typeof statement.run;

      return statement;
    }) as typeof database.prepare;

    const result = await Effect.runPromise(
      Effect.either(
        repository.reorderState(
          "00000000-0000-4000-8000-000000000002",
          3,
          "2026-02-03T12:00:00.000Z",
        ),
      ),
    );

    assertEquals(result._tag, "Left");
    assertEquals(
      await Effect.runPromise(repository.listByScope("stack")),
      before,
    );
  } finally {
    database.close();
  }
});

Deno.test("state repository selects a new default within a scope", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const updatedAt = "2026-02-03T12:00:00.000Z";
    const selected = await Effect.runPromise(
      repository.selectDefault(
        "00000000-0000-4000-8000-000000000002",
        updatedAt,
      ),
    );

    assertEquals(selected.isDefault, true);
    assertEquals(selected.updatedAt, updatedAt);

    const states = await Effect.runPromise(repository.listByScope("stack"));
    assertEquals(states.filter((state) => state.isDefault).length, 1);
    assertEquals(states.find((state) => state.isDefault)?.id, selected.id);

    const previousDefault = states.find(
      (state) => state.id === "00000000-0000-4000-8000-000000000001",
    );
    assertEquals(previousDefault?.isDefault, false);
    assertEquals(previousDefault?.updatedAt, updatedAt);
  } finally {
    database.close();
  }
});

Deno.test("state repository treats selecting the current default as a no-op", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const before = await Effect.runPromise(
      repository.findById("00000000-0000-4000-8000-000000000001"),
    );
    const selected = await Effect.runPromise(
      repository.selectDefault(
        "00000000-0000-4000-8000-000000000001",
        "2026-02-03T12:00:00.000Z",
      ),
    );

    assertEquals(selected, before);
  } finally {
    database.close();
  }
});

Deno.test("state repository returns not found when selecting a missing default", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const result = await Effect.runPromise(
      Effect.either(
        repository.selectDefault(
          "00000000-0000-4000-8000-000000000099",
          "2026-02-03T12:00:00.000Z",
        ),
      ),
    );

    assertEquals(result._tag, "Left");
    if (result._tag === "Left") {
      assertEquals(result.left._tag, "StateNotFoundError");
    }
  } finally {
    database.close();
  }
});

Deno.test("state repository rolls back default selection on mid-operation failure", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const before = await Effect.runPromise(repository.listByScope("stack"));
    const originalPrepare = database.prepare.bind(database);
    let updateCount = 0;

    database.prepare = ((sql: string) => {
      const statement = originalPrepare(sql);

      if (!sql.includes("UPDATE states")) {
        return statement;
      }

      const originalRun = statement.run.bind(statement);

      statement.run = ((...args: Parameters<typeof statement.run>) => {
        updateCount += 1;

        if (updateCount === 2) {
          throw new Error("Injected default selection failure.");
        }

        return originalRun(...args);
      }) as typeof statement.run;

      return statement;
    }) as typeof database.prepare;

    const result = await Effect.runPromise(
      Effect.either(
        repository.selectDefault(
          "00000000-0000-4000-8000-000000000002",
          "2026-02-03T12:00:00.000Z",
        ),
      ),
    );

    assertEquals(result._tag, "Left");
    assertEquals(
      await Effect.runPromise(repository.listByScope("stack")),
      before,
    );
  } finally {
    database.close();
  }
});

Deno.test("state repository deletes a state and compacts later positions", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const updatedAt = "2026-02-04T12:00:00.000Z";

    await Effect.runPromise(
      repository.deleteState(
        "00000000-0000-4000-8000-000000000004",
        updatedAt,
      ),
    );

    const states = await Effect.runPromise(repository.listByScope("stack"));
    assertEquals(states.length, 3);
    assertEquals(
      states.map(({ id, position, updatedAt: stateUpdatedAt }) => ({
        id,
        position,
        updatedAt: stateUpdatedAt,
      })),
      [
        {
          id: "00000000-0000-4000-8000-000000000001",
          position: 0,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          position: 1,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000003",
          position: 2,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    );
    assertEquals(
      await Effect.runPromise(
        repository.findById("00000000-0000-4000-8000-000000000004"),
      ),
      null,
    );
  } finally {
    database.close();
  }
});

Deno.test("state repository compacts later positions when deleting a middle state", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const updatedAt = "2026-02-04T12:00:00.000Z";

    await Effect.runPromise(
      repository.deleteState(
        "00000000-0000-4000-8000-000000000003",
        updatedAt,
      ),
    );

    const states = await Effect.runPromise(repository.listByScope("stack"));
    assertEquals(
      states.map(({ id, position, updatedAt: stateUpdatedAt }) => ({
        id,
        position,
        updatedAt: stateUpdatedAt,
      })),
      [
        {
          id: "00000000-0000-4000-8000-000000000001",
          position: 0,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          position: 1,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000004",
          position: 2,
          updatedAt,
        },
      ],
    );
  } finally {
    database.close();
  }
});

Deno.test("state repository returns not found when deleting a missing state", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const result = await Effect.runPromise(
      Effect.either(
        repository.deleteState(
          "00000000-0000-4000-8000-000000000099",
          "2026-02-04T12:00:00.000Z",
        ),
      ),
    );

    assertEquals(result._tag, "Left");
    if (result._tag === "Left") {
      assertEquals(result.left._tag, "StateNotFoundError");
    }
  } finally {
    database.close();
  }
});

Deno.test("state repository maps foreign-key deletion failures to state in use", async () => {
  const database = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
  });

  try {
    await Effect.runPromise(migrate(database));
    database.exec(`
      CREATE TABLE state_reference_probe (
        state_id TEXT NOT NULL REFERENCES states(id) ON UPDATE RESTRICT ON DELETE RESTRICT
      )
    `);
    database.prepare(
      `
        INSERT INTO state_reference_probe (state_id)
        VALUES (?)
      `,
    ).run("00000000-0000-4000-8000-000000000002");

    const repository = makeStateRepository(database);
    const result = await Effect.runPromise(
      Effect.either(
        repository.deleteState(
          "00000000-0000-4000-8000-000000000002",
          "2026-02-04T12:00:00.000Z",
        ),
      ),
    );

    assertEquals(result._tag, "Left");
    if (result._tag === "Left") {
      assertEquals(result.left instanceof StateInUseError, true);
    }
  } finally {
    database.close();
  }
});

Deno.test("state repository rolls back deletion changes on mid-operation failure", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const repository = makeStateRepository(database);
    const before = await Effect.runPromise(repository.listByScope("stack"));
    const originalPrepare = database.prepare.bind(database);
    let updateCount = 0;

    database.prepare = ((sql: string) => {
      const statement = originalPrepare(sql);

      if (!sql.includes("UPDATE states")) {
        return statement;
      }

      const originalRun = statement.run.bind(statement);

      statement.run = ((...args: Parameters<typeof statement.run>) => {
        updateCount += 1;

        if (updateCount === 1) {
          throw new Error("Injected deletion compaction failure.");
        }

        return originalRun(...args);
      }) as typeof statement.run;

      return statement;
    }) as typeof database.prepare;

    const result = await Effect.runPromise(
      Effect.either(
        repository.deleteState(
          "00000000-0000-4000-8000-000000000004",
          "2026-02-04T12:00:00.000Z",
        ),
      ),
    );

    assertEquals(result._tag, "Left");
    assertEquals(
      await Effect.runPromise(repository.listByScope("stack")),
      before,
    );
  } finally {
    database.close();
  }
});
