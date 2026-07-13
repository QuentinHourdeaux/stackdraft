import { fromFileUrl, join, resolve } from "@std/path";
import type { StateScope } from "../api/defs/state/state.ts";
import { isStateScope } from "../api/core/state/validation.ts";

const DEFAULT_BASE_URL = "http://127.0.0.1:8000";
const RESULTS_PATH = "qa-results/api-suite.json";
const HEALTH_TIMEOUT_MS = 30_000;
const HEALTH_POLL_MS = 100;
const CHILD_STDERR_TAIL_CHARACTERS = 16_000;

type SuiteMode = "smoke" | "full";

type CheckStatus = "pass" | "fail";

interface CheckResult {
  readonly name: string;
  readonly status: CheckStatus;
  readonly message?: string;
}

interface SuiteResult {
  readonly mode: SuiteMode;
  readonly baseUrl: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly passed: boolean;
  readonly checks: readonly CheckResult[];
}

interface RequestOptions {
  readonly method?: string;
  readonly body?: unknown;
}

interface SuiteContext {
  readonly mode: SuiteMode;
  readonly baseUrl: string;
  readonly checks: CheckResult[];
}

interface ApiStack {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly stateId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ApiDraft {
  readonly id: string;
  readonly stackId: string | null;
  readonly title: string;
  readonly description: string;
  readonly stateId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ApiState {
  readonly id: string;
  readonly scope: StateScope;
  readonly name: string;
  readonly color: string;
  readonly position: number;
  readonly isDefault: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

class CheckFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckFailure";
  }
}

const projectRoot = resolve(fromFileUrl(new URL("../", import.meta.url)));
const apiEntryPath = join(projectRoot, "api/main.ts");

const parseArgs = (): { mode: SuiteMode; baseUrl: string | null } => {
  const args = Deno.args;
  let mode: SuiteMode = "smoke";
  let baseUrl: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--mode") {
      const value = args[index + 1];
      if (value !== "smoke" && value !== "full") {
        throw new Error('--mode must be "smoke" or "full".');
      }
      mode = value;
      index += 1;
      continue;
    }

    if (arg === "--base-url") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--base-url requires a value.");
      }
      baseUrl = value;
      index += 1;
    }
  }

  return { mode, baseUrl };
};

const recordCheck = (
  context: SuiteContext,
  name: string,
  run: () => Promise<void>,
): Promise<void> =>
  run()
    .then(() => {
      context.checks.push({ name, status: "pass" });
      console.log(`PASS ${name}`);
    })
    .catch((cause) => {
      const message = cause instanceof Error ? cause.message : String(cause);
      context.checks.push({ name, status: "fail", message });
      console.error(`FAIL ${name}: ${message}`);
      throw new CheckFailure(message);
    });

const requestJson = async (
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<{ status: number; body: unknown }> => {
  const headers = new Headers();
  let body: string | undefined;

  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
  });

  const text = await response.text();
  const parsedBody = text.length > 0 ? JSON.parse(text) : null;

  return {
    status: response.status,
    body: parsedBody,
  };
};

const assertStatus = (
  actual: number,
  expected: number,
  label: string,
): void => {
  if (actual !== expected) {
    throw new Error(`expected status ${expected}, got ${actual} (${label})`);
  }
};

const assertObject = (
  value: unknown,
  label: string,
): Record<string, unknown> => {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
};

const assertErrorCode = (body: unknown, expectedCode: string): void => {
  const object = assertObject(body, "error body");
  const error = assertObject(object.error, "error");
  const code = error.code;

  if (code !== expectedCode) {
    throw new Error(`expected error code ${expectedCode}, got ${String(code)}`);
  }
};

const assertStateShape = (value: unknown): ApiState => {
  const state = assertObject(value, "state");

  const id = state.id;
  if (typeof id !== "string") {
    throw new Error("state.id must be a string");
  }

  const scope = state.scope;
  if (typeof scope !== "string" || !isStateScope(scope)) {
    throw new Error("state.scope must be stack or draft");
  }

  const name = state.name;
  if (typeof name !== "string") {
    throw new Error("state.name must be a string");
  }

  const color = state.color;
  if (typeof color !== "string") {
    throw new Error("state.color must be a string");
  }

  const position = state.position;
  if (typeof position !== "number") {
    throw new Error("state.position must be a number");
  }

  const isDefault = state.isDefault;
  if (typeof isDefault !== "boolean") {
    throw new Error("state.isDefault must be a boolean");
  }

  const createdAt = state.createdAt;
  if (typeof createdAt !== "string") {
    throw new Error("state.createdAt must be a string");
  }

  const updatedAt = state.updatedAt;
  if (typeof updatedAt !== "string") {
    throw new Error("state.updatedAt must be a string");
  }

  return {
    id,
    scope,
    name,
    color,
    position,
    isDefault,
    createdAt,
    updatedAt,
  };
};

