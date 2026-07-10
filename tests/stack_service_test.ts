import { assertEquals } from "@std/assert";
import { Effect } from "effect";
import type { State, StateScope } from "../api/defs/state/state.ts";
import type { Stack } from "../api/defs/stack/stack.ts";
import {
  InvalidStateScopeError,
  StackNotFoundError,
  StateNotFoundError,
  UnknownStackStoreError,
} from "../api/core/errors.ts";
import { makeStackService } from "../api/core/stack/service-live.ts";
import type { UpdateStackRecord } from "../api/core/stack/input.ts";
import type { StackStoreApi } from "../api/core/stack/store.ts";
import { utcDateTimeFromIsoString } from "../api/lib/time/utc.ts";

const utc = utcDateTimeFromIsoString;

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
    createdAt: utc("2026-01-01T00:00:00.000Z"),
    updatedAt: utc("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    scope: "stack",
    name: "Active",
    color: "#8fa8ff",
    position: 1,
    isDefault: false,
    createdAt: utc("2026-01-01T00:00:00.000Z"),
    updatedAt: utc("2026-01-01T00:00:00.000Z"),
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
    createdAt: utc("2026-01-01T00:00:00.000Z"),
    updatedAt: utc("2026-01-01T00:00:00.000Z"),
  },
];

const makeStackStore = (
  stacks: Stack[],
  statesByScope: Record<StateScope, readonly State[]>,
  overrides: Partial<StackStoreApi> = {},
): StackStoreApi => ({
  list: overrides.list ??
    ((filter) =>
      Effect.gen(function* () {
        if (filter === undefined) {
          return [...stacks];
        }

        const state = [
          ...statesByScope.stack,
          ...statesByScope.draft,
        ].find((entry) => entry.id === filter.stateId);

        if (state === undefined) {
          return [];
        }

        if (state.scope !== "stack") {
          return yield* Effect.fail(
            new InvalidStateScopeError({ stateId: filter.stateId }),
          );
        }

        return stacks.filter((stack) => stack.stateId === filter.stateId);
      })),
  findById: overrides.findById ??
    ((stackId: string) =>
      Effect.succeed(stacks.find((stack) => stack.id === stackId) ?? null)),
  create: (stack: Stack) => {
    stacks.push(stack);
    return Effect.succeed(stack);
  },
  createWithResolvedState: overrides.createWithResolvedState ??
    ((record) =>
      Effect.gen(function* () {
        let stateId: string;

        if (record.stateId !== undefined) {
          const state = [
            ...statesByScope.stack,
            ...statesByScope.draft,
          ].find((entry) => entry.id === record.stateId);

          if (state === undefined) {
            return yield* Effect.fail(
              new StateNotFoundError({ stateId: record.stateId }),
            );
          }

          if (state.scope !== "stack") {
            return yield* Effect.fail(
              new InvalidStateScopeError({ stateId: record.stateId }),
            );
          }

          stateId = state.id;
        } else {
          const defaultState = statesByScope.stack.find((state) =>
            state.isDefault
          );

          if (defaultState === undefined) {
            return yield* Effect.fail(
              new UnknownStackStoreError({
                cause: new Error("No default stack State found."),
              }),
            );
          }

          stateId = defaultState.id;
        }

        const stack: Stack = {
          id: record.id,
          title: record.title,
          description: record.description,
          stateId,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };
        stacks.push(stack);

        return stack;
      })),
  updateWithResolvedState: overrides.updateWithResolvedState ??
    ((record: UpdateStackRecord) =>
      Effect.gen(function* () {
        const index = stacks.findIndex((stack) => stack.id === record.id);

        if (index === -1) {
          return yield* Effect.fail(
            new StackNotFoundError({ stackId: record.id }),
          );
        }

        let stateId = stacks[index]!.stateId;

        if (record.stateId !== undefined) {
          const state = [
            ...statesByScope.stack,
            ...statesByScope.draft,
          ].find((entry) => entry.id === record.stateId);

          if (state === undefined) {
            return yield* Effect.fail(
              new StateNotFoundError({ stateId: record.stateId }),
            );
          }

          if (state.scope !== "stack") {
            return yield* Effect.fail(
              new InvalidStateScopeError({ stateId: record.stateId }),
            );
          }

          stateId = state.id;
        }

        const updated: Stack = {
          id: record.id,
          title: record.title,
          description: record.description,
          stateId,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };
        stacks[index] = updated;

        return updated;
      })),
});

