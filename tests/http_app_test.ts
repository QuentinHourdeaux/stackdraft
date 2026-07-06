import { assertEquals, assertExists } from "@std/assert";
import type { State } from "../api/domain/state/state.ts";
import { ValidationError } from "../api/application/validation-error.ts";
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

const createTestApp = (
  overrides: Partial<{
    checkHealth: () => Promise<{ status: "ok"; database: "ok" }>;
    listStates: (scopeValues: readonly string[]) => Promise<readonly State[]>;
  }> = {},
) =>
  createApp({
    checkHealth: () =>
      Promise.resolve({ status: "ok", database: "ok" } as const),
    listStates: () => Promise.resolve([sampleStackState]),
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
