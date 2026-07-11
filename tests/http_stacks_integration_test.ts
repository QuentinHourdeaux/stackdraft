import { DatabaseSync } from "node:sqlite";
import { assertEquals, assertExists } from "@std/assert";
import { Effect, Layer } from "effect";
import {
  createStack,
  getStack,
  listStacks,
  StackService,
  updateStack,
} from "../api/core/stack/service.ts";
import { makeStackService } from "../api/core/stack/service-live.ts";
import { StackStore } from "../api/core/stack/store.ts";
import {
  createState,
  deleteState,
  listStatesByScope,
  moveState,
  selectDefaultState,
  StateService,
  updateState,
} from "../api/core/state/service.ts";
import { makeStateService } from "../api/core/state/service-live.ts";
import { StateStore } from "../api/core/state/store.ts";
import { createApp } from "../api/infrastructure/http/app.ts";
import { migrate } from "../api/infrastructure/database/migrate.ts";
import { makeStackStore } from "../api/infrastructure/database/stack-store.ts";
import { makeStateStore } from "../api/infrastructure/database/state-store.ts";
import { runLayerEffect } from "../api/lib/effect/run-effect.ts";
import { noopLogger } from "../api/lib/logging/logger.ts";

const fixedNow = new Date("2026-02-03T12:00:00.000Z");
const createdStackId = "00000000-0000-4000-8000-00000000aa01";

const createIntegratedStacksApp = async () => {
  const database = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
  });

  await Effect.runPromise(migrate(database));

  const stateStore = makeStateStore(database);
  const stackStore = makeStackStore(database);
  const dependencies = {
    generateId: () => createdStackId,
    now: () => fixedNow,
  };
  const appLayer = Layer.mergeAll(
    Layer.succeed(StateStore, stateStore),
    Layer.succeed(
      StateService,
      makeStateService(stateStore, dependencies),
    ),
    Layer.succeed(StackStore, stackStore),
    Layer.succeed(
      StackService,
      makeStackService(stackStore, dependencies),
    ),
  );
  const runEffect = runLayerEffect(appLayer);

  const app = createApp({
    logger: noopLogger,
    checkHealth: () =>
      Promise.resolve({ status: "ok", database: "ok" } as const),
    listStates: (scope) => runEffect(listStatesByScope(scope)),
    createState: (input) => runEffect(createState(input)),
    updateState: (stateId, input) => runEffect(updateState(stateId, input)),
    moveState: (stateId, input) => runEffect(moveState(stateId, input)),
    selectDefaultState: (stateId) => runEffect(selectDefaultState(stateId)),
    deleteState: (stateId) => runEffect(deleteState(stateId)),
    listStacks: (filter) => runEffect(listStacks(filter)),
    getStack: (stackId) => runEffect(getStack(stackId)),
    createStack: (input) => runEffect(createStack(input)),
    updateStack: (stackId, input) => runEffect(updateStack(stackId, input)),
    listDrafts: () => Promise.resolve([]),
    getDraft: () => Promise.reject(new Error("not called")),
    createDraft: () => Promise.reject(new Error("not called")),
    frontendDistPath: "./dist",
  });

  return { app, database };
};

Deno.test("stacks endpoint integration creates a stack with the default state", async () => {
  const { app, database } = await createIntegratedStacksApp();

  try {
    const response = await app.handle(
      new Request("http://stackdraft.local/api/stacks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Payments rewrite" }),
      }),
    );

    assertExists(response);
    assertEquals(response.status, 201);

    const body = await response.json();
    assertEquals(body, {
      id: createdStackId,
      title: "Payments rewrite",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000001",
      createdAt: fixedNow.toISOString(),
      updatedAt: fixedNow.toISOString(),
    });
  } finally {
    database.close();
  }
});