const makeService = (
  stacks: Stack[],
  statesByScope: Record<StateScope, readonly State[]>,
) =>
  makeStackService(makeStackStore(stacks, statesByScope), {
    generateId: () => fixedId,
    now: () => fixedNow,
  });

Deno.test("stack service creates a stack with only a title", async () => {
  const stacks: Stack[] = [];
  const service = makeService(stacks, {
    stack: stackStates,
    draft: draftStates,
  });
  const created = await Effect.runPromise(
    service.createStack({ title: "  Payments rewrite  " }),
  );

  assertEquals(created, {
    id: fixedId,
    title: "Payments rewrite",
    description: "",
    stateId: "00000000-0000-4000-8000-000000000011",
    createdAt: utc("2026-02-01T12:00:00.000Z"),
    updatedAt: utc("2026-02-01T12:00:00.000Z"),
  });
});

Deno.test("stack service creates a stack with an explicit stack state", async () => {
  const stacks: Stack[] = [];
  const service = makeService(stacks, {
    stack: stackStates,
    draft: draftStates,
  });
  const created = await Effect.runPromise(
    service.createStack({
      title: "Auth cleanup",
      description: "Track the rollout.",
      stateId: "00000000-0000-4000-8000-000000000012",
    }),
  );

  assertEquals(created.stateId, "00000000-0000-4000-8000-000000000012");
  assertEquals(created.description, "Track the rollout.");
});

Deno.test("stack service rejects draft-scoped state assignment", async () => {
  const stacks: Stack[] = [];
  const service = makeService(stacks, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(
      service.createStack({
        title: "Auth cleanup",
        stateId: "00000000-0000-4000-8000-000000000013",
      }),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "InvalidStateScopeError");
  }
});

Deno.test("stack service rejects a missing state id", async () => {
  const stacks: Stack[] = [];
  const service = makeService(stacks, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(
      service.createStack({
        title: "Auth cleanup",
        stateId: "00000000-0000-4000-8000-00000000ffff",
      }),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "StateNotFoundError");
  }
});

Deno.test("stack service uses the current default stack state", async () => {
  const stacks: Stack[] = [];
  const states: Record<StateScope, readonly State[]> = {
    stack: [
      {
        ...stackStates[0]!,
        isDefault: false,
      },
      {
        ...stackStates[1]!,
        isDefault: true,
      },
    ],
    draft: draftStates,
  };
  const service = makeService(stacks, states);
  const created = await Effect.runPromise(
    service.createStack({ title: "Auth cleanup" }),
  );

  assertEquals(created.stateId, "00000000-0000-4000-8000-000000000012");
});

Deno.test("stack service returns not found for a missing stack", async () => {
  const stacks: Stack[] = [];
  const service = makeService(stacks, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(
      service.getStack("00000000-0000-4000-8000-00000000ffff"),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left instanceof StackNotFoundError, true);
  }
});

Deno.test("stack service rejects malformed stack ids", async () => {
  const stacks: Stack[] = [];
  const service = makeService(stacks, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(service.getStack("not-a-uuid")),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "ValidationError");
  }
});

Deno.test("stack service lists stacks from the store", async () => {
  const stacks: Stack[] = [
    {
      id: "00000000-0000-4000-8000-000000000501",
      title: "Existing",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000011",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(stacks, {
    stack: stackStates,
    draft: draftStates,
  });
  const listed = await Effect.runPromise(service.listStacks());

  assertEquals(listed, stacks);
});

