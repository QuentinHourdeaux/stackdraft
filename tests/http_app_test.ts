import { assertEquals, assertExists } from "@std/assert";
import type { State } from "../api/defs/state/state.ts";
import type { Stack } from "../api/defs/stack/stack.ts";
import type { Draft } from "../api/defs/draft/draft.ts";
import {
  DraftNotFoundError,
  InvalidStateScopeError,
  LastStateInScopeError,
  StackNotFoundError,
  StateInUseError,
  StateIsDefaultError,
  StateNameConflictError,
  StateNotFoundError,
  UnknownDraftStoreError,
  UnknownStackStoreError,
  UnknownStateStoreError,
  ValidationError,
} from "../api/core/errors.ts";
import type { CreateStateInput } from "../api/core/state/input.ts";
import type { CreateStackInput } from "../api/core/stack/input.ts";
import type { CreateDraftInput } from "../api/core/draft/input.ts";
import { createApp } from "../api/infrastructure/http/app.ts";
import { noopLogger } from "../api/lib/logging/logger.ts";
import { utcDateTimeFromIsoString } from "../api/lib/time/utc.ts";

const utc = utcDateTimeFromIsoString;

const sampleStackState: State = {
  id: "00000000-0000-4000-8000-000000000001",
  scope: "stack",
  name: "Planned",
  color: "#8d98a5",
  position: 0,
  isDefault: true,
  createdAt: utc("2026-01-01T00:00:00.000Z"),
  updatedAt: utc("2026-01-01T00:00:00.000Z"),
};

const createdStackState: State = {
  id: "00000000-0000-4000-8000-00000000aa01",
  scope: "stack",
  name: "Review",
  color: "#aabbcc",
  position: 4,
  isDefault: false,
  createdAt: utc("2026-02-01T12:00:00.000Z"),
  updatedAt: utc("2026-02-01T12:00:00.000Z"),
};

