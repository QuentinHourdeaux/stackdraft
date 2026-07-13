import { assertEquals } from "@std/assert";
import { Effect } from "effect";
import type { State, StateScope } from "../api/defs/state/state.ts";
import type { Draft } from "../api/defs/draft/draft.ts";
import type { Stack } from "../api/defs/stack/stack.ts";
import {
  DraftNotFoundError,
  InvalidStateScopeError,
  StackNotFoundError,
  StateNotFoundError,
  UnknownDraftStoreError,
} from "../api/core/errors.ts";
import { makeDraftService } from "../api/core/draft/service-live.ts";
import type { DraftStoreApi } from "../api/core/draft/store.ts";
import type { UpdateDraftRecord } from "../api/core/draft/input.ts";
import type { DraftServiceDependencies } from "../api/core/draft/service.ts";
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
  {
    id: "00000000-0000-4000-8000-000000000014",
    scope: "draft",
    name: "Todo",
    color: "#8fa8ff",
    position: 1,
    isDefault: false,
    createdAt: utc("2026-01-01T00:00:00.000Z"),
    updatedAt: utc("2026-01-01T00:00:00.000Z"),
  },
];

const stacks: Stack[] = [
  {
    id: "00000000-0000-4000-8000-000000000021",
    title: "Payments rewrite",
    description: "",
    stateId: "00000000-0000-4000-8000-000000000011",
    createdAt: utc("2026-01-01T00:00:00.000Z"),
    updatedAt: utc("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "00000000-0000-4000-8000-000000000022",
    title: "Platform migration",
    description: "",
    stateId: "00000000-0000-4000-8000-000000000011",
    createdAt: utc("2026-01-01T00:00:00.000Z"),
    updatedAt: utc("2026-01-01T00:00:00.000Z"),
  },
];

const makeDraftStore = (
  drafts: Draft[],
  statesByScope: Record<StateScope, readonly State[]>,
  knownStacks: readonly Stack[],
  overrides: Partial<DraftStoreApi> = {},
): DraftStoreApi => ({
  list: overrides.list ??
    ((filter) =>
      Effect.gen(function* () {
        if (filter === undefined) {
          return [...drafts];
        }

        if (filter.stateId !== undefined) {
          const state = [
            ...statesByScope.stack,
            ...statesByScope.draft,
          ].find((entry) => entry.id === filter.stateId);

          if (state === undefined) {
            return [];
          }

          if (state.scope !== "draft") {
            return yield* Effect.fail(
              new InvalidStateScopeError({ stateId: filter.stateId }),
            );
          }
        }

        if (filter.stackId !== undefined) {
          const stack = knownStacks.find((entry) =>
            entry.id === filter.stackId
          );

          if (stack === undefined) {
            return [];
          }
        }

        return drafts.filter((draft) => {
          if (
            filter.stateId !== undefined && draft.stateId !== filter.stateId
          ) {
            return false;
          }

          if (
            filter.stackId !== undefined && draft.stackId !== filter.stackId
          ) {
            return false;
          }

          return true;
        });
      })),
  findById: overrides.findById ??
    ((draftId: string) =>
      Effect.succeed(drafts.find((draft) => draft.id === draftId) ?? null)),
  createWithResolvedStateAndStack: overrides.createWithResolvedStateAndStack ??
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

          if (state.scope !== "draft") {
            return yield* Effect.fail(
              new InvalidStateScopeError({ stateId: record.stateId }),
            );
          }

          stateId = state.id;
        } else {
          const defaultState = statesByScope.draft.find((state) =>
            state.isDefault
          );

          if (defaultState === undefined) {
            return yield* Effect.fail(
              new UnknownDraftStoreError({
                cause: new Error("No default draft State found."),
              }),
            );
          }

          stateId = defaultState.id;
        }

        let stackId: string | null = null;

        if (record.stackId !== undefined && record.stackId !== null) {
          const stack = knownStacks.find((entry) =>
            entry.id === record.stackId
          );

          if (stack === undefined) {
            return yield* Effect.fail(
              new StackNotFoundError({ stackId: record.stackId }),
            );
          }

          stackId = stack.id;
        }

        const draft: Draft = {
          id: record.id,
          stackId,
          title: record.title,
          description: record.description,
          stateId,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };
        drafts.push(draft);

        return draft;
      })),
  updateWithResolvedStateAndStack: overrides.updateWithResolvedStateAndStack ??
    ((record: UpdateDraftRecord) =>
      Effect.gen(function* () {
        const index = drafts.findIndex((draft) => draft.id === record.id);

        if (index === -1) {
          return yield* Effect.fail(
            new DraftNotFoundError({ draftId: record.id }),
          );
        }

        let stateId = drafts[index]!.stateId;

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

          if (state.scope !== "draft") {
            return yield* Effect.fail(
              new InvalidStateScopeError({ stateId: record.stateId }),
            );
          }

          stateId = state.id;
        }

        let stackId = drafts[index]!.stackId;

        if (record.stackId !== undefined) {
          if (record.stackId === null) {
            stackId = null;
          } else {
            const stack = knownStacks.find((entry) =>
              entry.id === record.stackId
            );

            if (stack === undefined) {
              return yield* Effect.fail(
                new StackNotFoundError({ stackId: record.stackId }),
              );
            }

            stackId = stack.id;
          }
        }

        const updated: Draft = {
          id: record.id,
          stackId,
          title: record.title,
          description: record.description,
          stateId,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };
        drafts[index] = updated;

        return updated;
      })),
});

