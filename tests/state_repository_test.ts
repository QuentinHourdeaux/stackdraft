import { assertEquals } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { migrate } from "../api/infrastructure/database/migrate.ts";
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