const sampleStackStateResponse = {
  id: "00000000-0000-4000-8000-000000000001",
  scope: "stack",
  name: "Planned",
  color: "#8d98a5",
  position: 0,
  isDefault: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const createdStackStateResponse = {
  id: "00000000-0000-4000-8000-00000000aa01",
  scope: "stack",
  name: "Review",
  color: "#aabbcc",
  position: 4,
  isDefault: false,
  createdAt: "2026-02-01T12:00:00.000Z",
  updatedAt: "2026-02-01T12:00:00.000Z",
};

const sampleStack: Stack = {
  id: "00000000-0000-4000-8000-000000000101",
  title: "Payments rewrite",
  description: "",
  stateId: "00000000-0000-4000-8000-000000000001",
  createdAt: utc("2026-02-01T12:00:00.000Z"),
  updatedAt: utc("2026-02-01T12:00:00.000Z"),
};

const createdStack: Stack = {
  id: "00000000-0000-4000-8000-00000000bb01",
  title: "Auth cleanup",
  description: "Track the rollout.",
  stateId: "00000000-0000-4000-8000-000000000002",
  createdAt: utc("2026-02-03T12:00:00.000Z"),
  updatedAt: utc("2026-02-03T12:00:00.000Z"),
};

const sampleStackResponse = {
  id: "00000000-0000-4000-8000-000000000101",
  title: "Payments rewrite",
  description: "",
  stateId: "00000000-0000-4000-8000-000000000001",
  createdAt: "2026-02-01T12:00:00.000Z",
  updatedAt: "2026-02-01T12:00:00.000Z",
};

const createdStackResponse = {
  id: "00000000-0000-4000-8000-00000000bb01",
  title: "Auth cleanup",
  description: "Track the rollout.",
  stateId: "00000000-0000-4000-8000-000000000002",
  createdAt: "2026-02-03T12:00:00.000Z",
  updatedAt: "2026-02-03T12:00:00.000Z",
};

const sampleDraft: Draft = {
  id: "00000000-0000-4000-8000-000000000201",
  stackId: null,
  title: "Auth cleanup",
  description: "",
  stateId: "00000000-0000-4000-8000-000000000005",
  createdAt: utc("2026-02-01T12:00:00.000Z"),
  updatedAt: utc("2026-02-01T12:00:00.000Z"),
};

const createdDraft: Draft = {
  id: "00000000-0000-4000-8000-00000000cc01",
  stackId: "00000000-0000-4000-8000-000000000101",
  title: "Extract billing module",
  description: "Track the extraction.",
  stateId: "00000000-0000-4000-8000-000000000006",
  createdAt: utc("2026-02-03T12:00:00.000Z"),
  updatedAt: utc("2026-02-03T12:00:00.000Z"),
};

const sampleDraftResponse = {
  id: "00000000-0000-4000-8000-000000000201",
  stackId: null,
  title: "Auth cleanup",
  description: "",
  stateId: "00000000-0000-4000-8000-000000000005",
  createdAt: "2026-02-01T12:00:00.000Z",
  updatedAt: "2026-02-01T12:00:00.000Z",
};

const createdDraftResponse = {
  id: "00000000-0000-4000-8000-00000000cc01",
  stackId: "00000000-0000-4000-8000-000000000101",
  title: "Extract billing module",
  description: "Track the extraction.",
  stateId: "00000000-0000-4000-8000-000000000006",
  createdAt: "2026-02-03T12:00:00.000Z",
  updatedAt: "2026-02-03T12:00:00.000Z",
};

const createTestApp = (
  overrides: Partial<{
    checkHealth: () => Promise<{ status: "ok"; database: "ok" }>;
    listStates: (scope: string) => Promise<readonly State[]>;
    createState: (input: CreateStateInput) => Promise<State>;
    updateState: (
      stateId: string,
      input: { name?: string; color?: string },
    ) => Promise<State>;
    moveState: (
      stateId: string,
      input: { position: number },
    ) => Promise<readonly State[]>;
    selectDefaultState: (stateId: string) => Promise<State>;
    deleteState: (stateId: string) => Promise<void>;
    listStacks: (filter?: { stateId: string }) => Promise<readonly Stack[]>;
    getStack: (stackId: string) => Promise<Stack>;
    createStack: (input: CreateStackInput) => Promise<Stack>;
    updateStack: (
      stackId: string,
      input: { title?: string; description?: string; stateId?: string },
    ) => Promise<Stack>;
    listDrafts: (
      filter?: { stateId?: string; stackId?: string },
    ) => Promise<readonly Draft[]>;
    getDraft: (draftId: string) => Promise<Draft>;
    createDraft: (input: CreateDraftInput) => Promise<Draft>;
    updateDraft: (
      draftId: string,
      input: {
        title?: string;
        description?: string;
        stateId?: string;
        stackId?: string | null;
      },
    ) => Promise<Draft>;
  }> = {},
) =>
  createApp({
    logger: noopLogger,
    checkHealth: () =>
      Promise.resolve({ status: "ok", database: "ok" } as const),
    listStates: () => Promise.resolve([sampleStackState]),
    createState: () => Promise.resolve(createdStackState),
    updateState: () => Promise.resolve(createdStackState),
    moveState: () => Promise.resolve([sampleStackState]),
    selectDefaultState: () => Promise.resolve(sampleStackState),
    deleteState: () => Promise.resolve(),
    listStacks: () => Promise.resolve([sampleStack]),
    getStack: () => Promise.resolve(sampleStack),
    createStack: () => Promise.resolve(createdStack),
    updateStack: () => Promise.resolve(sampleStack),
    listDrafts: () => Promise.resolve([sampleDraft]),
    getDraft: () => Promise.resolve(sampleDraft),
    createDraft: () => Promise.resolve(createdDraft),
    updateDraft: () => Promise.resolve(sampleDraft),
    frontendDistPath: "./dist",
    ...overrides,
  });

Deno.test("health endpoint returns 200 when dependencies are ready", async () => {
  const app = createTestApp();

  const response = await app.handle(
    new Request("http://stackdraft.local/api/health"),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    status: "ok",
    database: "ok",
  });
});

Deno.test("health endpoint returns 503 when a dependency fails", async () => {
  const app = createTestApp({
    checkHealth: () => Promise.reject(new Error("database unavailable")),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/health"),
  );

  assertExists(response);
  assertEquals(response.status, 503);
  assertEquals(await response.json(), {
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "Stackdraft is not ready.",
      details: {},
    },
  });
});