Deno.test("stack service delegates creation to the transactional store contract", async () => {
  const stacks: Stack[] = [];
  let delegated = false;
  const service = makeStackService(
    makeStackStore(stacks, { stack: stackStates, draft: draftStates }, {
      createWithResolvedState: (record) => {
        delegated = true;
        return Effect.succeed({
          ...record,
          stateId: "00000000-0000-4000-8000-000000000011",
        });
      },
    }),
    {
      generateId: () => fixedId,
      now: () => fixedNow,
    },
  );

  await Effect.runPromise(service.createStack({ title: "Auth cleanup" }));

  assertEquals(delegated, true);
  assertEquals(stacks.length, 0);
});

Deno.test("stack service updates a stack title", async () => {
  const stacks: Stack[] = [
    {
      id: "00000000-0000-4000-8000-000000000501",
      title: "Existing",
      description: "Track the rollout.",
      stateId: "00000000-0000-4000-8000-000000000011",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(stacks, {
    stack: stackStates,
    draft: draftStates,
  });
  const updated = await Effect.runPromise(
    service.updateStack("00000000-0000-4000-8000-000000000501", {
      title: "  Auth cleanup  ",
    }),
  );

  assertEquals(updated.title, "Auth cleanup");
  assertEquals(updated.description, "Track the rollout.");
  assertEquals(updated.updatedAt, utc("2026-02-01T12:00:00.000Z"));
});

Deno.test("stack service preserves updatedAt for unchanged updates", async () => {
  const stacks: Stack[] = [
    {
      id: "00000000-0000-4000-8000-000000000501",
      title: "Existing",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000011",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(stacks, {
    stack: stackStates,
    draft: draftStates,
  });
  const updated = await Effect.runPromise(
    service.updateStack("00000000-0000-4000-8000-000000000501", {
      title: "Existing",
      stateId: "00000000-0000-4000-8000-000000000011",
    }),
  );

  assertEquals(updated.updatedAt, utc("2026-02-01T12:00:00.000Z"));
});

Deno.test("stack service rejects an empty update body", async () => {
  const stacks: Stack[] = [];
  const service = makeService(stacks, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(
      service.updateStack("00000000-0000-4000-8000-000000000501", {}),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "ValidationError");
    if (result.left._tag === "ValidationError") {
      assertEquals(
        result.left.fields.body,
        "At least one field is required.",
      );
    }
  }
});

Deno.test("stack service rejects draft-scoped state reassignment", async () => {
  const stacks: Stack[] = [
    {
      id: "00000000-0000-4000-8000-000000000501",
      title: "Existing",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000011",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(stacks, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(
      service.updateStack("00000000-0000-4000-8000-000000000501", {
        stateId: "00000000-0000-4000-8000-000000000013",
      }),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "InvalidStateScopeError");
  }
});

Deno.test("stack service filters stacks by state id", async () => {
  const stacks: Stack[] = [
    {
      id: "00000000-0000-4000-8000-000000000501",
      title: "Planned stack",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000011",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
    {
      id: "00000000-0000-4000-8000-000000000502",
      title: "Active stack",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000012",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(stacks, {
    stack: stackStates,
    draft: draftStates,
  });
  const listed = await Effect.runPromise(
    service.listStacks({
      stateId: "00000000-0000-4000-8000-000000000012",
    }),
  );

  assertEquals(listed.map((stack) => stack.id), [
    "00000000-0000-4000-8000-000000000502",
  ]);
});

Deno.test("stack service returns an empty list for an absent filter state", async () => {
  const stacks: Stack[] = [
    {
      id: "00000000-0000-4000-8000-000000000501",
      title: "Existing",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000011",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(stacks, {
    stack: stackStates,
    draft: draftStates,
  });
  const listed = await Effect.runPromise(
    service.listStacks({
      stateId: "00000000-0000-4000-8000-00000000ffff",
    }),
  );

  assertEquals(listed, []);
});

Deno.test("stack service rejects draft-scoped state filters", async () => {
  const stacks: Stack[] = [];
  const service = makeService(stacks, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(
      service.listStacks({
        stateId: "00000000-0000-4000-8000-000000000013",
      }),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "InvalidStateScopeError");
  }
});
