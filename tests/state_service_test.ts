import { assertEquals } from "@std/assert";
import { Effect } from "effect";
import type { State, StateScope } from "../api/domain/state/state.ts";
import { makeStateService } from "../api/application/state-service.ts";

const stackStates: readonly State[] = [
  {
    id: "state-1",
    scope: "stack",
    name: "Planned",
    color: "#8d98a5",
    position: 0,
    isDefault: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const draftStates: readonly State[] = [
  {
    id: "state-2",
    scope: "draft",
    name: "Backlog",
    color: "#8d98a5",
    position: 0,
    isDefault: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const makeRepository = (
  statesByScope: Record<StateScope, readonly State[]>,
) => ({
  listByScope: (scope: StateScope) => Effect.succeed(statesByScope[scope]),
});

Deno.test("state service returns states for a valid scope", async () => {
  const service = makeStateService(
    makeRepository({ stack: stackStates, draft: draftStates }),
  );

  assertEquals(
    await Effect.runPromise(service.listByScope(["stack"])),
    stackStates,
  );
  assertEquals(
    await Effect.runPromise(service.listByScope(["draft"])),
    draftStates,
  );
});

Deno.test("state service rejects a missing scope query parameter", async () => {
  const service = makeStateService(
    makeRepository({ stack: stackStates, draft: draftStates }),
  );
  const result = await Effect.runPromise(
    Effect.either(service.listByScope([])),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left" && result.left._tag === "ValidationError") {
    assertEquals(
      result.left.fields.scope,
      "Exactly one scope query parameter is required.",
    );
  }
});

Deno.test("state service rejects multiple scope query parameters", async () => {
  const service = makeStateService(
    makeRepository({ stack: stackStates, draft: draftStates }),
  );
  const result = await Effect.runPromise(
    Effect.either(service.listByScope(["stack", "draft"])),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left" && result.left._tag === "ValidationError") {
    assertEquals(
      result.left.fields.scope,
      "Exactly one scope query parameter is required.",
    );
  }
});

Deno.test("state service rejects an invalid scope query parameter", async () => {
  const service = makeStateService(
    makeRepository({ stack: stackStates, draft: draftStates }),
  );
  const result = await Effect.runPromise(
    Effect.either(service.listByScope(["invalid"])),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left" && result.left._tag === "ValidationError") {
    assertEquals(result.left.fields.scope, "Scope must be stack or draft.");
  }
});

Deno.test("state service does not branch on seeded names or ids", async () => {
  const customStates: readonly State[] = [
    {
      id: "custom-id",
      scope: "stack",
      name: "Custom",
      color: "#112233",
      position: 0,
      isDefault: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  const service = makeStateService(
    makeRepository({ stack: customStates, draft: draftStates }),
  );

  assertEquals(
    await Effect.runPromise(service.listByScope(["stack"])),
    customStates,
  );
});
