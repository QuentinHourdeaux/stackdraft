import { assertEquals } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { migrate } from "../api/infrastructure/database/migrate.ts";
import { makeDraftStore } from "../api/infrastructure/database/draft-store.ts";
import { makeStackStore } from "../api/infrastructure/database/stack-store.ts";
import {
  utcDateTimeFromIsoString,
  utcDateTimeToIsoString,
} from "../api/lib/time/utc.ts";

const utc = utcDateTimeFromIsoString;

const defaultDraftStateId = "00000000-0000-4000-8000-000000000005";
const defaultStackStateId = "00000000-0000-4000-8000-000000000001";

Deno.test("draft store returns drafts in created_at desc order", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeDraftStore(database);

    const older = {
      id: "00000000-0000-4000-8000-000000000201",
      stackId: null,
      title: "Older",
      description: "",
      stateId: defaultDraftStateId,
      createdAt: utc("2026-01-01T00:00:00.000Z"),
      updatedAt: utc("2026-01-01T00:00:00.000Z"),
    };
    const newer = {
      id: "00000000-0000-4000-8000-000000000202",
      stackId: null,
      title: "Newer",
      description: "",
      stateId: defaultDraftStateId,
      createdAt: utc("2026-02-01T00:00:00.000Z"),
      updatedAt: utc("2026-02-01T00:00:00.000Z"),
    };

    await Effect.runPromise(
      store.createWithResolvedStateAndStack({
        id: older.id,
        title: older.title,
        description: older.description,
        createdAt: older.createdAt,
        updatedAt: older.updatedAt,
      }),
    );
    await Effect.runPromise(
      store.createWithResolvedStateAndStack({
        id: newer.id,
        title: newer.title,
        description: newer.description,
        createdAt: newer.createdAt,
        updatedAt: newer.updatedAt,
      }),
    );

    const drafts = await Effect.runPromise(store.list());

    assertEquals(
      drafts.map(({ id, title }) => ({ id, title })),
      [
        { id: newer.id, title: newer.title },
        { id: older.id, title: older.title },
      ],
    );
  } finally {
    database.close();
  }
});

Deno.test("draft store breaks ties by id ascending", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeDraftStore(database);
    const timestamp = utc("2026-02-01T00:00:00.000Z");

    await Effect.runPromise(
      store.createWithResolvedStateAndStack({
        id: "00000000-0000-4000-8000-000000000302",
        title: "Second",
        description: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );
    await Effect.runPromise(
      store.createWithResolvedStateAndStack({
        id: "00000000-0000-4000-8000-000000000301",
        title: "First",
        description: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );

    const drafts = await Effect.runPromise(store.list());

    assertEquals(
      drafts.map((draft) => draft.id),
      [
        "00000000-0000-4000-8000-000000000301",
        "00000000-0000-4000-8000-000000000302",
      ],
    );
  } finally {
    database.close();
  }
});

Deno.test("draft store createWithResolvedStateAndStack uses the default draft state", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeDraftStore(database);
    const created = await Effect.runPromise(
      store.createWithResolvedStateAndStack({
        id: "00000000-0000-4000-8000-000000000501",
        title: "Auth cleanup",
        description: "",
        createdAt: utc("2026-02-03T12:00:00.000Z"),
        updatedAt: utc("2026-02-03T12:00:00.000Z"),
      }),
    );

    assertEquals(created.stateId, defaultDraftStateId);
    assertEquals(created.stackId, null);
  } finally {
    database.close();
  }
});

Deno.test("draft store createWithResolvedStateAndStack rejects stack-scoped states", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeDraftStore(database);
    const result = await Effect.runPromise(
      Effect.either(
        store.createWithResolvedStateAndStack({
          id: "00000000-0000-4000-8000-000000000502",
          title: "Auth cleanup",
          description: "",
          stateId: defaultStackStateId,
          createdAt: utc("2026-02-03T12:00:00.000Z"),
          updatedAt: utc("2026-02-03T12:00:00.000Z"),
        }),
      ),
    );

    assertEquals(result._tag, "Left");
    if (result._tag === "Left") {
      assertEquals(result.left._tag, "InvalidStateScopeError");
    }
  } finally {
    database.close();
  }
});