Deno.test("states endpoint returns 200 with a scoped collection envelope", async () => {
  const app = createTestApp({
    listStates: (scope) => {
      assertEquals(scope, "stack");
      return Promise.resolve([sampleStackState]);
    },
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/states?scope=stack"),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    states: [sampleStackStateResponse],
  });
});

Deno.test("states endpoint returns 400 when scope is missing", async () => {
  const app = createTestApp({
    listStates: () =>
      Promise.reject(
        new ValidationError({
          fields: {
            scope: "Exactly one scope query parameter is required.",
          },
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/states"),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          scope: "Exactly one scope query parameter is required.",
        },
      },
    },
  });
});

Deno.test("states endpoint returns 400 when scope is duplicated", async () => {
  const app = createTestApp();

  const response = await app.handle(
    new Request("http://stackdraft.local/api/states?scope=stack&scope=draft"),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          scope: "Exactly one scope query parameter is required.",
        },
      },
    },
  });
});

Deno.test("states endpoint returns 400 when scope is invalid", async () => {
  const app = createTestApp({
    listStates: () =>
      Promise.reject(
        new ValidationError({
          fields: {
            scope: "Scope must be stack or draft.",
          },
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/states?scope=invalid"),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          scope: "Scope must be stack or draft.",
        },
      },
    },
  });
});

Deno.test("states endpoint creates a state with 201", async () => {
  const app = createTestApp({
    createState: (input) => {
      assertEquals(input, {
        scope: "stack",
        name: "Review",
        color: "#aabbcc",
      });
      return Promise.resolve(createdStackState);
    },
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/states", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        scope: "stack",
        name: "Review",
        color: "#aabbcc",
      }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 201);
  assertEquals(await response.json(), createdStackStateResponse);
});

Deno.test("states endpoint rejects create bodies without application/json", async () => {
  let createCalled = false;
  const app = createTestApp({
    createState: () => {
      createCalled = true;
      return Promise.resolve(createdStackState);
    },
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/states", {
      method: "POST",
      body: JSON.stringify({
        scope: "stack",
        name: "Review",
        color: "#aabbcc",
      }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(createCalled, false);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          body: "Request body must use application/json.",
        },
      },
    },
  });
});

Deno.test("states endpoint returns 400 when create body is invalid", async () => {
  const app = createTestApp({
    createState: () =>
      Promise.reject(
        new ValidationError({
          fields: {
            name: "Name is required.",
          },
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/states", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        scope: "stack",
        name: "   ",
        color: "#112233",
      }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          name: "Name is required.",
        },
      },
    },
  });
});

Deno.test("states endpoint returns 409 when create name conflicts", async () => {
  const app = createTestApp({
    createState: () =>
      Promise.reject(
        new StateNameConflictError({ scope: "stack", name: "Planned" }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/states", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        scope: "stack",
        name: "Planned",
        color: "#112233",
      }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 409);
  assertEquals(await response.json(), {
    error: {
      code: "STATE_NAME_CONFLICT",
      message: "A State with this name already exists in this scope.",
      details: {
        fields: {
          name: "A State with this name already exists in this scope.",
        },
      },
    },
  });
});

Deno.test("states endpoint returns 500 unknown error for unexpected state persistence failures", async () => {
  const app = createTestApp({
    createState: () =>
      Promise.reject(
        new UnknownStateStoreError({
          cause: new Error(
            "UNIQUE constraint failed: states.scope, states.position",
          ),
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/states", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        scope: "stack",
        name: "Review",
        color: "#112233",
      }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 500);
  assertEquals(await response.json(), {
    error: {
      code: "UNKNOWN_ERROR",
      message: "An unexpected error occurred.",
      details: {},
    },
  });
});

Deno.test("states endpoint updates a state with 200", async () => {
  const app = createTestApp({
    updateState: (stateId, input) => {
      assertEquals(stateId, "00000000-0000-4000-8000-000000000001");
      assertEquals(input, { name: "Scheduled" });
      return Promise.resolve({
        ...sampleStackState,
        name: "Scheduled",
        updatedAt: utc("2026-02-01T12:00:00.000Z"),
      });
    },
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000001",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Scheduled" }),
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    ...sampleStackStateResponse,
    name: "Scheduled",
    updatedAt: "2026-02-01T12:00:00.000Z",
  });
});

Deno.test("states endpoint rejects update bodies without application/json", async () => {
  let updateCalled = false;
  const app = createTestApp({
    updateState: () => {
      updateCalled = true;
      return Promise.resolve(createdStackState);
    },
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000001",
      {
        method: "PATCH",
        body: JSON.stringify({ name: "Scheduled" }),
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(updateCalled, false);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          body: "Request body must use application/json.",
        },
      },
    },
  });
});

Deno.test("states endpoint returns 404 when updating a missing state", async () => {
  const app = createTestApp({
    updateState: () =>
      Promise.reject(
        new StateNotFoundError({
          stateId: "00000000-0000-4000-8000-000000000099",
        }),
      ),
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000099",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Missing" }),
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 404);
  assertEquals(await response.json(), {
    error: {
      code: "STATE_NOT_FOUND",
      message: "The requested State does not exist.",
      details: {},
    },
  });
});