const assertStackShape = (value: unknown): ApiStack => {
  const stack = assertObject(value, "stack");

  const id = stack.id;
  if (typeof id !== "string") {
    throw new Error("stack.id must be a string");
  }

  const title = stack.title;
  if (typeof title !== "string") {
    throw new Error("stack.title must be a string");
  }

  const description = stack.description;
  if (typeof description !== "string") {
    throw new Error("stack.description must be a string");
  }

  const stateId = stack.stateId;
  if (typeof stateId !== "string") {
    throw new Error("stack.stateId must be a string");
  }

  const createdAt = stack.createdAt;
  if (typeof createdAt !== "string") {
    throw new Error("stack.createdAt must be a string");
  }

  const updatedAt = stack.updatedAt;
  if (typeof updatedAt !== "string") {
    throw new Error("stack.updatedAt must be a string");
  }

  return {
    id,
    title,
    description,
    stateId,
    createdAt,
    updatedAt,
  };
};

const assertDraftShape = (value: unknown): ApiDraft => {
  const draft = assertObject(value, "draft");

  const id = draft.id;
  if (typeof id !== "string") {
    throw new Error("draft.id must be a string");
  }

  const stackId = draft.stackId;
  if (stackId !== null && typeof stackId !== "string") {
    throw new Error("draft.stackId must be a string or null");
  }

  const title = draft.title;
  if (typeof title !== "string") {
    throw new Error("draft.title must be a string");
  }

  const description = draft.description;
  if (typeof description !== "string") {
    throw new Error("draft.description must be a string");
  }

  const stateId = draft.stateId;
  if (typeof stateId !== "string") {
    throw new Error("draft.stateId must be a string");
  }

  const createdAt = draft.createdAt;
  if (typeof createdAt !== "string") {
    throw new Error("draft.createdAt must be a string");
  }

  const updatedAt = draft.updatedAt;
  if (typeof updatedAt !== "string") {
    throw new Error("draft.updatedAt must be a string");
  }

  return {
    id,
    stackId,
    title,
    description,
    stateId,
    createdAt,
    updatedAt,
  };
};

const assertContiguousPositions = (states: readonly ApiState[]): void => {
  const positions = states.map((state) => state.position).sort((left, right) =>
    left - right
  );

  for (let index = 0; index < positions.length; index += 1) {
    if (positions[index] !== index) {
      throw new Error("state positions must be contiguous from 0");
    }
  }
};

const runSmokeChecks = async (context: SuiteContext): Promise<void> => {
  await recordCheck(context, "GET /api/health returns 200", async () => {
    const { status, body } = await requestJson(context.baseUrl, "/api/health");
    assertStatus(status, 200, "health");
    const object = assertObject(body, "health body");
    if (object.status !== "ok" || object.database !== "ok") {
      throw new Error("health body must report ok dependencies");
    }
  });

  await recordCheck(
    context,
    "GET /api/states?scope=stack returns 200 with states envelope",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/states?scope=stack",
      );
      assertStatus(status, 200, "stack states");
      const object = assertObject(body, "stack states body");
      if (!Array.isArray(object.states)) {
        throw new Error('response must include a "states" array');
      }
    },
  );

  await recordCheck(
    context,
    "GET /api/states?scope=draft returns 200 with states envelope",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/states?scope=draft",
      );
      assertStatus(status, 200, "draft states");
      const object = assertObject(body, "draft states body");
      if (!Array.isArray(object.states)) {
        throw new Error('response must include a "states" array');
      }
    },
  );

  await recordCheck(
    context,
    "GET /api/states without scope returns 400 VALIDATION_ERROR",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/states",
      );
      assertStatus(status, 400, "missing scope");
      assertErrorCode(body, "VALIDATION_ERROR");
    },
  );

  await recordCheck(
    context,
    "GET /api/stacks returns 200 with stacks envelope",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/stacks",
      );
      assertStatus(status, 200, "stacks");
      const object = assertObject(body, "stacks body");
      if (!Array.isArray(object.stacks)) {
        throw new Error('response must include a "stacks" array');
      }
    },
  );

  await recordCheck(
    context,
    "GET /api/drafts returns 200 with drafts envelope",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/drafts",
      );
      assertStatus(status, 200, "drafts");
      const object = assertObject(body, "drafts body");
      if (!Array.isArray(object.drafts)) {
        throw new Error('response must include a "drafts" array');
      }
    },
  );
};

