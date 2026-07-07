import { assertEquals } from "@std/assert";
import { Effect } from "effect";
import type { State, StateScope } from "../api/domain/state/state.ts";
import {
  StateNameConflictError,
  StateNotFoundError,
} from "../api/application/state-repository.ts";
import { makeStateService } from "../api/application/state-service.ts";

const fixedNow = new Date("2026-02-01T12:00:00.000Z");
const fixedId = "00000000-0000-4000-8000-00000000aa01";

const stackStates: readonly State[] = [
  {
    id: "00000000-0000-4000-8000-000000000011",
    scope: "stack",
    name: "Planned",
    color: "#8d98a5",
    position: 0,
    isDefault: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    scope: "stack",
    name: "Active",
    color: "#8fa8ff",
    position: 1,
    isDefault: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const draftStates: readonly State[] = [
  {
    id: "00000000-0000-4000-8000-000000000013",
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
  overrides: Partial<{
    create: (state: State) => Effect.Effect<State, StateNameConflictError>;
    update: (
      state: State,
    ) => Effect.Effect<State, StateNotFoundError | StateNameConflictError>;
    findById: (stateId: string) => Effect.Effect<State | null>;
  }> = {},
) => ({
  listByScope: (scope: StateScope) => Effect.succeed(statesByScope[scope]),
  findById: overrides.findById ??
    ((stateId: string) =>
      Effect.succeed(
        [...statesByScope.stack, ...statesByScope.draft].find((state) =>
          state.id === stateId
        ) ?? null,
      )),
  maxPositionInScope: (scope: StateScope) => {
    const states = statesByScope[scope];
    const maxPosition = states.reduce(
      (currentMax, state) => Math.max(currentMax, state.position),
      -1,
    );

    return Effect.succeed(maxPosition);
  },
  create: overrides.create ??
    ((state: State) => {
      statesByScope[state.scope] = [...statesByScope[state.scope], state];
      return Effect.succeed(state);
    }),
  update: overrides.update ??
    ((state: State) => {
      const scopeStates = statesByScope[state.scope];
      const index = scopeStates.findIndex((entry) => entry.id === state.id);

      if (index === -1) {
        return Effect.fail(new StateNotFoundError({ stateId: state.id }));
      }

      const updatedScopeStates = [...scopeStates];
      updatedScopeStates[index] = state;
      statesByScope[state.scope] = updatedScopeStates;

      return Effect.succeed(state);
    }),
});

const makeService = (
  statesByScope: Record<StateScope, readonly State[]>,
  overrides?: Parameters<typeof makeRepository>[1],
) =>
  makeStateService(makeRepository(statesByScope, overrides), {
    generateId: () => fixedId,
    now: () => fixedNow,
  });

Deno.test("state service returns states for a valid scope", async () => {
  const service = makeService({ stack: stackStates, draft: draftStates });

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
  const service = makeService({ stack: stackStates, draft: draftStates });
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
  const service = makeService({ stack: stackStates, draft: draftStates });
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
  const service = makeService({ stack: stackStates, draft: draftStates });
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
  const service = makeService({ stack: customStates, draft: draftStates });

  assertEquals(
    await Effect.runPromise(service.listByScope(["stack"])),
    customStates,
  );
});

Deno.test("state service creates a state at the next position", async () => {
  const statesByScope = {
    stack: [...stackStates],
    draft: [...draftStates],
  };
  const service = makeService(statesByScope);

  const created = await Effect.runPromise(
    service.createState({
      scope: "stack",
      name: "  Review  ",
      color: "#AABBCC",
    }),
  );

  assertEquals(created, {
    id: fixedId,
    scope: "stack",
    name: "Review",
    color: "#aabbcc",
    position: 2,
    isDefault: false,
    createdAt: fixedNow.toISOString(),
    updatedAt: fixedNow.toISOString(),
  });
});

Deno.test("state service rejects invalid create input", async () => {
  const service = makeService({ stack: stackStates, draft: draftStates });

  const emptyName = await Effect.runPromise(
    Effect.either(
      service.createState({ scope: "stack", name: "   ", color: "#112233" }),
    ),
  );
  const invalidColor = await Effect.runPromise(
    Effect.either(
      service.createState({ scope: "stack", name: "Review", color: "red" }),
    ),
  );
  const longName = await Effect.runPromise(
    Effect.either(
      service.createState({
        scope: "stack",
        name: "a".repeat(41),
        color: "#112233",
      }),
    ),
  );
  const invalidScope = await Effect.runPromise(
    Effect.either(
      service.createState({
        scope: "invalid",
        name: "Review",
        color: "#112233",
      }),
    ),
  );

  assertEquals(emptyName._tag, "Left");
  assertEquals(invalidColor._tag, "Left");
  assertEquals(longName._tag, "Left");
  assertEquals(invalidScope._tag, "Left");
  if (
    invalidScope._tag === "Left" && invalidScope.left._tag === "ValidationError"
  ) {
    assertEquals(
      invalidScope.left.fields.scope,
      "Scope must be stack or draft.",
    );
  }
});

Deno.test("state service rejects duplicate names within a scope", async () => {
  const service = makeService(
    { stack: stackStates, draft: draftStates },
    {
      create: () =>
        Effect.fail(
          new StateNameConflictError({ scope: "stack", name: "planned" }),
        ),
    },
  );

  const result = await Effect.runPromise(
    Effect.either(
      service.createState({
        scope: "stack",
        name: "planned",
        color: "#112233",
      }),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "StateNameConflictError");
  }
});

Deno.test("state service updates a state's name and color", async () => {
  const statesByScope = {
    stack: [...stackStates],
    draft: [...draftStates],
  };
  const service = makeService(statesByScope);

  const updated = await Effect.runPromise(
    service.updateState("00000000-0000-4000-8000-000000000011", {
      name: "  Scheduled  ",
      color: "#CCBBAA",
    }),
  );

  assertEquals(updated.name, "Scheduled");
  assertEquals(updated.color, "#ccbbaa");
  assertEquals(updated.updatedAt, fixedNow.toISOString());
  assertEquals(updated.position, 0);
  assertEquals(updated.isDefault, true);
});

Deno.test("state service rejects an empty update body", async () => {
  const service = makeService({ stack: stackStates, draft: draftStates });
  const result = await Effect.runPromise(
    Effect.either(
      service.updateState("00000000-0000-4000-8000-000000000011", {}),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left" && result.left._tag === "ValidationError") {
    assertEquals(
      result.left.fields.body,
      "At least one field is required.",
    );
  }
});

Deno.test("state service rejects an invalid state id", async () => {
  const service = makeService({ stack: stackStates, draft: draftStates });
  const result = await Effect.runPromise(
    Effect.either(service.updateState("not-a-uuid", { name: "Review" })),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left" && result.left._tag === "ValidationError") {
    assertEquals(
      result.left.fields.stateId,
      "State ID must be a valid UUID.",
    );
  }
});

Deno.test("state service returns not found for a missing state", async () => {
  const service = makeService({ stack: stackStates, draft: draftStates });
  const result = await Effect.runPromise(
    Effect.either(
      service.updateState(
        "00000000-0000-4000-8000-000000000099",
        { name: "Missing" },
      ),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "StateNotFoundError");
  }
});

Deno.test("state service rejects duplicate names on update", async () => {
  const service = makeService(
    { stack: stackStates, draft: draftStates },
    {
      update: () =>
        Effect.fail(
          new StateNameConflictError({ scope: "stack", name: "Active" }),
        ),
    },
  );

  const result = await Effect.runPromise(
    Effect.either(
      service.updateState("00000000-0000-4000-8000-000000000011", {
        name: "Active",
      }),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "StateNameConflictError");
  }
});