Deno.test("states endpoint returns 400 when update body is empty", async () => {
  const app = createTestApp({
    updateState: () =>
      Promise.reject(
        new ValidationError({
          fields: {
            body: "At least one field is required.",
          },
        }),
      ),
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000001",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          body: "At least one field is required.",
        },
      },
    },
  });
});

Deno.test("states endpoint returns 400 when state id is invalid", async () => {
  const app = createTestApp({
    updateState: () =>
      Promise.reject(
        new ValidationError({
          fields: {
            stateId: "State ID must be a valid UUID.",
          },
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/states/not-a-uuid", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Scheduled" }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          stateId: "State ID must be a valid UUID.",
        },
      },
    },
  });
});

Deno.test("states endpoint moves a state with 200 and returns the reordered scope", async () => {
  const reorderedStates: State[] = [
    {
      ...sampleStackState,
      position: 1,
    },
    {
      ...createdStackState,
      position: 0,
      isDefault: false,
    },
  ];
  const app = createTestApp({
    moveState: (stateId, input) => {
      assertEquals(stateId, "00000000-0000-4000-8000-000000000001");
      assertEquals(input, { position: 1 });
      return Promise.resolve(reorderedStates);
    },
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000001/position",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ position: 1 }),
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    states: [
      {
        ...sampleStackStateResponse,
        position: 1,
      },
      {
        ...createdStackStateResponse,
        position: 0,
        isDefault: false,
      },
    ],
  });
});

Deno.test("states endpoint rejects move bodies without application/json", async () => {
  let moveCalled = false;
  const app = createTestApp({
    moveState: () => {
      moveCalled = true;
      return Promise.resolve([sampleStackState]);
    },
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000001/position",
      {
        method: "PUT",
        body: JSON.stringify({ position: 1 }),
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(moveCalled, false);
});

Deno.test("states endpoint returns 400 when move position is invalid", async () => {
  const app = createTestApp({
    moveState: () =>
      Promise.reject(
        new ValidationError({
          fields: {
            position: "Position must be between 0 and 3.",
          },
        }),
      ),
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000001/position",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ position: 9 }),
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          position: "Position must be between 0 and 3.",
        },
      },
    },
  });
});

Deno.test("states endpoint returns 404 when moving a missing state", async () => {
  const app = createTestApp({
    moveState: () =>
      Promise.reject(
        new StateNotFoundError({
          stateId: "00000000-0000-4000-8000-000000000099",
        }),
      ),
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000099/position",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ position: 0 }),
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 404);
});

Deno.test("states endpoint selects a default state with 200", async () => {
  const app = createTestApp({
    selectDefaultState: (stateId) => {
      assertEquals(stateId, "00000000-0000-4000-8000-000000000002");
      return Promise.resolve({
        ...createdStackState,
        id: "00000000-0000-4000-8000-000000000002",
        name: "Active",
        color: "#8fa8ff",
        position: 1,
        isDefault: true,
        updatedAt: utc("2026-02-01T12:00:00.000Z"),
      });
    },
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000002/default",
      {
        method: "PUT",
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    id: "00000000-0000-4000-8000-000000000002",
    scope: "stack",
    name: "Active",
    color: "#8fa8ff",
    position: 1,
    isDefault: true,
    createdAt: "2026-02-01T12:00:00.000Z",
    updatedAt: "2026-02-01T12:00:00.000Z",
  });
});

Deno.test("states endpoint returns 404 when selecting a missing default", async () => {
  const app = createTestApp({
    selectDefaultState: () =>
      Promise.reject(
        new StateNotFoundError({
          stateId: "00000000-0000-4000-8000-000000000099",
        }),
      ),
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000099/default",
      {
        method: "PUT",
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 404);
});

Deno.test("states endpoint rejects default selection request bodies", async () => {
  let selectDefaultCalled = false;
  const app = createTestApp({
    selectDefaultState: () => {
      selectDefaultCalled = true;
      return Promise.resolve(sampleStackState);
    },
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000002/default",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          stateId: "00000000-0000-4000-8000-000000000099",
        }),
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(selectDefaultCalled, false);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          body: "Request body must be empty.",
        },
      },
    },
  });
});

