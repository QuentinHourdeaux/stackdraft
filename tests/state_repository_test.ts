import { assertEquals } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { migrate } from "../api/infrastructure/database/migrate.ts";
import { UnknownStateRepositoryError } from "../api/application/state-repository.ts";
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
