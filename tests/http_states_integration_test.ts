import { DatabaseSync } from "node:sqlite";
import { assertEquals, assertExists } from "@std/assert";
import { Effect, Layer } from "effect";
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
import { makeStateStore } from "../api/infrastructure/database/state-store.ts";
import { runLayerEffect } from "../api/lib/effect/run-effect.ts";
import { noopLogger } from "../api/lib/logging/logger.ts";

const fixedNow = new Date("2026-02-03T12:00:00.000Z");

const createIntegratedStatesApp = async () => {
  const database = new DatabaseSync(":memory:");

  await Effect.runPromise(migrate(database));

  const store = makeStateStore(database);
  const service = makeStateService(store, {
    generateId: () => "00000000-0000-4000-8000-00000000aa01",
    now: () => fixedNow,
  });
  const appLayer = Layer.mergeAll(
    Layer.succeed(StateStore, store),
    Layer.succeed(StateService, service),
  );
  const runStateEffect = runLayerEffect(appLayer);

  const app = createApp({
    logger: noopLogger,
    checkHealth: () =>
      Promise.resolve({ status: "ok", database: "ok" } as const),
    listStates: (scope) => runStateEffect(listStatesByScope(scope)),
    createState: (input) => runStateEffect(createState(input)),
    updateState: (stateId, input) =>
      runStateEffect(updateState(stateId, input)),
    moveState: (stateId, input) => runStateEffect(moveState(stateId, input)),
    selectDefaultState: (stateId) =>
      runStateEffect(selectDefaultState(stateId)),
    deleteState: (stateId) => runStateEffect(deleteState(stateId)),
    frontendDistPath: "./dist",
  });

  return { app, database };
};

Deno.test("states endpoint integration moves a state through the real stack", async () => {
  const { app, database } = await createIntegratedStatesApp();

  try {
    const response = await app.handle(
      new Request(
        "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000002/position",
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ position: 3 }),
        },
      ),
    );

    assertExists(response);
    assertEquals(response.status, 200);

    const body = await response.json();
    assertEquals(
      body.states.map((state: { id: string; position: number }) => ({
        id: state.id,
        position: state.position,
      })),
      [
        {
          id: "00000000-0000-4000-8000-000000000001",
          position: 0,
        },
        {
          id: "00000000-0000-4000-8000-000000000003",
          position: 1,
        },
        {
          id: "00000000-0000-4000-8000-000000000004",
          position: 2,
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          position: 3,
        },
      ],
    );
    assertEquals(body.states[3]?.updatedAt, fixedNow.toISOString());
  } finally {
    database.close();
  }
});

Deno.test("states endpoint integration treats a move to the current position as a no-op", async () => {
  const { app, database } = await createIntegratedStatesApp();

  try {
    const response = await app.handle(
      new Request(
        "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000002/position",
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

    const body = await response.json();
    const movedState = body.states.find(
      (state: { id: string }) =>
        state.id === "00000000-0000-4000-8000-000000000002",
    );

    assertEquals(movedState?.updatedAt, "2026-01-01T00:00:00.000Z");
  } finally {
    database.close();
  }
});

Deno.test("states endpoint integration returns 400 for a non-integer move position", async () => {
  const { app, database } = await createIntegratedStatesApp();

  try {
    const response = await app.handle(
      new Request(
        "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000002/position",
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ position: 0.5 }),
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
            position: "Position must be a whole number.",
          },
        },
      },
    });
  } finally {
    database.close();
  }
});

Deno.test("states endpoint integration returns 400 for an out-of-range move position", async () => {
  const { app, database } = await createIntegratedStatesApp();

  try {
    const response = await app.handle(
      new Request(
        "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000002/position",
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
  } finally {
    database.close();
  }
});

Deno.test("states endpoint integration selects a default state through the real stack", async () => {
  const { app, database } = await createIntegratedStatesApp();

  try {
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
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: fixedNow.toISOString(),
    });
  } finally {
    database.close();
  }
});

Deno.test("states endpoint integration deletes a state and compacts positions", async () => {
  const { app, database } = await createIntegratedStatesApp();

  try {
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

    const listResponse = await app.handle(
      new Request("http://stackdraft.local/api/states?scope=stack"),
    );
    const body = await listResponse?.json();

    assertEquals(
      body.states.map((state: { id: string; position: number }) => ({
        id: state.id,
        position: state.position,
      })),
      [
        {
          id: "00000000-0000-4000-8000-000000000001",
          position: 0,
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          position: 1,
        },
        {
          id: "00000000-0000-4000-8000-000000000003",
          position: 2,
        },
      ],
    );
  } finally {
    database.close();
  }
});

Deno.test("states endpoint integration returns 409 when deleting the default state", async () => {
  const { app, database } = await createIntegratedStatesApp();

  try {
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
  } finally {
    database.close();
  }
});