const runFullChecks = async (context: SuiteContext): Promise<void> => {
  const uniqueSuffix = crypto.randomUUID().slice(0, 8);
  const createdName = `QA State ${uniqueSuffix}`;
  const updatedName = `QA Updated ${uniqueSuffix}`;
  const createdColor = "#aabbcc";
  const updatedColor = "#ccddee";
  let createdStateId = "";
  let deleteCandidateId = "";
  let createdStackId = "";
  let createdDraftId = "";

  await recordCheck(context, "GET /api/health returns 200", async () => {
    const { status, body } = await requestJson(context.baseUrl, "/api/health");
    assertStatus(status, 200, "health");
    const object = assertObject(body, "health body");
    if (object.status !== "ok" || object.database !== "ok") {
      throw new Error("health body must report ok dependencies");
    }
  });

  await recordCheck(
    context,
    "POST /api/states creates an isolated stack state",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/states",
        {
          method: "POST",
          body: {
            scope: "stack",
            name: createdName,
            color: createdColor,
          },
        },
      );
      assertStatus(status, 201, "create state");
      const state = assertStateShape(body);
      if (state.scope !== "stack" || state.name !== createdName) {
        throw new Error("created state must echo scope and name");
      }
      if (state.color !== createdColor) {
        throw new Error("created state must echo color");
      }
      if (state.isDefault) {
        throw new Error("created state must not be default");
      }
      createdStateId = state.id;
    },
  );

  await recordCheck(
    context,
    "GET /api/states?scope=stack includes the created state",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/states?scope=stack",
      );
      assertStatus(status, 200, "list stack states");
      const object = assertObject(body, "stack states body");
      const states = object.states;
      if (!Array.isArray(states)) {
        throw new Error('response must include a "states" array');
      }
      const created = states.find((state) => {
        const parsed = assertStateShape(state);
        return parsed.id === createdStateId;
      });
      if (!created) {
        throw new Error("created state must appear in the collection");
      }
    },
  );

  await recordCheck(
    context,
    "PATCH /api/states/:stateId updates the created state",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/states/${createdStateId}`,
        {
          method: "PATCH",
          body: {
            name: updatedName,
            color: updatedColor,
          },
        },
      );
      assertStatus(status, 200, "update state");
      const state = assertStateShape(body);
      if (state.name !== updatedName || state.color !== updatedColor) {
        throw new Error("updated state must echo name and color");
      }
    },
  );

  await recordCheck(
    context,
    "PUT /api/states/:stateId/position moves the created state",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/states/${createdStateId}/position`,
        {
          method: "PUT",
          body: {
            position: 0,
          },
        },
      );
      assertStatus(status, 200, "move state");
      const object = assertObject(body, "move states body");
      const states = object.states;
      if (!Array.isArray(states)) {
        throw new Error('response must include a "states" array');
      }
      const moved = states.find((state) => {
        const parsed = assertStateShape(state);
        return parsed.id === createdStateId;
      });
      const movedState = assertStateShape(moved);
      if (movedState.position !== 0) {
        throw new Error("moved state must be at position 0");
      }
    },
  );

  await recordCheck(
    context,
    "PUT /api/states/:stateId/default selects the created state",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/states/${createdStateId}/default`,
        {
          method: "PUT",
        },
      );
      assertStatus(status, 200, "select default");
      const state = assertStateShape(body);
      if (!state.isDefault || state.id !== createdStateId) {
        throw new Error("selected state must be default");
      }
    },
  );

  await recordCheck(
    context,
    "POST /api/states creates a second stack state for deletion",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/states",
        {
          method: "POST",
          body: {
            scope: "stack",
            name: `QA Delete ${uniqueSuffix}`,
            color: "#ddeeff",
          },
        },
      );
      assertStatus(status, 201, "create delete candidate");
      const state = assertStateShape(body);
      if (state.isDefault) {
        throw new Error("delete candidate must not be default");
      }
      deleteCandidateId = state.id;
    },
  );

  await recordCheck(
    context,
    "DELETE /api/states/:stateId deletes an eligible non-default state",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/states/${deleteCandidateId}`,
        {
          method: "DELETE",
        },
      );
      assertStatus(status, 204, "delete state");
      if (body !== null) {
        throw new Error("delete must return no body");
      }
    },
  );

  await recordCheck(
    context,
    "GET /api/states?scope=stack reflects deletion and contiguous positions",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/states?scope=stack",
      );
      assertStatus(status, 200, "list stack states after delete");
      const object = assertObject(body, "stack states body");
      const states = object.states;
      if (!Array.isArray(states)) {
        throw new Error('response must include a "states" array');
      }

      const parsedStates = states.map((state) => assertStateShape(state));
      if (
        parsedStates.some((state) => state.id === deleteCandidateId)
      ) {
        throw new Error("deleted state must not appear in the collection");
      }

      assertContiguousPositions(parsedStates);
    },
  );

  await recordCheck(
    context,
    "DELETE /api/states/:stateId rejects the default state with STATE_IS_DEFAULT",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/states/${createdStateId}`,
        {
          method: "DELETE",
        },
      );
      assertStatus(status, 409, "delete default state");
      assertErrorCode(body, "STATE_IS_DEFAULT");
    },
  );

  await recordCheck(
    context,
    "POST /api/states rejects an empty name with VALIDATION_ERROR",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/states",
        {
          method: "POST",
          body: {
            scope: "stack",
            name: "   ",
            color: "#112233",
          },
        },
      );
      assertStatus(status, 400, "empty name");
      assertErrorCode(body, "VALIDATION_ERROR");
    },
  );

  await recordCheck(
    context,
    "POST /api/states rejects a duplicate name with STATE_NAME_CONFLICT",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/states",
        {
          method: "POST",
          body: {
            scope: "stack",
            name: "Planned",
            color: "#112233",
          },
        },
      );
      assertStatus(status, 409, "duplicate name");
      assertErrorCode(body, "STATE_NAME_CONFLICT");
    },
  );

  await recordCheck(
    context,
    "PATCH /api/states/:stateId returns STATE_NOT_FOUND for a missing state",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/states/00000000-0000-4000-8000-00000000ffff",
        {
          method: "PATCH",
          body: {
            name: "Missing",
          },
        },
      );
      assertStatus(status, 404, "missing state");
      assertErrorCode(body, "STATE_NOT_FOUND");
    },
  );

  await recordCheck(
    context,
    "PATCH /api/states/:stateId rejects an empty body with VALIDATION_ERROR",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/states/${createdStateId}`,
        {
          method: "PATCH",
          body: {},
        },
      );
      assertStatus(status, 400, "empty update body");
      assertErrorCode(body, "VALIDATION_ERROR");
    },
  );

  await recordCheck(
    context,
    "POST /api/stacks creates a stack with the default state",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/stacks",
        {
          method: "POST",
          body: {
            title: `QA Stack ${uniqueSuffix}`,
            stateId: "00000000-0000-4000-8000-000000000002",
          },
        },
      );
      assertStatus(status, 201, "create stack");
      const stack = assertStackShape(body);
      if (stack.title !== `QA Stack ${uniqueSuffix}`) {
        throw new Error("created stack must echo title");
      }
      if (stack.description !== "") {
        throw new Error("created stack must default description to empty");
      }
      createdStackId = stack.id;
    },
  );

  await recordCheck(
    context,
    "GET /api/stacks includes the created stack",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/stacks",
      );
      assertStatus(status, 200, "list stacks");
      const object = assertObject(body, "stacks body");
      const stacks = object.stacks;
      if (!Array.isArray(stacks)) {
        throw new Error('response must include a "stacks" array');
      }
      const created = stacks.find((stack) => {
        const parsed = assertStackShape(stack);
        return parsed.id === createdStackId;
      });
      if (!created) {
        throw new Error("created stack must appear in list response");
      }
    },
  );

  await recordCheck(
    context,
    "GET /api/stacks/:stackId returns the created stack",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/stacks/${createdStackId}`,
      );
      assertStatus(status, 200, "get stack");
      const stack = assertStackShape(body);
      if (stack.id !== createdStackId) {
        throw new Error("stack detail must return the requested stack");
      }
    },
  );

  await recordCheck(
    context,
    "POST /api/stacks rejects a draft-scoped state with INVALID_STATE_SCOPE",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/stacks",
        {
          method: "POST",
          body: {
            title: `QA Invalid Scope ${uniqueSuffix}`,
            stateId: "00000000-0000-4000-8000-000000000005",
          },
        },
      );
      assertStatus(status, 400, "invalid state scope");
      assertErrorCode(body, "INVALID_STATE_SCOPE");
    },
  );

  await recordCheck(
    context,
    "GET /api/stacks/:stackId returns STACK_NOT_FOUND for a missing stack",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/stacks/00000000-0000-4000-8000-00000000ffff",
      );
      assertStatus(status, 404, "missing stack");
      assertErrorCode(body, "STACK_NOT_FOUND");
    },
  );

  await recordCheck(
    context,
    "PATCH /api/stacks/:stackId updates the created stack",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/stacks/${createdStackId}`,
        {
          method: "PATCH",
          body: {
            title: `QA Updated Stack ${uniqueSuffix}`,
            description: "Updated in QA.",
          },
        },
      );
      assertStatus(status, 200, "update stack");
      const stack = assertStackShape(body);
      if (stack.title !== `QA Updated Stack ${uniqueSuffix}`) {
        throw new Error("updated stack must echo title");
      }
      if (stack.description !== "Updated in QA.") {
        throw new Error("updated stack must echo description");
      }
    },
  );

  await recordCheck(
    context,
    "PATCH /api/stacks/:stackId reassigns the stack to another stack state",
    async () => {
      const previousStateId = "00000000-0000-4000-8000-000000000002";
      const nextStateId = "00000000-0000-4000-8000-000000000003";

      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/stacks/${createdStackId}`,
        {
          method: "PATCH",
          body: {
            stateId: nextStateId,
          },
        },
      );
      assertStatus(status, 200, "reassign stack state");
      const stack = assertStackShape(body);
      if (stack.stateId !== nextStateId) {
        throw new Error("updated stack must echo the reassigned state");
      }

      const detail = await requestJson(
        context.baseUrl,
        `/api/stacks/${createdStackId}`,
      );
      assertStatus(detail.status, 200, "load reassigned stack");
      const persisted = assertStackShape(detail.body);
      if (persisted.stateId !== nextStateId) {
        throw new Error("reassigned stack must persist the new state");
      }

      const nextFilter = await requestJson(
        context.baseUrl,
        `/api/stacks?stateId=${nextStateId}`,
      );
      assertStatus(nextFilter.status, 200, "filter by reassigned state");
      const nextStacks = assertObject(nextFilter.body, "reassigned filter body")
        .stacks;
      if (!Array.isArray(nextStacks)) {
        throw new Error('response must include a "stacks" array');
      }
      const inNextState = nextStacks.some((entry) => {
        const parsed = assertStackShape(entry);
        return parsed.id === createdStackId;
      });
      if (!inNextState) {
        throw new Error("reassigned stack must appear in the new state filter");
      }

      const previousFilter = await requestJson(
        context.baseUrl,
        `/api/stacks?stateId=${previousStateId}`,
      );
      assertStatus(previousFilter.status, 200, "filter by previous state");
      const previousStacks = assertObject(
        previousFilter.body,
        "previous filter body",
      ).stacks;
      if (!Array.isArray(previousStacks)) {
        throw new Error('response must include a "stacks" array');
      }
      const inPreviousState = previousStacks.some((entry) => {
        const parsed = assertStackShape(entry);
        return parsed.id === createdStackId;
      });
      if (inPreviousState) {
        throw new Error(
          "reassigned stack must not appear in the previous state filter",
        );
      }
    },
  );

  await recordCheck(
    context,
    "PATCH /api/stacks/:stackId rejects an empty body with VALIDATION_ERROR",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/stacks/${createdStackId}`,
        {
          method: "PATCH",
          body: {},
        },
      );
      assertStatus(status, 400, "empty update body");
      assertErrorCode(body, "VALIDATION_ERROR");
    },
  );

  await recordCheck(
    context,
    "GET /api/stacks?stateId filters stacks by state",
    async () => {
      const detail = await requestJson(
        context.baseUrl,
        `/api/stacks/${createdStackId}`,
      );
      assertStatus(detail.status, 200, "load updated stack");
      const stack = assertStackShape(detail.body);

      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/stacks?stateId=${stack.stateId}`,
      );
      assertStatus(status, 200, "filter stacks");
      const object = assertObject(body, "filtered stacks body");
      const stacks = object.stacks;
      if (!Array.isArray(stacks)) {
        throw new Error('response must include a "stacks" array');
      }
      const match = stacks.find((entry) => {
        const parsed = assertStackShape(entry);
        return parsed.id === createdStackId;
      });
      if (!match) {
        throw new Error("filtered stacks must include the created stack");
      }
    },
  );

  await recordCheck(
    context,
    "GET /api/stacks?stateId rejects draft-scoped states with INVALID_STATE_SCOPE",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/stacks?stateId=00000000-0000-4000-8000-000000000005",
      );
      assertStatus(status, 400, "invalid filter scope");
      assertErrorCode(body, "INVALID_STATE_SCOPE");
    },
  );

  await recordCheck(
    context,
    "DELETE /api/states/:stateId rejects a state referenced by a stack",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/stacks/${createdStackId}`,
      );
      assertStatus(status, 200, "load created stack");
      const stack = assertStackShape(body);

      const deleteResponse = await requestJson(
        context.baseUrl,
        `/api/states/${stack.stateId}`,
        {
          method: "DELETE",
        },
      );
      assertStatus(deleteResponse.status, 409, "delete referenced state");
      assertErrorCode(deleteResponse.body, "STATE_IN_USE");
    },
  );

  await recordCheck(
    context,
    "POST /api/drafts creates a standalone draft with the default state",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/drafts",
        {
          method: "POST",
          body: {
            title: `QA Draft ${uniqueSuffix}`,
          },
        },
      );
      assertStatus(status, 201, "create draft");
      const draft = assertDraftShape(body);
      if (draft.title !== `QA Draft ${uniqueSuffix}`) {
        throw new Error("created draft must echo title");
      }
      if (draft.stackId !== null) {
        throw new Error("standalone draft must have null stackId");
      }
      if (draft.description !== "") {
        throw new Error(
          "created draft must default description to empty string",
        );
      }
      createdDraftId = draft.id;
    },
  );

  await recordCheck(
    context,
    "GET /api/drafts includes the created draft",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/drafts",
      );
      assertStatus(status, 200, "list drafts");
      const object = assertObject(body, "drafts body");
      const drafts = object.drafts;
      if (!Array.isArray(drafts)) {
        throw new Error('response must include a "drafts" array');
      }
      const created = drafts.find((entry) => {
        const parsed = assertDraftShape(entry);
        return parsed.id === createdDraftId;
      });
      if (!created) {
        throw new Error("draft list must include the created draft");
      }
    },
  );

  await recordCheck(
    context,
    "GET /api/drafts/:draftId returns the created draft",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/drafts/${createdDraftId}`,
      );
      assertStatus(status, 200, "get draft");
      const draft = assertDraftShape(body);
      if (draft.id !== createdDraftId) {
        throw new Error("draft detail must return the requested draft");
      }
    },
  );

  await recordCheck(
    context,
    "POST /api/drafts rejects a stack-scoped state with INVALID_STATE_SCOPE",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/drafts",
        {
          method: "POST",
          body: {
            title: `QA Invalid Draft ${uniqueSuffix}`,
            stateId: "00000000-0000-4000-8000-000000000001",
          },
        },
      );
      assertStatus(status, 400, "invalid draft state scope");
      assertErrorCode(body, "INVALID_STATE_SCOPE");
    },
  );

  await recordCheck(
    context,
    "POST /api/drafts assigns an existing stack",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/drafts",
        {
          method: "POST",
          body: {
            title: `QA Stacked Draft ${uniqueSuffix}`,
            stackId: createdStackId,
          },
        },
      );
      assertStatus(status, 201, "create stacked draft");
      const draft = assertDraftShape(body);
      if (draft.stackId !== createdStackId) {
        throw new Error("stacked draft must echo stackId");
      }
    },
  );

  await recordCheck(
    context,
    "GET /api/drafts/:draftId returns DRAFT_NOT_FOUND for a missing draft",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/drafts/00000000-0000-4000-8000-00000000ffff",
      );
      assertStatus(status, 404, "missing draft");
      assertErrorCode(body, "DRAFT_NOT_FOUND");
    },
  );

  await recordCheck(
    context,
    "DELETE /api/states/:stateId rejects a state referenced by a draft",
    async () => {
      const referencedDraftStateId = "00000000-0000-4000-8000-000000000006";
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/drafts",
        {
          method: "POST",
          body: {
            title: `QA Referenced Draft ${uniqueSuffix}`,
            stateId: referencedDraftStateId,
          },
        },
      );
      assertStatus(status, 201, "create draft for state deletion check");
      const draft = assertDraftShape(body);
      if (draft.stateId !== referencedDraftStateId) {
        throw new Error("draft must use the referenced non-default state");
      }

      const deleteResponse = await requestJson(
        context.baseUrl,
        `/api/states/${referencedDraftStateId}`,
        {
          method: "DELETE",
        },
      );
      assertStatus(deleteResponse.status, 409, "delete referenced draft state");
      assertErrorCode(deleteResponse.body, "STATE_IN_USE");
    },
  );

  await recordCheck(
    context,
    "PATCH /api/drafts/:draftId updates the created draft",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/drafts/${createdDraftId}`,
        {
          method: "PATCH",
          body: {
            title: `QA Updated Draft ${uniqueSuffix}`,
            description: "Updated description.",
          },
        },
      );
      assertStatus(status, 200, "update draft");
      const draft = assertDraftShape(body);
      if (draft.title !== `QA Updated Draft ${uniqueSuffix}`) {
        throw new Error("updated draft must echo title");
      }
      if (draft.description !== "Updated description.") {
        throw new Error("updated draft must echo description");
      }
    },
  );

  await recordCheck(
    context,
    "PATCH /api/drafts/:draftId reassigns the draft to another draft state",
    async () => {
      const alternateDraftStateId = "00000000-0000-4000-8000-000000000006";
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/drafts/${createdDraftId}`,
        {
          method: "PATCH",
          body: {
            stateId: alternateDraftStateId,
          },
        },
      );
      assertStatus(status, 200, "reassign draft state");
      const draft = assertDraftShape(body);
      if (draft.stateId !== alternateDraftStateId) {
        throw new Error("updated draft must echo stateId");
      }

      const listResponse = await requestJson(
        context.baseUrl,
        `/api/drafts?stateId=${alternateDraftStateId}`,
      );
      assertStatus(listResponse.status, 200, "filter drafts by state");
      const listed = assertObject(listResponse.body, "filtered drafts body");
      if (!Array.isArray(listed.drafts)) {
        throw new Error('response must include a "drafts" array');
      }
      const found = listed.drafts.some((entry) => {
        const parsed = assertDraftShape(entry);
        return parsed.id === createdDraftId;
      });
      if (!found) {
        throw new Error("state filter must include the updated draft");
      }
    },
  );

  await recordCheck(
    context,
    "PATCH /api/drafts/:draftId returns a draft to standalone with null stackId",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/drafts/${createdDraftId}`,
        {
          method: "PATCH",
          body: {
            stackId: null,
          },
        },
      );
      assertStatus(status, 200, "unassign draft stack");
      const draft = assertDraftShape(body);
      if (draft.stackId !== null) {
        throw new Error("updated draft must have null stackId");
      }
    },
  );

  await recordCheck(
    context,
    "GET /api/drafts?stackId filters drafts assigned to the created stack",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/drafts?stackId=${createdStackId}`,
      );
      assertStatus(status, 200, "filter drafts by stack");
      const object = assertObject(body, "filtered drafts body");
      if (!Array.isArray(object.drafts)) {
        throw new Error('response must include a "drafts" array');
      }
      const stacked = object.drafts.find((entry) => {
        const parsed = assertDraftShape(entry);
        return parsed.stackId === createdStackId;
      });
      if (!stacked) {
        throw new Error("stack filter must include a stacked draft");
      }
    },
  );

  await recordCheck(
    context,
    "GET /api/drafts?stackId returns an empty collection for a missing stack",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        "/api/drafts?stackId=00000000-0000-4000-8000-00000000ffff",
      );
      assertStatus(status, 200, "filter drafts by missing stack");
      const object = assertObject(body, "filtered drafts body");
      if (!Array.isArray(object.drafts)) {
        throw new Error('response must include a "drafts" array');
      }
      if (object.drafts.length !== 0) {
        throw new Error("missing stack filter must return an empty collection");
      }
    },
  );

  await recordCheck(
    context,
    "PATCH /api/drafts/:draftId rejects an empty body with VALIDATION_ERROR",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/drafts/${createdDraftId}`,
        {
          method: "PATCH",
          body: {},
        },
      );
      assertStatus(status, 400, "empty draft update body");
      assertErrorCode(body, "VALIDATION_ERROR");
    },
  );

  await recordCheck(
    context,
    "PATCH /api/drafts/:draftId returns STACK_NOT_FOUND for a missing stack",
    async () => {
      const { status, body } = await requestJson(
        context.baseUrl,
        `/api/drafts/${createdDraftId}`,
        {
          method: "PATCH",
          body: {
            stackId: "00000000-0000-4000-8000-00000000ffff",
          },
        },
      );
      assertStatus(status, 404, "missing stack on draft update");
      assertErrorCode(body, "STACK_NOT_FOUND");
    },
  );
};