Deno.test("states endpoint rejects default selection bodies with an irrelevant content type", async () => {
  let selectDefaultCalled = false;
  const app = createTestApp({
    selectDefaultState: () => {
      selectDefaultCalled = true;
      return Promise.resolve(sampleStackState);
    },
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000002/default",
      {
        method: "PUT",
        headers: {
          "content-type": "text/plain",
        },
        body: "not-json",
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(selectDefaultCalled, false);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          body: "Request body must be empty.",
        },
      },
    },
  });
});

Deno.test("states endpoint returns 400 when default state id is invalid", async () => {
  const app = createTestApp({
    selectDefaultState: () =>
      Promise.reject(
        new ValidationError({
          fields: {
            stateId: "State ID must be a valid UUID.",
          },
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/states/not-a-uuid/default", {
      method: "PUT",
    }),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          stateId: "State ID must be a valid UUID.",
        },
      },
    },
  });
});

Deno.test("states endpoint deletes a state with 204", async () => {
  const app = createTestApp({
    deleteState: (stateId) => {
      assertEquals(stateId, "00000000-0000-4000-8000-000000000004");
      return Promise.resolve();
    },
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000004",
      {
        method: "DELETE",
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 204);
  assertEquals(await response.text(), "");
});

Deno.test("states endpoint returns 404 when deleting a missing state", async () => {
  const app = createTestApp({
    deleteState: () =>
      Promise.reject(
        new StateNotFoundError({
          stateId: "00000000-0000-4000-8000-000000000099",
        }),
      ),
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000099",
      {
        method: "DELETE",
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 404);
  assertEquals(await response.json(), {
    error: {
      code: "STATE_NOT_FOUND",
      message: "The requested State does not exist.",
      details: {},
    },
  });
});

Deno.test("states endpoint returns 409 when deleting the default state", async () => {
  const app = createTestApp({
    deleteState: () =>
      Promise.reject(
        new StateIsDefaultError({
          stateId: "00000000-0000-4000-8000-000000000001",
        }),
      ),
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000001",
      {
        method: "DELETE",
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 409);
  assertEquals(await response.json(), {
    error: {
      code: "STATE_IS_DEFAULT",
      message: "This State is the current default for its scope.",
      details: {},
    },
  });
});

Deno.test("states endpoint returns 409 when deleting the last state in a scope", async () => {
  const app = createTestApp({
    deleteState: () =>
      Promise.reject(new LastStateInScopeError({ scope: "stack" })),
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000099",
      {
        method: "DELETE",
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 409);
  assertEquals(await response.json(), {
    error: {
      code: "LAST_STATE_IN_SCOPE",
      message: "At least one State must remain in each scope.",
      details: {},
    },
  });
});

Deno.test("states endpoint returns 409 when deleting a state in use", async () => {
  const app = createTestApp({
    deleteState: () =>
      Promise.reject(
        new StateInUseError({
          stateId: "00000000-0000-4000-8000-000000000002",
        }),
      ),
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000002",
      {
        method: "DELETE",
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 409);
  assertEquals(await response.json(), {
    error: {
      code: "STATE_IN_USE",
      message: "This State is assigned to existing Stacks or Drafts.",
      details: {},
    },
  });
});

Deno.test("states endpoint rejects delete request bodies", async () => {
  let deleteCalled = false;
  const app = createTestApp({
    deleteState: () => {
      deleteCalled = true;
      return Promise.resolve();
    },
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000004",
      {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ confirm: true }),
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(deleteCalled, false);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          body: "Request body must be empty.",
        },
      },
    },
  });
});

Deno.test("states endpoint returns 400 when delete state id is invalid", async () => {
  const app = createTestApp({
    deleteState: () =>
      Promise.reject(
        new ValidationError({
          fields: {
            stateId: "State ID must be a valid UUID.",
          },
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/states/not-a-uuid", {
      method: "DELETE",
    }),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          stateId: "State ID must be a valid UUID.",
        },
      },
    },
  });
});

Deno.test("stacks endpoint returns listed stacks", async () => {
  const app = createTestApp();

  const response = await app.handle(
    new Request("http://stackdraft.local/api/stacks"),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    stacks: [sampleStackResponse],
  });
});

Deno.test("stacks endpoint returns a stack by id", async () => {
  const app = createTestApp();

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/stacks/00000000-0000-4000-8000-000000000101",
    ),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), sampleStackResponse);
});