Deno.test("stacks endpoint integration lists created stacks", async () => {
  const { app, database } = await createIntegratedStacksApp();

  try {
    await app.handle(
      new Request("http://stackdraft.local/api/stacks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Payments rewrite" }),
      }),
    );

    const response = await app.handle(
      new Request("http://stackdraft.local/api/stacks"),
    );

    assertExists(response);
    assertEquals(response.status, 200);

    const body = await response.json();
    assertEquals(body.stacks.length, 1);
    assertEquals(body.stacks[0]?.id, createdStackId);
  } finally {
    database.close();
  }
});

Deno.test("stacks endpoint integration returns a created stack by id", async () => {
  const { app, database } = await createIntegratedStacksApp();

  try {
    await app.handle(
      new Request("http://stackdraft.local/api/stacks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Payments rewrite" }),
      }),
    );

    const response = await app.handle(
      new Request(`http://stackdraft.local/api/stacks/${createdStackId}`),
    );

    assertExists(response);
    assertEquals(response.status, 200);
    assertEquals((await response.json()).id, createdStackId);
  } finally {
    database.close();
  }
});

Deno.test("stacks endpoint integration rejects draft-scoped state assignment", async () => {
  const { app, database } = await createIntegratedStacksApp();

  try {
    const response = await app.handle(
      new Request("http://stackdraft.local/api/stacks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Payments rewrite",
          stateId: "00000000-0000-4000-8000-000000000005",
        }),
      }),
    );

    assertExists(response);
    assertEquals(response.status, 400);
    assertEquals((await response.json()).error.code, "INVALID_STATE_SCOPE");
  } finally {
    database.close();
  }
});

Deno.test("stacks endpoint integration uses the current default state after reassignment", async () => {
  const { app, database } = await createIntegratedStacksApp();

  try {
    await app.handle(
      new Request(
        "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000002/default",
        {
          method: "PUT",
        },
      ),
    );

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
    assertEquals(
      (await response.json()).stateId,
      "00000000-0000-4000-8000-000000000002",
    );
  } finally {
    database.close();
  }
});

Deno.test("stacks endpoint integration blocks deleting a referenced state", async () => {
  const { app, database } = await createIntegratedStacksApp();

  try {
    await app.handle(
      new Request("http://stackdraft.local/api/stacks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Payments rewrite",
          stateId: "00000000-0000-4000-8000-000000000002",
        }),
      }),
    );

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
    assertEquals((await response.json()).error.code, "STATE_IN_USE");
  } finally {
    database.close();
  }
});

Deno.test("stacks endpoint integration returns stack not found", async () => {
  const { app, database } = await createIntegratedStacksApp();

  try {
    const response = await app.handle(
      new Request(
        "http://stackdraft.local/api/stacks/00000000-0000-4000-8000-00000000ffff",
      ),
    );

    assertExists(response);
    assertEquals(response.status, 404);
    assertEquals((await response.json()).error.code, "STACK_NOT_FOUND");
  } finally {
    database.close();
  }
});

Deno.test("stacks endpoint integration rejects malformed stack ids", async () => {
  const { app, database } = await createIntegratedStacksApp();

  try {
    const response = await app.handle(
      new Request("http://stackdraft.local/api/stacks/not-a-uuid"),
    );

    assertExists(response);
    assertEquals(response.status, 400);
    assertEquals((await response.json()).error.code, "VALIDATION_ERROR");
  } finally {
    database.close();
  }
});