const waitForHealth = async (baseUrl: string): Promise<void> => {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const { status } = await requestJson(baseUrl, "/api/health");
      if (status === 200) {
        return;
      }
    } catch {
      // Retry until the API is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS));
  }

  throw new Error(`API did not become healthy within ${HEALTH_TIMEOUT_MS}ms`);
};

const pickPort = (): number => 18_080 + Math.floor(Math.random() * 1_000);

const drainStream = async (
  stream: ReadableStream<Uint8Array> | null,
  tailCharacters = 0,
): Promise<string> => {
  if (!stream) {
    return "";
  }

  // Child pipes must be consumed while the API is running or console output can
  // fill the OS buffer and block the server. Only stderr keeps a bounded tail.
  const reader = stream.getReader();
  const decoder = tailCharacters > 0 ? new TextDecoder() : null;
  let tail = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (decoder !== null) {
        tail = `${tail}${decoder.decode(value, { stream: true })}`.slice(
          -tailCharacters,
        );
      }
    }

    if (decoder !== null) {
      tail = `${tail}${decoder.decode()}`.slice(-tailCharacters);
    }

    return tail;
  } finally {
    reader.releaseLock();
  }
};

interface ManagedApi {
  readonly baseUrl: string;
  readonly stop: () => Promise<void>;
}