Deno.test("stacks endpoint creates a stack", async () => {
  const app = createTestApp();

  const response = await app.handle(
    new Request("http://stackdraft.local/api/stacks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Auth cleanup" }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 201);
  assertEquals(await response.json(), createdStackResponse);
});

Deno.test("stacks endpoint returns stack not found", async () => {
  const app = createTestApp({
    getStack: () =>
      Promise.reject(
        new StackNotFoundError({
          stackId: "00000000-0000-4000-8000-00000000ffff",
        }),
      ),
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/stacks/00000000-0000-4000-8000-00000000ffff",
    ),
  );

  assertExists(response);
  assertEquals(response.status, 404);
  assertEquals(await response.json(), {
    error: {
      code: "STACK_NOT_FOUND",
      message: "The requested Stack does not exist.",
      details: {},
    },
  });
});

Deno.test("stacks endpoint returns invalid state scope", async () => {
  const app = createTestApp({
    createStack: () =>
      Promise.reject(
        new InvalidStateScopeError({
          stateId: "00000000-0000-4000-8000-000000000005",
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/stacks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Auth cleanup",
        stateId: "00000000-0000-4000-8000-000000000005",
      }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "INVALID_STATE_SCOPE",
      message: "This State belongs to the wrong scope for a Stack.",
      details: {},
    },
  });
});

Deno.test("stacks endpoint returns state not found on create", async () => {
  const app = createTestApp({
    createStack: () =>
      Promise.reject(
        new StateNotFoundError({
          stateId: "00000000-0000-4000-8000-00000000ffff",
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/stacks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Auth cleanup",
        stateId: "00000000-0000-4000-8000-00000000ffff",
      }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 404);
  assertEquals(await response.json(), {
    error: {
      code: "STATE_NOT_FOUND",
      message: "The requested State does not exist.",
      details: {},
    },
  });
});

Deno.test("stacks endpoint returns validation errors", async () => {
  const app = createTestApp({
    createStack: () =>
      Promise.reject(
        new ValidationError({
          fields: {
            title: "Title is required.",
          },
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/stacks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "   " }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          title: "Title is required.",
        },
      },
    },
  });
});

Deno.test("stacks endpoint returns 400 when stack id is invalid", async () => {
  const app = createTestApp({
    getStack: () =>
      Promise.reject(
        new ValidationError({
          fields: {
            stackId: "Stack ID must be a valid UUID.",
          },
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/stacks/not-a-uuid"),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          stackId: "Stack ID must be a valid UUID.",
        },
      },
    },
  });
});

Deno.test("stacks endpoint maps unknown persistence failures to 500", async () => {
  const app = createTestApp({
    createStack: () =>
      Promise.reject(new UnknownStackStoreError({ cause: new Error("boom") })),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/stacks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Auth cleanup" }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 500);
  assertEquals(await response.json(), {
    error: {
      code: "UNKNOWN_ERROR",
      message: "An unexpected error occurred.",
      details: {},
    },
  });
});

Deno.test("stacks endpoint updates a stack", async () => {
  const app = createTestApp({
    updateStack: (stackId, input) => {
      assertEquals(stackId, "00000000-0000-4000-8000-000000000101");
      assertEquals(input, { title: "Auth cleanup" });
      return Promise.resolve({
        ...sampleStack,
        title: "Auth cleanup",
        updatedAt: utc("2026-02-04T12:00:00.000Z"),
      });
    },
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/stacks/00000000-0000-4000-8000-000000000101",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Auth cleanup" }),
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    ...sampleStackResponse,
    title: "Auth cleanup",
    updatedAt: "2026-02-04T12:00:00.000Z",
  });
});

Deno.test("stacks endpoint rejects an empty update body", async () => {
  const app = createTestApp({
    updateStack: () =>
      Promise.reject(
        new ValidationError({
          fields: {
            body: "At least one field is required.",
          },
        }),
      ),
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/stacks/00000000-0000-4000-8000-000000000101",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          body: "At least one field is required.",
        },
      },
    },
  });
});