const makeService = (
  drafts: Draft[],
  statesByScope: Record<StateScope, readonly State[]>,
  knownStacks: readonly Stack[] = stacks,
  dependencies: Partial<DraftServiceDependencies> = {},
) =>
  makeDraftService(
    makeDraftStore(drafts, statesByScope, knownStacks),
    {
      generateId: () => fixedId,
      now: () => fixedNow,
      ...dependencies,
    },
  );

Deno.test("draft service creates a standalone draft with only a title", async () => {
  const drafts: Draft[] = [];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const created = await Effect.runPromise(
    service.createDraft({ title: "  Auth cleanup  " }),
  );

  assertEquals(created, {
    id: fixedId,
    stackId: null,
    title: "Auth cleanup",
    description: "",
    stateId: "00000000-0000-4000-8000-000000000013",
    createdAt: utc("2026-02-01T12:00:00.000Z"),
    updatedAt: utc("2026-02-01T12:00:00.000Z"),
  });
});

Deno.test("draft service creates a draft with an explicit draft state", async () => {
  const drafts: Draft[] = [];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const created = await Effect.runPromise(
    service.createDraft({
      title: "Auth cleanup",
      description: "Track the rollout.",
      stateId: "00000000-0000-4000-8000-000000000014",
    }),
  );

  assertEquals(created.stateId, "00000000-0000-4000-8000-000000000014");
  assertEquals(created.description, "Track the rollout.");
  assertEquals(created.stackId, null);
});

Deno.test("draft service creates a draft assigned to an existing stack", async () => {
  const drafts: Draft[] = [];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const created = await Effect.runPromise(
    service.createDraft({
      title: "Extract billing module",
      stackId: "00000000-0000-4000-8000-000000000021",
    }),
  );

  assertEquals(created.stackId, "00000000-0000-4000-8000-000000000021");
});

Deno.test("draft service rejects stack-scoped state assignment", async () => {
  const drafts: Draft[] = [];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(
      service.createDraft({
        title: "Auth cleanup",
        stateId: "00000000-0000-4000-8000-000000000011",
      }),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "InvalidStateScopeError");
  }
});

Deno.test("draft service rejects a missing stack id", async () => {
  const drafts: Draft[] = [];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(
      service.createDraft({
        title: "Auth cleanup",
        stackId: "00000000-0000-4000-8000-00000000ffff",
      }),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "StackNotFoundError");
  }
});

