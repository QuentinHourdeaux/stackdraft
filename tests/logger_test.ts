import { assert, assertEquals } from "@std/assert";
import {
  createLogger,
  type LogDestination,
  type Logger,
  noopLogger,
} from "../api/lib/logging/logger.ts";
import type { LogLevel } from "../api/lib/logging/events.ts";

interface WrittenLine {
  readonly destination: LogDestination;
  readonly line: string;
}

const fixedNow = new Date("2026-07-10T12:00:00.000Z");

const recordingLogger = (
  minimumLevel: LogLevel = "debug",
): { readonly logger: Logger; readonly written: WrittenLine[] } => {
  const written: WrittenLine[] = [];
  const logger = createLogger({
    minimumLevel,
    context: { service: "app", method: "main" },
    now: () => fixedNow,
    write: (destination, line) => written.push({ destination, line }),
  });

  return { logger, written };
};

const parseLine = (
  written: WrittenLine[],
  index = 0,
): Record<string, unknown> =>
  JSON.parse(written[index]?.line ?? "") as Record<string, unknown>;

Deno.test("logger emits stable JSON fields to the level destination", () => {
  const { logger, written } = recordingLogger();

  logger.info({
    event: "app_started",
    message: "Started Stackdraft.",
    outcome: "success",
    fields: {
      host: "127.0.0.1",
      port: 8000,
      empty: "",
      missing: undefined,
      invalidNumber: Number.NaN,
    },
  });
  logger.warn({
    event: "request_completed",
    message: "Completed HTTP request.",
    httpStatus: 404,
    durationMs: 4,
    outcome: "failure",
  });

  assertEquals(written.length, 2);
  assertEquals(written[0]?.destination, "stdout");
  assertEquals(parseLine(written), {
    timestamp: "2026-07-10T12:00:00.000Z",
    level: "info",
    service: "app",
    method: "main",
    event: "app_started",
    message: "Started Stackdraft.",
    outcome: "success",
    fields: {
      host: "127.0.0.1",
      port: 8000,
    },
  });
  assertEquals(written[1]?.destination, "stderr");
});

Deno.test("logger filters entries below its configured minimum level", () => {
  const expectations: Readonly<Record<LogLevel, readonly LogLevel[]>> = {
    debug: ["debug", "info", "warn", "error"],
    info: ["info", "warn", "error"],
    warn: ["warn", "error"],
    error: ["error"],
  };

  for (const minimumLevel of Object.keys(expectations) as LogLevel[]) {
    const { logger, written } = recordingLogger(minimumLevel);
    const input = {
      event: "app_started" as const,
      message: "Level test.",
    };

    logger.debug(input);
    logger.info(input);
    logger.warn(input);
    logger.error(input);

    assertEquals(
      written.map((entry) => parseLine([entry]).level),
      [...expectations[minimumLevel]],
    );
  }
});

Deno.test("with merges context immutably and de-duplicates resources", () => {
  const { logger, written } = recordingLogger();
  const stateId = "00000000-0000-4000-8000-000000000001";
  const parent = logger.with({
    service: "http",
    method: "request",
    route: "GET /api/states",
    requestId: "request-1",
    resources: [{ type: "state", id: stateId }],
  });
  const child = parent.with({
    service: "state",
    method: "deleteState",
    route: "",
    requestId: "",
    resources: [
      { type: "state", id: stateId },
      { type: "draft", id: "00000000-0000-4000-8000-000000000002" },
      { type: "stack", id: "" },
    ],
  });

  parent.info({ event: "request_completed", message: "Parent." });
  child.error({ event: "state_persistence_failed", message: "Child." });

  assertEquals(parseLine(written), {
    timestamp: fixedNow.toISOString(),
    level: "info",
    service: "http",
    method: "request",
    route: "GET /api/states",
    requestId: "request-1",
    resources: [{ type: "state", id: stateId }],
    event: "request_completed",
    message: "Parent.",
  });
  assertEquals(parseLine(written, 1), {
    timestamp: fixedNow.toISOString(),
    level: "error",
    service: "state",
    method: "deleteState",
    route: "GET /api/states",
    requestId: "request-1",
    resources: [
      { type: "state", id: stateId },
      { type: "draft", id: "00000000-0000-4000-8000-000000000002" },
    ],
    event: "state_persistence_failed",
    message: "Child.",
  });
});

Deno.test("logger serializes tagged nested errors without stacks at info level", () => {
  const { logger, written } = recordingLogger("info");
  const inner = new Error("database unavailable");
  const tagged = Object.assign(new Error("State persistence failed"), {
    _tag: "UnknownStateStoreError",
    cause: inner,
  });

  logger.error({
    event: "state_persistence_failed",
    message: "Could not persist State.",
    cause: tagged,
  });

  const entry = parseLine(written);
  assertEquals(entry.error, {
    name: "Error",
    message: "State persistence failed",
    _tag: "UnknownStateStoreError",
    cause: {
      name: "Error",
      message: "database unavailable",
    },
  });
});

Deno.test("debug configuration includes bounded error stacks and safe unknown causes", () => {
  const { logger, written } = recordingLogger("debug");
  const cause = new Error("boom");
  cause.stack = `Error: boom\n${"x".repeat(800)}`;

  logger.error({
    event: "app_startup_failed",
    message: "Startup failed.",
    cause,
  });

  const error = parseLine(written).error as { stack?: string };
  assert(error.stack?.endsWith("…"));
  assertEquals(error.stack?.length, 500);

  const hostile = new Proxy({}, {
    get() {
      throw new Error("blocked");
    },
  });
  logger.error({
    event: "app_startup_failed",
    message: "Startup failed safely.",
    cause: hostile,
  });

  assertEquals(parseLine(written, 1).error, {
    text: "[unserializable cause]",
  });
});

Deno.test("logger catalogs reject ad hoc values during type checking", () => {
  const typeCheckInvalidCatalogValues = (): void => {
    // @ts-expect-error Log events must come from the static catalog.
    noopLogger.info({ event: "made_up_event", message: "Invalid." });
    // @ts-expect-error Log services must come from the static catalog.
    noopLogger.with({ service: "made-up-service" });
    // @ts-expect-error Log resources must come from the static catalog.
    noopLogger.with({ resources: [{ type: "made-up-resource", id: "id" }] });
    noopLogger.info({
      event: "app_started",
      message: "Invalid.",
      // @ts-expect-error Log outcomes must come from the static catalog.
      outcome: "maybe",
    });
  };

  assertEquals(typeof typeCheckInvalidCatalogValues, "function");
  assertEquals(noopLogger.with({ service: "app" }), noopLogger);
});
