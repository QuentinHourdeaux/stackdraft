import { assertEquals } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { migrate } from "../api/infrastructure/database/migrate.ts";
import { makeStackStore } from "../api/infrastructure/database/stack-store.ts";
import {
  utcDateTimeFromIsoString,
  utcDateTimeToIsoString,
} from "../api/lib/time/utc.ts";

const utc = utcDateTimeFromIsoString;

const defaultStackStateId = "00000000-0000-4000-8000-000000000001";

Deno.test("stack store returns stacks in created_at desc order", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStackStore(database);

    const older = {
      id: "00000000-0000-4000-8000-000000000201",
      title: "Older",
      description: "",
      stateId: defaultStackStateId,
      createdAt: utc("2026-01-01T00:00:00.000Z"),
      updatedAt: utc("2026-01-01T00:00:00.000Z"),
    };
    const newer = {
      id: "00000000-0000-4000-8000-000000000202",
      title: "Newer",
      description: "",
      stateId: defaultStackStateId,
      createdAt: utc("2026-02-01T00:00:00.000Z"),
      updatedAt: utc("2026-02-01T00:00:00.000Z"),
    };

    await Effect.runPromise(store.create(older));
    await Effect.runPromise(store.create(newer));

    const stacks = await Effect.runPromise(store.list());

    assertEquals(
      stacks.map(({ id, title }) => ({ id, title })),
      [
        { id: newer.id, title: newer.title },
        { id: older.id, title: older.title },
      ],
    );
  } finally {
    database.close();
  }
});

Deno.test("stack store breaks ties by id ascending", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStackStore(database);
    const timestamp = utc("2026-02-01T00:00:00.000Z");

    const first = {
      id: "00000000-0000-4000-8000-000000000301",
      title: "First",
      description: "",
      stateId: defaultStackStateId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const second = {
      id: "00000000-0000-4000-8000-000000000302",
      title: "Second",
      description: "",
      stateId: defaultStackStateId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await Effect.runPromise(store.create(second));
    await Effect.runPromise(store.create(first));

    const stacks = await Effect.runPromise(store.list());

    assertEquals(
      stacks.map((stack) => stack.id),
      [first.id, second.id],
    );
  } finally {
    database.close();
  }
});

Deno.test("stack store creates and reads stacks with timestamps", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStackStore(database);
    const stack = {
      id: "00000000-0000-4000-8000-000000000401",
      title: "Payments rewrite",
      description: "Track the migration plan.",
      stateId: defaultStackStateId,
      createdAt: utc("2026-02-03T12:00:00.000Z"),
      updatedAt: utc("2026-02-03T12:00:00.000Z"),
    };

    const created = await Effect.runPromise(store.create(stack));
    const found = await Effect.runPromise(store.findById(stack.id));

    assertEquals(created, stack);
    assertEquals(found, stack);
    assertEquals(
      utcDateTimeToIsoString(created.createdAt),
      "2026-02-03T12:00:00.000Z",
    );
    assertEquals(
      utcDateTimeToIsoString(created.updatedAt),
      "2026-02-03T12:00:00.000Z",
    );
  } finally {
    database.close();
  }
});

Deno.test("stack store returns null for a missing stack", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStackStore(database);
    const found = await Effect.runPromise(
      store.findById("00000000-0000-4000-8000-00000000ffff"),
    );

    assertEquals(found, null);
  } finally {
    database.close();
  }
});

Deno.test("stack store createWithResolvedState uses the default stack state", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStackStore(database);
    const created = await Effect.runPromise(
      store.createWithResolvedState({
        id: "00000000-0000-4000-8000-000000000501",
        title: "Payments rewrite",
        description: "",
        createdAt: utc("2026-02-03T12:00:00.000Z"),
        updatedAt: utc("2026-02-03T12:00:00.000Z"),
      }),
    );

    assertEquals(created.stateId, defaultStackStateId);
  } finally {
    database.close();
  }
});

Deno.test("stack store createWithResolvedState rejects draft-scoped states", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStackStore(database);
    const result = await Effect.runPromise(
      Effect.either(
        store.createWithResolvedState({
          id: "00000000-0000-4000-8000-000000000502",
          title: "Payments rewrite",
          description: "",
          stateId: "00000000-0000-4000-8000-000000000005",
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

Deno.test("stack store createWithResolvedState rolls back when insert fails", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStackStore(database);
    const originalPrepare = database.prepare.bind(database);

    database.prepare = ((sql: string) => {
      const statement = originalPrepare(sql);

      if (!sql.includes("INSERT INTO stacks")) {
        return statement;
      }

      statement.run = (() => {
        throw new Error("Injected stack insert failure.");
      }) as typeof statement.run;

      return statement;
    }) as typeof database.prepare;

    const result = await Effect.runPromise(
      Effect.either(
        store.createWithResolvedState({
          id: "00000000-0000-4000-8000-000000000503",
          title: "Payments rewrite",
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

Deno.test("stack store createWithResolvedState rolls back when the state disappears before insert", async () => {
  const database = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
  });

  try {
    await Effect.runPromise(migrate(database));
    const store = makeStackStore(database);
    const referencedStateId = "00000000-0000-4000-8000-000000000002";
    const originalPrepare = database.prepare.bind(database);

    database.prepare = ((sql: string) => {
      const statement = originalPrepare(sql);

      if (!sql.includes("INSERT INTO stacks")) {
        return statement;
      }

      const originalRun = statement.run.bind(statement);

      statement.run = ((...args: Parameters<typeof statement.run>) => {
        originalPrepare("DELETE FROM states WHERE id = ?").run(
          referencedStateId,
        );
        return originalRun(...args);
      }) as typeof statement.run;

      return statement;
    }) as typeof database.prepare;

    const result = await Effect.runPromise(
      Effect.either(
        store.createWithResolvedState({
          id: "00000000-0000-4000-8000-000000000504",
          title: "Payments rewrite",
          description: "",
          stateId: referencedStateId,
          createdAt: utc("2026-02-03T12:00:00.000Z"),
          updatedAt: utc("2026-02-03T12:00:00.000Z"),
        }),
      ),
    );

    assertEquals(result._tag, "Left");
    assertEquals(await Effect.runPromise(store.list()), []);

    const state = database
      .prepare("SELECT id FROM states WHERE id = ?")
      .get(referencedStateId);
    assertEquals(state, { id: referencedStateId });
  } finally {
    database.close();
  }
});
