import { assertEquals } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { migrate } from "../api/infrastructure/database/migrate.ts";
import { StateInUseError, UnknownStateStoreError } from "../api/core/errors.ts";
import { makeStateStore } from "../api/infrastructure/database/state-store.ts";
import {
  utcDateTimeFromIsoString,
  utcDateTimeToIsoString,
} from "../api/lib/time/utc.ts";

const utc = utcDateTimeFromIsoString;

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

Deno.test("state store returns seeded stack states in position order", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const states = await Effect.runPromise(store.listByScope("stack"));

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

Deno.test("state store returns seeded draft states in position order", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const states = await Effect.runPromise(store.listByScope("draft"));

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

Deno.test("state store includes timestamps for each state", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const states = await Effect.runPromise(store.listByScope("stack"));

    for (const state of states) {
      assertEquals(typeof utcDateTimeToIsoString(state.createdAt), "string");
      assertEquals(typeof utcDateTimeToIsoString(state.updatedAt), "string");
      assertEquals(utcDateTimeToIsoString(state.createdAt).length > 0, true);
      assertEquals(utcDateTimeToIsoString(state.updatedAt).length > 0, true);
    }
  } finally {
    database.close();
  }
});

Deno.test("state store creates a state at the next position", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const created = await Effect.runPromise(
      store.create({
        id: "00000000-0000-4000-8000-00000000aa01",
        scope: "stack",
        name: "Review",
        color: "#aabbcc",
        position: 4,
        isDefault: false,
        createdAt: utc("2026-02-01T12:00:00.000Z"),
        updatedAt: utc("2026-02-01T12:00:00.000Z"),
      }),
    );

    assertEquals(created.position, 4);
    assertEquals(created.isDefault, false);
    assertEquals(created.name, "Review");
    assertEquals(created.color, "#aabbcc");

    const states = await Effect.runPromise(store.listByScope("stack"));
    assertEquals(states.length, 5);
    assertEquals(states[4]?.name, "Review");
  } finally {
    database.close();
  }
});

Deno.test("state store rejects duplicate names within a scope", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const result = await Effect.runPromise(
      Effect.either(
        store.create({
          id: "00000000-0000-4000-8000-00000000aa02",
          scope: "stack",
          name: "planned",
          color: "#112233",
          position: 4,
          isDefault: false,
          createdAt: utc("2026-02-01T12:00:00.000Z"),
          updatedAt: utc("2026-02-01T12:00:00.000Z"),
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

Deno.test("state store does not report non-name unique constraints as name conflicts", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const result = await Effect.runPromise(
      Effect.either(
        store.create({
          id: "00000000-0000-4000-8000-00000000aa04",
          scope: "stack",
          name: "Review",
          color: "#112233",
          position: 3,
          isDefault: false,
          createdAt: utc("2026-02-01T12:00:00.000Z"),
          updatedAt: utc("2026-02-01T12:00:00.000Z"),
        }),
      ),
    );

    assertEquals(result._tag, "Left");
    if (result._tag === "Left") {
      assertEquals(result.left instanceof UnknownStateStoreError, true);
    }
  } finally {
    database.close();
  }
});

Deno.test("state store allows the same name in different scopes", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const created = await Effect.runPromise(
      store.create({
        id: "00000000-0000-4000-8000-00000000aa03",
        scope: "draft",
        name: "Planned",
        color: "#112233",
        position: 5,
        isDefault: false,
        createdAt: utc("2026-02-01T12:00:00.000Z"),
        updatedAt: utc("2026-02-01T12:00:00.000Z"),
      }),
    );

    assertEquals(created.scope, "draft");
    assertEquals(created.name, "Planned");
  } finally {
    database.close();
  }
});

Deno.test("state store updates a state's mutable fields", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const existing = await Effect.runPromise(
      store.findById("00000000-0000-4000-8000-000000000002"),
    );

    assertEquals(existing !== null, true);
    if (existing === null) {
      return;
    }

    const updated = await Effect.runPromise(
      store.update({
        ...existing,
        name: "In Flight",
        color: "#223344",
        updatedAt: utc("2026-02-02T12:00:00.000Z"),
      }),
    );

    assertEquals(updated.name, "In Flight");
    assertEquals(updated.color, "#223344");
    assertEquals(updated.updatedAt, utc("2026-02-02T12:00:00.000Z"));
    assertEquals(updated.position, existing.position);
    assertEquals(updated.isDefault, existing.isDefault);
  } finally {
    database.close();
  }
});