const startIsolatedApi = async (): Promise<ManagedApi> => {
  const tempDir = await Deno.makeTempDir({ prefix: "stackdraft-qa-" });
  const databasePath = join(tempDir, "stackdraft.sqlite");
  const port = pickPort();
  const host = "127.0.0.1";
  const baseUrl = `http://${host}:${port}`;

  const child = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-env",
      "--allow-net",
      "--allow-read",
      "--allow-write",
      apiEntryPath,
    ],
    cwd: projectRoot,
    env: {
      STACKDRAFT_HOST: host,
      STACKDRAFT_PORT: String(port),
      STACKDRAFT_DATABASE_PATH: databasePath,
    },
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  // Start both readers immediately, before health polling or request checks can
  // cause the child to emit enough output to apply pipe backpressure.
  const stdoutDrain = drainStream(child.stdout).catch(() => "");
  const stderrDrain = drainStream(
    child.stderr,
    CHILD_STDERR_TAIL_CHARACTERS,
  ).catch(() => "");

  let stopped = false;

  const stop = async (): Promise<void> => {
    if (stopped) {
      return;
    }

    stopped = true;

    try {
      child.kill("SIGTERM");
      await child.status;
    } catch {
      // The child may already have exited.
    }

    await Promise.all([stdoutDrain, stderrDrain]);

    try {
      await Deno.remove(tempDir, { recursive: true });
    } catch {
      // Best-effort cleanup for the temporary database directory.
    }
  };

  try {
    await waitForHealth(baseUrl);
  } catch (cause) {
    await stop();
    const stderr = await stderrDrain;
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      `${message}${stderr.length > 0 ? `\n${stderr.trim()}` : ""}`,
    );
  }

  return { baseUrl, stop };
};