Deno.test("stacks endpoint returns stack not found on update", async () => {
  const app = createTestApp({
    updateStack: () =>
      Promise.reject(
        new StackNotFoundError({
          stackId: "00000000-0000-4000-8000-00000000ffff",
        }),
      ),
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/stacks/00000000-0000-4000-8000-00000000ffff",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Auth cleanup" }),
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 404);
  assertEquals(await response.json(), {
    error: {
      code: "STACK_NOT_FOUND",
      message: "The requested Stack does not exist.",
      details: {},
    },
  });
});

Deno.test("stacks endpoint returns invalid state scope on update", async () => {
  const app = createTestApp({
    updateStack: () =>
      Promise.reject(
        new InvalidStateScopeError({
          stateId: "00000000-0000-4000-8000-000000000005",
        }),
      ),
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/stacks/00000000-0000-4000-8000-000000000101",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          stateId: "00000000-0000-4000-8000-000000000005",
        }),
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "INVALID_STATE_SCOPE",
      message: "This State belongs to the wrong scope for a Stack.",
      details: {},
    },
  });
});

Deno.test("stacks endpoint filters stacks by state id", async () => {
  const app = createTestApp({
    listStacks: (filter) => {
      assertEquals(filter, {
        stateId: "00000000-0000-4000-8000-000000000001",
      });
      return Promise.resolve([sampleStack]);
    },
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/stacks?stateId=00000000-0000-4000-8000-000000000001",
    ),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    stacks: [sampleStackResponse],
  });
});

Deno.test("stacks endpoint rejects duplicate stateId query parameters", async () => {
  const app = createTestApp();

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/stacks?stateId=00000000-0000-4000-8000-000000000001&stateId=00000000-0000-4000-8000-000000000002",
    ),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          stateId: "At most one stateId query parameter is allowed.",
        },
      },
    },
  });
});

Deno.test("stacks endpoint rejects unknown query parameters", async () => {
  const app = createTestApp({
    listStacks: () =>
      Promise.reject(new Error("listStacks should not be called")),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/stacks?state=not-a-uuid"),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          state: "Unknown query parameter.",
        },
      },
    },
  });
});

Deno.test("stacks endpoint rejects unexpected query keys without stateId", async () => {
  const app = createTestApp({
    listStacks: () =>
      Promise.reject(new Error("listStacks should not be called")),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/stacks?unexpected=1"),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          unexpected: "Unknown query parameter.",
        },
      },
    },
  });
});

Deno.test("stacks endpoint rejects unexpected query keys alongside stateId", async () => {
  const app = createTestApp({
    listStacks: () =>
      Promise.reject(new Error("listStacks should not be called")),
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/stacks?stateId=00000000-0000-4000-8000-000000000001&unexpected=1",
    ),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          unexpected: "Unknown query parameter.",
        },
      },
    },
  });
});

Deno.test("stacks endpoint rejects malformed stateId filter", async () => {
  const app = createTestApp({
    listStacks: () =>
      Promise.reject(
        new ValidationError({
          fields: {
            stateId: "State ID must be a valid UUID.",
          },
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/stacks?stateId=not-a-uuid"),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          stateId: "State ID must be a valid UUID.",
        },
      },
    },
  });
});

Deno.test("drafts endpoint returns listed drafts", async () => {
  const app = createTestApp();

  const response = await app.handle(
    new Request("http://stackdraft.local/api/drafts"),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { drafts: [sampleDraftResponse] });
});

Deno.test("drafts endpoint returns a draft by id", async () => {
  const app = createTestApp();

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/drafts/00000000-0000-4000-8000-000000000201",
    ),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), sampleDraftResponse);
});

Deno.test("drafts endpoint creates a draft", async () => {
  const app = createTestApp();

  const response = await app.handle(
    new Request("http://stackdraft.local/api/drafts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Extract billing module" }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 201);
  assertEquals(await response.json(), createdDraftResponse);
});

