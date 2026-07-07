import { assertEquals, assertExists } from "@std/assert";
import type { State } from "../api/domain/state/state.ts";
import {
  StateNameConflictError,
  StateNotFoundError,
  UnknownStateRepositoryError,
} from "../api/application/state-repository.ts";
import { ValidationError } from "../api/application/validation-error.ts";
import type { CreateStateInput } from "../api/application/state-service.ts";
import { createApp } from "../api/infrastructure/http/app.ts";

const sampleStackState: State = {
  id: "00000000-0000-4000-8000-000000000001",
  scope: "stack",
  name: "Planned",
  color: "#8d98a5",
  position: 0,
  isDefault: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const createdStackState: State = {
  id: "00000000-0000-4000-8000-00000000aa01",
  scope: "stack",
  name: "Review",
  color: "#aabbcc",
  position: 4,
  isDefault: false,
  createdAt: "2026-02-01T12:00:00.000Z",
  updatedAt: "2026-02-01T12:00:00.000Z",
};

const createTestApp = (
  overrides: Partial<{
    checkHealth: () => Promise<{ status: "ok"; database: "ok" }>;
    listStates: (scopeValues: readonly string[]) => Promise<readonly State[]>;
    createState: (input: CreateStateInput) => Promise<State>;
    updateState: (
      stateId: string,
      input: { name?: string; color?: string },
    ) => Promise<State>;
  }> = {},
) =>
  createApp({
    checkHealth: () =>
      Promise.resolve({ status: "ok", database: "ok" } as const),
    listStates: () => Promise.resolve([sampleStackState]),
    createState: () => Promise.resolve(createdStackState),
    updateState: () => Promise.resolve(createdStackState),
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
    listStates: (scopeValues) => {
      assertEquals(scopeValues, ["stack"]);
      return Promise.resolve([sampleStackState]);
    },
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/states?scope=stack"),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    states: [sampleStackState],
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
  assertEquals(await response.json(), createdStackState);
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
        new UnknownStateRepositoryError({
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
        updatedAt: "2026-02-01T12:00:00.000Z",
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
    ...sampleStackState,
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