Deno.test("state store returns not found when updating a missing state", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const result = await Effect.runPromise(
      Effect.either(
        store.update({
          id: "00000000-0000-4000-8000-000000000099",
          scope: "stack",
          name: "Missing",
          color: "#112233",
          position: 0,
          isDefault: false,
          createdAt: utc("2026-02-01T12:00:00.000Z"),
          updatedAt: utc("2026-02-01T12:00:00.000Z"),
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

Deno.test("state store reports max position in scope", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);

    assertEquals(
      await Effect.runPromise(store.maxPositionInScope("stack")),
      3,
    );
    assertEquals(
      await Effect.runPromise(store.maxPositionInScope("draft")),
      4,
    );
  } finally {
    database.close();
  }
});

Deno.test("state store reorders a state within its scope", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const updatedAt = utc("2026-02-03T12:00:00.000Z");
    const states = await Effect.runPromise(
      store.reorderState(
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
          updatedAt: utc("2026-01-01T00:00:00.000Z"),
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

Deno.test("state store treats a move to the current position as a no-op", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const before = await Effect.runPromise(store.listByScope("stack"));
    const states = await Effect.runPromise(
      store.reorderState(
        "00000000-0000-4000-8000-000000000002",
        1,
        utc("2026-02-03T12:00:00.000Z"),
      ),
    );

    assertEquals(states, before);
  } finally {
    database.close();
  }
});

Deno.test("state store keeps positions contiguous and unique after reordering", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);

    await Effect.runPromise(
      store.reorderState(
        "00000000-0000-4000-8000-000000000007",
        0,
        utc("2026-02-03T12:00:00.000Z"),
      ),
    );

    const states = await Effect.runPromise(store.listByScope("draft"));
    assertEquals(
      states.map((state) => state.position),
      [0, 1, 2, 3, 4],
    );
    assertEquals(new Set(states.map((state) => state.position)).size, 5);
  } finally {
    database.close();
  }
});

Deno.test("state store rejects an out-of-range position during reorder", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const result = await Effect.runPromise(
      Effect.either(
        store.reorderState(
          "00000000-0000-4000-8000-000000000002",
          9,
          utc("2026-02-03T12:00:00.000Z"),
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

Deno.test("state store returns not found when reordering a missing state", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const result = await Effect.runPromise(
      Effect.either(
        store.reorderState(
          "00000000-0000-4000-8000-000000000099",
          0,
          utc("2026-02-03T12:00:00.000Z"),
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

Deno.test("state store rolls back reorder changes on mid-operation failure", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const before = await Effect.runPromise(store.listByScope("stack"));
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
        store.reorderState(
          "00000000-0000-4000-8000-000000000002",
          3,
          utc("2026-02-03T12:00:00.000Z"),
        ),
      ),
    );

    assertEquals(result._tag, "Left");
    assertEquals(
      await Effect.runPromise(store.listByScope("stack")),
      before,
    );
  } finally {
    database.close();
  }
});

Deno.test("state store selects a new default within a scope", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const updatedAt = utc("2026-02-03T12:00:00.000Z");
    const selected = await Effect.runPromise(
      store.selectDefault(
        "00000000-0000-4000-8000-000000000002",
        updatedAt,
      ),
    );

    assertEquals(selected.isDefault, true);
    assertEquals(selected.updatedAt, updatedAt);

    const states = await Effect.runPromise(store.listByScope("stack"));
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

Deno.test("state store treats selecting the current default as a no-op", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const before = await Effect.runPromise(
      store.findById("00000000-0000-4000-8000-000000000001"),
    );
    const selected = await Effect.runPromise(
      store.selectDefault(
        "00000000-0000-4000-8000-000000000001",
        utc("2026-02-03T12:00:00.000Z"),
      ),
    );

    assertEquals(selected, before);
  } finally {
    database.close();
  }
});

Deno.test("state store returns not found when selecting a missing default", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const result = await Effect.runPromise(
      Effect.either(
        store.selectDefault(
          "00000000-0000-4000-8000-000000000099",
          utc("2026-02-03T12:00:00.000Z"),
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

Deno.test("state store rolls back default selection on mid-operation failure", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const before = await Effect.runPromise(store.listByScope("stack"));
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
        store.selectDefault(
          "00000000-0000-4000-8000-000000000002",
          utc("2026-02-03T12:00:00.000Z"),
        ),
      ),
    );

    assertEquals(result._tag, "Left");
    assertEquals(
      await Effect.runPromise(store.listByScope("stack")),
      before,
    );
  } finally {
    database.close();
  }
});

Deno.test("state store deletes a state and compacts later positions", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const updatedAt = utc("2026-02-04T12:00:00.000Z");

    await Effect.runPromise(
      store.deleteState(
        "00000000-0000-4000-8000-000000000004",
        updatedAt,
      ),
    );

    const states = await Effect.runPromise(store.listByScope("stack"));
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
          updatedAt: utc("2026-01-01T00:00:00.000Z"),
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          position: 1,
          updatedAt: utc("2026-01-01T00:00:00.000Z"),
        },
        {
          id: "00000000-0000-4000-8000-000000000003",
          position: 2,
          updatedAt: utc("2026-01-01T00:00:00.000Z"),
        },
      ],
    );
    assertEquals(
      await Effect.runPromise(
        store.findById("00000000-0000-4000-8000-000000000004"),
      ),
      null,
    );
  } finally {
    database.close();
  }
});