Deno.test("draft store createWithResolvedStateAndStack assigns an existing stack", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const stackStore = makeStackStore(database);
    const draftStore = makeDraftStore(database);
    const stackId = "00000000-0000-4000-8000-000000000601";

    await Effect.runPromise(
      stackStore.createWithResolvedState({
        id: stackId,
        title: "Payments rewrite",
        description: "",
        createdAt: utc("2026-02-01T00:00:00.000Z"),
        updatedAt: utc("2026-02-01T00:00:00.000Z"),
      }),
    );

    const created = await Effect.runPromise(
      draftStore.createWithResolvedStateAndStack({
        id: "00000000-0000-4000-8000-000000000602",
        title: "Extract billing module",
        description: "",
        stackId,
        createdAt: utc("2026-02-02T00:00:00.000Z"),
        updatedAt: utc("2026-02-02T00:00:00.000Z"),
      }),
    );

    assertEquals(created.stackId, stackId);
  } finally {
    database.close();
  }
});

Deno.test("draft store createWithResolvedStateAndStack rejects a missing stack", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeDraftStore(database);
    const result = await Effect.runPromise(
      Effect.either(
        store.createWithResolvedStateAndStack({
          id: "00000000-0000-4000-8000-000000000603",
          title: "Extract billing module",
          description: "",
          stackId: "00000000-0000-4000-8000-00000000ffff",
          createdAt: utc("2026-02-02T00:00:00.000Z"),
          updatedAt: utc("2026-02-02T00:00:00.000Z"),
        }),
      ),
    );

    assertEquals(result._tag, "Left");
    if (result._tag === "Left") {
      assertEquals(result.left._tag, "StackNotFoundError");
    }
  } finally {
    database.close();
  }
});

Deno.test("draft store createWithResolvedStateAndStack skips stack lookup for null stackId", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeDraftStore(database);
    const created = await Effect.runPromise(
      store.createWithResolvedStateAndStack({
        id: "00000000-0000-4000-8000-000000000604",
        title: "Standalone draft",
        description: "",
        stackId: null,
        createdAt: utc("2026-02-02T00:00:00.000Z"),
        updatedAt: utc("2026-02-02T00:00:00.000Z"),
      }),
    );

    assertEquals(created.stackId, null);
  } finally {
    database.close();
  }
});

Deno.test("draft store returns null for a missing draft", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeDraftStore(database);
    const found = await Effect.runPromise(
      store.findById("00000000-0000-4000-8000-00000000ffff"),
    );

    assertEquals(found, null);
  } finally {
    database.close();
  }
});

Deno.test("draft store persists timestamps as ISO strings", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeDraftStore(database);
    const created = await Effect.runPromise(
      store.createWithResolvedStateAndStack({
        id: "00000000-0000-4000-8000-000000000701",
        title: "Auth cleanup",
        description: "Track the rollout.",
        createdAt: utc("2026-02-03T12:00:00.000Z"),
        updatedAt: utc("2026-02-03T12:00:00.000Z"),
      }),
    );

    assertEquals(
      utcDateTimeToIsoString(created.createdAt),
      "2026-02-03T12:00:00.000Z",
    );
    assertEquals(
      utcDateTimeToIsoString(created.updatedAt),
      "2026-02-03T12:00:00.000Z",
    );
    assertEquals(created.description, "Track the rollout.");
  } finally {
    database.close();
  }
});

Deno.test("draft store createWithResolvedStateAndStack rolls back when insert fails", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeDraftStore(database);
    const originalPrepare = database.prepare.bind(database);

    database.prepare = ((sql: string) => {
      const statement = originalPrepare(sql);

      if (!sql.includes("INSERT INTO drafts")) {
        return statement;
      }

      statement.run = (() => {
        throw new Error("Injected draft insert failure.");
      }) as typeof statement.run;

      return statement;
    }) as typeof database.prepare;

    const result = await Effect.runPromise(
      Effect.either(
        store.createWithResolvedStateAndStack({
          id: "00000000-0000-4000-8000-000000000503",
          title: "Auth cleanup",
          description: "",
          createdAt: utc("2026-02-03T12:00:00.000Z"),
          updatedAt: utc("2026-02-03T12:00:00.000Z"),
        }),
      ),
    );

    assertEquals(result._tag, "Left");
    assertEquals(await Effect.runPromise(store.list()), []);
  } finally {
    database.close();
  }
});