Deno.test("draft service rejects a missing state id", async () => {
  const drafts: Draft[] = [];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(
      service.createDraft({
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

Deno.test("draft service returns draft not found", async () => {
  const drafts: Draft[] = [];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(
      service.getDraft("00000000-0000-4000-8000-00000000ffff"),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left instanceof DraftNotFoundError, true);
  }
});

Deno.test("draft service lists drafts", async () => {
  const drafts: Draft[] = [
    {
      id: "00000000-0000-4000-8000-000000000031",
      stackId: null,
      title: "Auth cleanup",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000013",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const listed = await Effect.runPromise(service.listDrafts());

  assertEquals(listed, drafts);
});

Deno.test("draft service rejects malformed draft ids", async () => {
  const drafts: Draft[] = [];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(service.getDraft("not-a-uuid")),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "ValidationError");
  }
});

Deno.test("draft service updates a draft title", async () => {
  const drafts: Draft[] = [
    {
      id: "00000000-0000-4000-8000-000000000031",
      stackId: null,
      title: "Existing",
      description: "Track the rollout.",
      stateId: "00000000-0000-4000-8000-000000000013",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const updated = await Effect.runPromise(
    service.updateDraft("00000000-0000-4000-8000-000000000031", {
      title: "  Auth cleanup  ",
    }),
  );

  assertEquals(updated.title, "Auth cleanup");
  assertEquals(updated.description, "Track the rollout.");
  assertEquals(updated.updatedAt, utc("2026-02-01T12:00:00.000Z"));
});

Deno.test("draft service preserves updatedAt for unchanged updates", async () => {
  const storedUpdatedAt = utc("2026-01-15T08:00:00.000Z");
  const updateClock = new Date("2026-02-01T12:00:00.000Z");
  const drafts: Draft[] = [
    {
      id: "00000000-0000-4000-8000-000000000031",
      stackId: null,
      title: "Existing",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000013",
      createdAt: utc("2026-01-01T00:00:00.000Z"),
      updatedAt: storedUpdatedAt,
    },
  ];
  const service = makeService(
    drafts,
    {
      stack: stackStates,
      draft: draftStates,
    },
    stacks,
    {
      now: () => updateClock,
    },
  );

  const unchanged = await Effect.runPromise(
    service.updateDraft("00000000-0000-4000-8000-000000000031", {
      title: "Existing",
      stateId: "00000000-0000-4000-8000-000000000013",
      stackId: null,
    }),
  );

  assertEquals(unchanged.updatedAt, storedUpdatedAt);

  const changed = await Effect.runPromise(
    service.updateDraft("00000000-0000-4000-8000-000000000031", {
      title: "Auth cleanup",
    }),
  );

  assertEquals(changed.title, "Auth cleanup");
  assertEquals(changed.updatedAt, utc("2026-02-01T12:00:00.000Z"));
});

Deno.test("draft service rejects an empty update body", async () => {
  const drafts: Draft[] = [];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(
      service.updateDraft("00000000-0000-4000-8000-000000000031", {}),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "ValidationError");
  }
});

Deno.test("draft service assigns a draft to an existing stack", async () => {
  const drafts: Draft[] = [
    {
      id: "00000000-0000-4000-8000-000000000031",
      stackId: null,
      title: "Existing",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000013",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const updated = await Effect.runPromise(
    service.updateDraft("00000000-0000-4000-8000-000000000031", {
      stackId: "00000000-0000-4000-8000-000000000021",
    }),
  );

  assertEquals(updated.stackId, "00000000-0000-4000-8000-000000000021");
});

Deno.test("draft service moves a draft from one stack to another", async () => {
  const drafts: Draft[] = [
    {
      id: "00000000-0000-4000-8000-000000000031",
      stackId: "00000000-0000-4000-8000-000000000021",
      title: "Existing",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000013",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });

  const listedOnFirstStack = await Effect.runPromise(
    service.listDrafts({
      stackId: "00000000-0000-4000-8000-000000000021",
    }),
  );
  assertEquals(listedOnFirstStack.map((draft) => draft.id), [
    "00000000-0000-4000-8000-000000000031",
  ]);
  assertEquals(
    await Effect.runPromise(
      service.listDrafts({
        stackId: "00000000-0000-4000-8000-000000000022",
      }),
    ),
    [],
  );

  const moved = await Effect.runPromise(
    service.updateDraft("00000000-0000-4000-8000-000000000031", {
      stackId: "00000000-0000-4000-8000-000000000022",
    }),
  );

  assertEquals(moved.stackId, "00000000-0000-4000-8000-000000000022");

  const listedOnSecondStack = await Effect.runPromise(
    service.listDrafts({
      stackId: "00000000-0000-4000-8000-000000000022",
    }),
  );
  assertEquals(listedOnSecondStack.map((draft) => draft.id), [
    "00000000-0000-4000-8000-000000000031",
  ]);
  assertEquals(
    await Effect.runPromise(
      service.listDrafts({
        stackId: "00000000-0000-4000-8000-000000000021",
      }),
    ),
    [],
  );
});

Deno.test("draft service returns a draft to standalone with null stackId", async () => {
  const drafts: Draft[] = [
    {
      id: "00000000-0000-4000-8000-000000000031",
      stackId: "00000000-0000-4000-8000-000000000021",
      title: "Existing",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000013",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const updated = await Effect.runPromise(
    service.updateDraft("00000000-0000-4000-8000-000000000031", {
      stackId: null,
    }),
  );

  assertEquals(updated.stackId, null);
});

Deno.test("draft service rejects a missing stack on update", async () => {
  const drafts: Draft[] = [
    {
      id: "00000000-0000-4000-8000-000000000031",
      stackId: null,
      title: "Existing",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000013",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(
      service.updateDraft("00000000-0000-4000-8000-000000000031", {
        stackId: "00000000-0000-4000-8000-00000000ffff",
      }),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "StackNotFoundError");
  }
  assertEquals(drafts[0]?.stackId, null);
});

Deno.test("draft service rejects stack-scoped state reassignment on update", async () => {
  const drafts: Draft[] = [
    {
      id: "00000000-0000-4000-8000-000000000031",
      stackId: null,
      title: "Existing",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000013",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(
      service.updateDraft("00000000-0000-4000-8000-000000000031", {
        stateId: "00000000-0000-4000-8000-000000000011",
      }),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "InvalidStateScopeError");
  }
});

Deno.test("draft service filters drafts by state id", async () => {
  const drafts: Draft[] = [
    {
      id: "00000000-0000-4000-8000-000000000031",
      stackId: null,
      title: "Backlog draft",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000013",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
    {
      id: "00000000-0000-4000-8000-000000000032",
      stackId: null,
      title: "Todo draft",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000014",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const listed = await Effect.runPromise(
    service.listDrafts({
      stateId: "00000000-0000-4000-8000-000000000014",
    }),
  );

  assertEquals(listed.map((draft) => draft.id), [
    "00000000-0000-4000-8000-000000000032",
  ]);
});

Deno.test("draft service filters drafts by stack id", async () => {
  const drafts: Draft[] = [
    {
      id: "00000000-0000-4000-8000-000000000031",
      stackId: "00000000-0000-4000-8000-000000000021",
      title: "Stacked draft",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000013",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
    {
      id: "00000000-0000-4000-8000-000000000032",
      stackId: null,
      title: "Standalone draft",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000013",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const listed = await Effect.runPromise(
    service.listDrafts({
      stackId: "00000000-0000-4000-8000-000000000021",
    }),
  );

  assertEquals(listed.map((draft) => draft.id), [
    "00000000-0000-4000-8000-000000000031",
  ]);
});

Deno.test("draft service composes state and stack filters with AND semantics", async () => {
  const drafts: Draft[] = [
    {
      id: "00000000-0000-4000-8000-000000000031",
      stackId: "00000000-0000-4000-8000-000000000021",
      title: "Matching draft",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000014",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
    {
      id: "00000000-0000-4000-8000-000000000032",
      stackId: "00000000-0000-4000-8000-000000000021",
      title: "Wrong state",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000013",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const listed = await Effect.runPromise(
    service.listDrafts({
      stateId: "00000000-0000-4000-8000-000000000014",
      stackId: "00000000-0000-4000-8000-000000000021",
    }),
  );

  assertEquals(listed.map((draft) => draft.id), [
    "00000000-0000-4000-8000-000000000031",
  ]);
});

Deno.test("draft service returns an empty list for an absent filter state", async () => {
  const drafts: Draft[] = [
    {
      id: "00000000-0000-4000-8000-000000000031",
      stackId: null,
      title: "Existing",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000013",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const listed = await Effect.runPromise(
    service.listDrafts({
      stateId: "00000000-0000-4000-8000-00000000ffff",
    }),
  );

  assertEquals(listed, []);
});

Deno.test("draft service returns an empty list for an absent filter stack", async () => {
  const drafts: Draft[] = [
    {
      id: "00000000-0000-4000-8000-000000000031",
      stackId: null,
      title: "Existing",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000013",
      createdAt: utc("2026-02-01T12:00:00.000Z"),
      updatedAt: utc("2026-02-01T12:00:00.000Z"),
    },
  ];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const listed = await Effect.runPromise(
    service.listDrafts({
      stackId: "00000000-0000-4000-8000-00000000ffff",
    }),
  );

  assertEquals(listed, []);
});

Deno.test("draft service rejects stack-scoped state filters", async () => {
  const drafts: Draft[] = [];
  const service = makeService(drafts, {
    stack: stackStates,
    draft: draftStates,
  });
  const result = await Effect.runPromise(
    Effect.either(
      service.listDrafts({
        stateId: "00000000-0000-4000-8000-000000000011",
      }),
    ),
  );

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "InvalidStateScopeError");
  }
});