Deno.test("state store compacts later positions when deleting a middle state", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const updatedAt = utc("2026-02-04T12:00:00.000Z");

    await Effect.runPromise(
      store.deleteState(
        "00000000-0000-4000-8000-000000000003",
        updatedAt,
      ),
    );

    const states = await Effect.runPromise(store.listByScope("stack"));
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
          updatedAt: utc("2026-01-01T00:00:00.000Z"),
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          position: 1,
          updatedAt: utc("2026-01-01T00:00:00.000Z"),
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

Deno.test("state store returns not found when deleting a missing state", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const result = await Effect.runPromise(
      Effect.either(
        store.deleteState(
          "00000000-0000-4000-8000-000000000099",
          utc("2026-02-04T12:00:00.000Z"),
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

Deno.test("state store maps foreign-key deletion failures to state in use for stacks", async () => {
  const database = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
  });

  try {
    await Effect.runPromise(migrate(database));
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
      "00000000-0000-4000-8000-000000000201",
      "Payments rewrite",
      "",
      "00000000-0000-4000-8000-000000000002",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    );

    const store = makeStateStore(database);
    const result = await Effect.runPromise(
      Effect.either(
        store.deleteState(
          "00000000-0000-4000-8000-000000000002",
          utc("2026-02-04T12:00:00.000Z"),
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

Deno.test("state store maps foreign-key deletion failures to state in use for standalone drafts", async () => {
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
      "00000000-0000-4000-8000-000000000301",
      null,
      "Auth cleanup",
      "",
      "00000000-0000-4000-8000-000000000006",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    );

    const store = makeStateStore(database);
    const result = await Effect.runPromise(
      Effect.either(
        store.deleteState(
          "00000000-0000-4000-8000-000000000006",
          utc("2026-02-04T12:00:00.000Z"),
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

Deno.test("state store maps foreign-key deletion failures to state in use for stacked drafts", async () => {
  const database = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
  });

  try {
    await Effect.runPromise(migrate(database));
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
      "00000000-0000-4000-8000-000000000401",
      "Payments rewrite",
      "",
      "00000000-0000-4000-8000-000000000002",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    );
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
      "00000000-0000-4000-8000-000000000402",
      "00000000-0000-4000-8000-000000000401",
      "Extract billing module",
      "",
      "00000000-0000-4000-8000-000000000007",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    );

    const store = makeStateStore(database);
    const result = await Effect.runPromise(
      Effect.either(
        store.deleteState(
          "00000000-0000-4000-8000-000000000007",
          utc("2026-02-04T12:00:00.000Z"),
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

Deno.test("state store rolls back deletion changes on mid-operation failure", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStateStore(database);
    const before = await Effect.runPromise(store.listByScope("stack"));
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
        store.deleteState(
          "00000000-0000-4000-8000-000000000004",
          utc("2026-02-04T12:00:00.000Z"),
        ),
      ),
    );

    assertEquals(result._tag, "Left");
    assertEquals(
      await Effect.runPromise(store.listByScope("stack")),
      before,
    );
  } finally {
    database.close();
  }
});
