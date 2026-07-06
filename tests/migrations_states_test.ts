import { assertEquals } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { migrate } from "../api/infrastructure/database/migrate.ts";

Deno.test("states migration seeds the starter catalog", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    await Effect.runPromise(migrate(database));

    const stackDefaults = database
      .prepare(
        "SELECT name FROM states WHERE scope = 'stack' AND is_default = 1",
      )
      .all() as Array<{ name: string }>;
    const draftDefaults = database
      .prepare(
        "SELECT name FROM states WHERE scope = 'draft' AND is_default = 1",
      )
      .all() as Array<{ name: string }>;

    assertEquals(stackDefaults, [{ name: "Planned" }]);
    assertEquals(draftDefaults, [{ name: "Backlog" }]);

    const stackNames = database
      .prepare(
        "SELECT name FROM states WHERE scope = 'stack' ORDER BY position ASC",
      )
      .all() as Array<{ name: string }>;
    const draftNames = database
      .prepare(
        "SELECT name FROM states WHERE scope = 'draft' ORDER BY position ASC",
      )
      .all() as Array<{ name: string }>;

    assertEquals(stackNames, [
      { name: "Planned" },
      { name: "Active" },
      { name: "Paused" },
      { name: "Completed" },
    ]);
    assertEquals(draftNames, [
      { name: "Backlog" },
      { name: "Todo" },
      { name: "In Progress" },
      { name: "Done" },
      { name: "Canceled" },
    ]);
  } finally {
    database.close();
  }
});
