import { fromFileUrl, join, resolve } from "@std/path";
import type { State } from "../api/domain/state/state.ts";
import { isStateScope } from "../api/domain/state/state.ts";

const DEFAULT_BASE_URL = "http://127.0.0.1:8000";
const RESULTS_PATH = "qa-results/api-suite.json";
const HEALTH_TIMEOUT_MS = 30_000;
const HEALTH_POLL_MS = 100;
const STDERR_READ_TIMEOUT_MS = 2_000;

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

const assertStateShape = (value: unknown): State => {
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
};

const runFullChecks = async (context: SuiteContext): Promise<void> => {
  const uniqueSuffix = crypto.randomUUID().slice(0, 8);
  const createdName = `QA State ${uniqueSuffix}`;
  const updatedName = `QA Updated ${uniqueSuffix}`;
  const createdColor = "#aabbcc";
  const updatedColor = "#ccddee";
  let createdStateId = "";

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

const readStreamText = async (
  stream: ReadableStream<Uint8Array> | null,
  timeoutMs: number,
): Promise<string> => {
  if (!stream) {
    return "";
  }

  const read = new Response(stream).text();
  const timeout = new Promise<string>((resolve) => {
    setTimeout(() => resolve(""), timeoutMs);
  });

  return await Promise.race([read, timeout]);
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
    const stderr = await readStreamText(
      child.stderr,
      STDERR_READ_TIMEOUT_MS,
    );
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

  const handleSignal = () => {
    void cleanup().finally(() => {
      Deno.exit(suiteResult?.passed === false ? 1 : 0);
    });
  };

  Deno.addSignalListener("SIGINT", handleSignal);
  Deno.addSignalListener("SIGTERM", handleSignal);

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
    Deno.removeSignalListener("SIGINT", handleSignal);
    Deno.removeSignalListener("SIGTERM", handleSignal);
    await cleanup();
  }

  return exitCode;
};

if (import.meta.main) {
  Deno.exit(await main());
}