Deno.test("drafts endpoint returns draft not found", async () => {
  const app = createTestApp({
    getDraft: () =>
      Promise.reject(
        new DraftNotFoundError({
          draftId: "00000000-0000-4000-8000-00000000ffff",
        }),
      ),
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/drafts/00000000-0000-4000-8000-00000000ffff",
    ),
  );

  assertExists(response);
  assertEquals(response.status, 404);
  assertEquals(await response.json(), {
    error: {
      code: "DRAFT_NOT_FOUND",
      message: "The requested Draft does not exist.",
      details: {},
    },
  });
});

Deno.test("drafts endpoint returns invalid state scope", async () => {
  const app = createTestApp({
    createDraft: () =>
      Promise.reject(
        new InvalidStateScopeError({
          stateId: "00000000-0000-4000-8000-000000000001",
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/drafts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Auth cleanup",
        stateId: "00000000-0000-4000-8000-000000000001",
      }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "INVALID_STATE_SCOPE",
      message: "This State belongs to the wrong scope for a Draft.",
      details: {},
    },
  });
});

Deno.test("drafts endpoint returns stack not found on create", async () => {
  const app = createTestApp({
    createDraft: () =>
      Promise.reject(
        new StackNotFoundError({
          stackId: "00000000-0000-4000-8000-00000000ffff",
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/drafts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Auth cleanup",
        stackId: "00000000-0000-4000-8000-00000000ffff",
      }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 404);
  assertEquals(await response.json(), {
    error: {
      code: "STACK_NOT_FOUND",
      message: "The requested Stack does not exist.",
      details: {},
    },
  });
});

Deno.test("drafts endpoint returns validation errors", async () => {
  const app = createTestApp({
    createDraft: () =>
      Promise.reject(
        new ValidationError({
          fields: {
            title: "Title is required.",
          },
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/drafts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "   " }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          title: "Title is required.",
        },
      },
    },
  });
});

Deno.test("drafts endpoint returns 400 when draft id is invalid", async () => {
  const app = createTestApp({
    getDraft: () =>
      Promise.reject(
        new ValidationError({
          fields: {
            draftId: "Draft ID must be a valid UUID.",
          },
        }),
      ),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/drafts/not-a-uuid"),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          draftId: "Draft ID must be a valid UUID.",
        },
      },
    },
  });
});

Deno.test("drafts endpoint maps unknown persistence failures to 500", async () => {
  const app = createTestApp({
    createDraft: () =>
      Promise.reject(new UnknownDraftStoreError({ cause: new Error("boom") })),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/drafts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Auth cleanup" }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 500);
  assertEquals(await response.json(), {
    error: {
      code: "UNKNOWN_ERROR",
      message: "An unexpected error occurred.",
      details: {},
    },
  });
});

Deno.test("drafts endpoint filters drafts by state id", async () => {
  const app = createTestApp({
    listDrafts: (filter) => {
      assertEquals(filter, {
        stateId: "00000000-0000-4000-8000-000000000005",
      });
      return Promise.resolve([sampleDraft]);
    },
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/drafts?stateId=00000000-0000-4000-8000-000000000005",
    ),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { drafts: [sampleDraftResponse] });
});

Deno.test("drafts endpoint updates a draft", async () => {
  const app = createTestApp({
    updateDraft: (draftId, input) => {
      assertEquals(draftId, "00000000-0000-4000-8000-000000000201");
      assertEquals(input, { title: "Extract billing module" });
      return Promise.resolve({
        ...sampleDraft,
        title: "Extract billing module",
      });
    },
  });

  const response = await app.handle(
    new Request(
      "http://stackdraft.local/api/drafts/00000000-0000-4000-8000-000000000201",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Extract billing module" }),
      },
    ),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    ...sampleDraftResponse,
    title: "Extract billing module",
  });
});

Deno.test("drafts endpoint rejects unknown query parameters", async () => {
  const app = createTestApp({
    listDrafts: () =>
      Promise.reject(new Error("listDrafts should not be called")),
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/drafts?scope=draft"),
  );

  assertExists(response);
  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {
        fields: {
          scope: "Unknown query parameter.",
        },
      },
    },
  });
});
