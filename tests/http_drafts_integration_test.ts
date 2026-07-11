import { DatabaseSync } from "node:sqlite";
import { assertEquals, assertExists } from "@std/assert";
import { Effect, Layer } from "effect";
import {
  createDraft,
  DraftService,
  getDraft,
  listDrafts,
} from "../api/core/draft/service.ts";
import { makeDraftService } from "../api/core/draft/service-live.ts";
import { DraftStore } from "../api/core/draft/store.ts";
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
import { makeDraftStore } from "../api/infrastructure/database/draft-store.ts";
import { makeStackStore } from "../api/infrastructure/database/stack-store.ts";
import { makeStateStore } from "../api/infrastructure/database/state-store.ts";
import { runLayerEffect } from "../api/lib/effect/run-effect.ts";
import { noopLogger } from "../api/lib/logging/logger.ts";

const fixedNow = new Date("2026-02-03T12:00:00.000Z");
const createdDraftId = "00000000-0000-4000-8000-00000000aa01";
const createdStackId = "00000000-0000-4000-8000-00000000bb01";

const createIntegratedDraftsApp = async () => {
  const database = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
  });

  await Effect.runPromise(migrate(database));

  const stateStore = makeStateStore(database);
  const stackStore = makeStackStore(database);
  const draftStore = makeDraftStore(database);
  const dependencies = {
    generateId: () => createdDraftId,
    now: () => fixedNow,
  };
  const stackDependencies = {
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
      makeStackService(stackStore, stackDependencies),
    ),
    Layer.succeed(DraftStore, draftStore),
    Layer.succeed(
      DraftService,
      makeDraftService(draftStore, dependencies),
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
    listDrafts: () => runEffect(listDrafts()),
    getDraft: (draftId) => runEffect(getDraft(draftId)),
    createDraft: (input) => runEffect(createDraft(input)),
    frontendDistPath: "./dist",
  });

  return { app, database, stackDependencies };
};

Deno.test("drafts endpoint integration creates a standalone draft with the default state", async () => {
  const { app, database } = await createIntegratedDraftsApp();

  try {
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
    assertEquals(response.status, 201);

    const body = await response.json();
    assertEquals(body, {
      id: createdDraftId,
      stackId: null,
      title: "Auth cleanup",
      description: "",
      stateId: "00000000-0000-4000-8000-000000000005",
      createdAt: fixedNow.toISOString(),
      updatedAt: fixedNow.toISOString(),
    });
  } finally {
    database.close();
  }
});

Deno.test("drafts endpoint integration creates a draft with explicit null stackId", async () => {
  const { app, database } = await createIntegratedDraftsApp();

  try {
    const response = await app.handle(
      new Request("http://stackdraft.local/api/drafts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Auth cleanup", stackId: null }),
      }),
    );

    assertExists(response);
    assertEquals(response.status, 201);
    assertEquals((await response.json()).stackId, null);
  } finally {
    database.close();
  }
});

Deno.test("drafts endpoint integration lists created drafts", async () => {
  const { app, database } = await createIntegratedDraftsApp();

  try {
    await app.handle(
      new Request("http://stackdraft.local/api/drafts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Auth cleanup" }),
      }),
    );

    const response = await app.handle(
      new Request("http://stackdraft.local/api/drafts"),
    );

    assertExists(response);
    assertEquals(response.status, 200);

    const body = await response.json();
    assertEquals(body.drafts.length, 1);
    assertEquals(body.drafts[0]?.id, createdDraftId);
    assertEquals(body.drafts[0]?.stackId, null);
  } finally {
    database.close();
  }
});

Deno.test("drafts endpoint integration returns a created draft by id", async () => {
  const { app, database } = await createIntegratedDraftsApp();

  try {
    await app.handle(
      new Request("http://stackdraft.local/api/drafts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Auth cleanup" }),
      }),
    );

    const response = await app.handle(
      new Request(`http://stackdraft.local/api/drafts/${createdDraftId}`),
    );

    assertExists(response);
    assertEquals(response.status, 200);
    assertEquals((await response.json()).id, createdDraftId);
  } finally {
    database.close();
  }
});

Deno.test("drafts endpoint integration creates a draft assigned to an existing stack", async () => {
  const { app, database } = await createIntegratedDraftsApp();

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
      new Request("http://stackdraft.local/api/drafts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Extract billing module",
          stackId: createdStackId,
        }),
      }),
    );

    assertExists(response);
    assertEquals(response.status, 201);
    assertEquals((await response.json()).stackId, createdStackId);
  } finally {
    database.close();
  }
});

Deno.test("drafts endpoint integration rejects stack-scoped state assignment", async () => {
  const { app, database } = await createIntegratedDraftsApp();

  try {
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
    assertEquals((await response.json()).error.code, "INVALID_STATE_SCOPE");
  } finally {
    database.close();
  }
});

Deno.test("drafts endpoint integration returns stack not found", async () => {
  const { app, database } = await createIntegratedDraftsApp();

  try {
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
    assertEquals((await response.json()).error.code, "STACK_NOT_FOUND");
  } finally {
    database.close();
  }
});

Deno.test("drafts endpoint integration returns draft not found", async () => {
  const { app, database } = await createIntegratedDraftsApp();

  try {
    const response = await app.handle(
      new Request(
        "http://stackdraft.local/api/drafts/00000000-0000-4000-8000-00000000ffff",
      ),
    );

    assertExists(response);
    assertEquals(response.status, 404);
    assertEquals((await response.json()).error.code, "DRAFT_NOT_FOUND");
  } finally {
    database.close();
  }
});

Deno.test("drafts endpoint integration blocks deleting a referenced draft state", async () => {
  const { app, database } = await createIntegratedDraftsApp();

  try {
    await app.handle(
      new Request("http://stackdraft.local/api/drafts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Auth cleanup",
          stateId: "00000000-0000-4000-8000-000000000006",
        }),
      }),
    );

    const response = await app.handle(
      new Request(
        "http://stackdraft.local/api/states/00000000-0000-4000-8000-000000000006",
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

Deno.test("drafts endpoint integration rejects unknown query parameters", async () => {
  const { app, database } = await createIntegratedDraftsApp();

  try {
    const response = await app.handle(
      new Request(
        "http://stackdraft.local/api/drafts?stateId=00000000-0000-4000-8000-000000000005",
      ),
    );

    assertExists(response);
    assertEquals(response.status, 400);
    assertEquals((await response.json()).error.code, "VALIDATION_ERROR");
  } finally {
    database.close();
  }
});