const writeResults = async (result: SuiteResult): Promise<void> => {
  await Deno.mkdir("qa-results", { recursive: true });
  await Deno.writeTextFile(
    RESULTS_PATH,
    `${JSON.stringify(result, null, 2)}\n`,
  );
};

const runSuite = async (
  mode: SuiteMode,
  baseUrl: string,
): Promise<SuiteResult> => {
  const startedAt = new Date().toISOString();
  const context: SuiteContext = { mode, baseUrl, checks: [] };
  let passed = true;

  try {
    if (mode === "smoke") {
      await runSmokeChecks(context);
    } else {
      await runFullChecks(context);
    }
  } catch (cause) {
    if (!(cause instanceof CheckFailure)) {
      throw cause;
    }
    passed = false;
  }

  const finishedAt = new Date().toISOString();

  return {
    mode,
    baseUrl,
    startedAt,
    finishedAt,
    passed,
    checks: context.checks,
  };
};

const main = async (): Promise<number> => {
  const { mode, baseUrl: providedBaseUrl } = parseArgs();
  let managedApi: ManagedApi | null = null;
  let suiteResult: SuiteResult | null = null;
  let exitCode = 0;

  const cleanup = async (): Promise<void> => {
    if (managedApi) {
      await managedApi.stop();
      managedApi = null;
    }
  };

  const handleSignal = (signal: "SIGINT" | "SIGTERM") => {
    const exitCode = signal === "SIGINT" ? 130 : 143;

    void cleanup().finally(() => {
      Deno.exit(exitCode);
    });
  };

  const handleSigint = () => handleSignal("SIGINT");
  const handleSigterm = () => handleSignal("SIGTERM");

  Deno.addSignalListener("SIGINT", handleSigint);
  Deno.addSignalListener("SIGTERM", handleSigterm);

  try {
    const baseUrl = mode === "full"
      ? (managedApi = await startIsolatedApi()).baseUrl
      : (providedBaseUrl ?? DEFAULT_BASE_URL);

    suiteResult = await runSuite(mode, baseUrl);
    if (mode === "full") {
      await writeResults(suiteResult);
    }

    if (!suiteResult.passed) {
      exitCode = 1;
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error(`FAIL suite: ${message}`);
    exitCode = 1;
  } finally {
    Deno.removeSignalListener("SIGINT", handleSigint);
    Deno.removeSignalListener("SIGTERM", handleSigterm);
    await cleanup();
  }

  return exitCode;
};

if (import.meta.main) {
  Deno.exit(await main());
}