Deno.test("stacks endpoint integration updates a stack title", async () => {
  const { app, database } = await createIntegratedStacksApp();

  try {
    await app.handle(
      new Request("http://stackdraft.local/api/stacks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Payments rewrite" }),
      }),
    );

    const response = await app.handle(
      new Request(`http://stackdraft.local/api/stacks/${createdStackId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Auth cleanup" }),
      }),
    );

    assertExists(response);
    assertEquals(response.status, 200);
    assertEquals((await response.json()).title, "Auth cleanup");
  } finally {
    database.close();
  }
});

Deno.test("stacks endpoint integration reassigns a stack to another stack state", async () => {
  const defaultStackStateId = "00000000-0000-4000-8000-000000000001";
  const alternateStackStateId = "00000000-0000-4000-8000-000000000002";
  const { app, database } = await createIntegratedStacksApp();

  try {
    await app.handle(
      new Request("http://stackdraft.local/api/stacks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Payments rewrite" }),
      }),
    );

    const patchResponse = await app.handle(
      new Request(`http://stackdraft.local/api/stacks/${createdStackId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ stateId: alternateStackStateId }),
      }),
    );

    assertExists(patchResponse);
    assertEquals(patchResponse.status, 200);

    const patched = await patchResponse.json();
    assertEquals(patched.stateId, alternateStackStateId);
    assertEquals(patched.updatedAt, fixedNow.toISOString());

    const getResponse = await app.handle(
      new Request(`http://stackdraft.local/api/stacks/${createdStackId}`),
    );

    assertExists(getResponse);
    assertEquals(getResponse.status, 200);
    assertEquals((await getResponse.json()).stateId, alternateStackStateId);

    const alternateFilterResponse = await app.handle(
      new Request(
        `http://stackdraft.local/api/stacks?stateId=${alternateStackStateId}`,
      ),
    );

    assertExists(alternateFilterResponse);
    assertEquals(alternateFilterResponse.status, 200);
    assertEquals(
      (await alternateFilterResponse.json()).stacks.map((
        stack: { id: string },
      ) => stack.id),
      [createdStackId],
    );

    const previousFilterResponse = await app.handle(
      new Request(
        `http://stackdraft.local/api/stacks?stateId=${defaultStackStateId}`,
      ),
    );

    assertExists(previousFilterResponse);
    assertEquals(previousFilterResponse.status, 200);
    assertEquals((await previousFilterResponse.json()).stacks, []);
  } finally {
    database.close();
  }
});

Deno.test("stacks endpoint integration preserves updatedAt for unchanged updates", async () => {
  const { app, database } = await createIntegratedStacksApp();

  try {
    await app.handle(
      new Request("http://stackdraft.local/api/stacks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Payments rewrite" }),
      }),
    );

    const before = await app.handle(
      new Request(`http://stackdraft.local/api/stacks/${createdStackId}`),
    );
    assertExists(before);
    const beforeBody = await before.json();

    const response = await app.handle(
      new Request(`http://stackdraft.local/api/stacks/${createdStackId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Payments rewrite",
          stateId: beforeBody.stateId,
        }),
      }),
    );

    assertExists(response);
    assertEquals(response.status, 200);
    assertEquals((await response.json()).updatedAt, beforeBody.updatedAt);
  } finally {
    database.close();
  }
});

Deno.test("stacks endpoint integration filters stacks by state id", async () => {
  const { app, database } = await createIntegratedStacksApp();

  try {
    await app.handle(
      new Request("http://stackdraft.local/api/stacks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Payments rewrite",
          stateId: "00000000-0000-4000-8000-000000000002",
        }),
      }),
    );

    const response = await app.handle(
      new Request(
        "http://stackdraft.local/api/stacks?stateId=00000000-0000-4000-8000-000000000002",
      ),
    );

    assertExists(response);
    assertEquals(response.status, 200);

    const body = await response.json();
    assertEquals(body.stacks.length, 1);
    assertEquals(body.stacks[0]?.id, createdStackId);
  } finally {
    database.close();
  }
});

Deno.test("stacks endpoint integration rejects draft-scoped state filters", async () => {
  const { app, database } = await createIntegratedStacksApp();

  try {
    const response = await app.handle(
      new Request(
        "http://stackdraft.local/api/stacks?stateId=00000000-0000-4000-8000-000000000005",
      ),
    );

    assertExists(response);
    assertEquals(response.status, 400);
    assertEquals((await response.json()).error.code, "INVALID_STATE_SCOPE");
  } finally {
    database.close();
  }
});
