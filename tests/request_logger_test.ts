import { Application, Router } from "@oak/oak";
import { assertEquals, assertExists, assertMatch } from "@std/assert";
import { HealthError, UnknownStateStoreError } from "../api/core/errors.ts";
import { createApp } from "../api/infrastructure/http/app.ts";
import {
  createLogger,
  type LogDestination,
  type Logger,
} from "../api/lib/logging/logger.ts";
import {
  createRequestLogger,
  type LoggingState,
} from "../api/lib/logging/request-logger.ts";

interface WrittenLine {
  readonly destination: LogDestination;
  readonly entry: Record<string, unknown>;
}

const recordingLogger = (): {
  readonly logger: Logger;
  readonly written: WrittenLine[];
} => {
  const written: WrittenLine[] = [];
  const logger = createLogger({
    minimumLevel: "debug",
    context: { service: "http", method: "request" },
    now: () => new Date("2026-07-10T12:00:00.000Z"),
    write: (destination, line) => {
      written.push({
        destination,
        entry: JSON.parse(line) as Record<string, unknown>,
      });
    },
  });

  return { logger, written };
};

Deno.test("request logger records a matched route without query values", async () => {
  const { logger, written } = recordingLogger();
  const ticks = [10, 14];
  const app = new Application<LoggingState>({ state: { logger } });
  const router = new Router<LoggingState>();
  router.get("/api/states/:stateId", (context) => {
    context.response.status = 200;
  });

  app.use(createRequestLogger({
    logger,
    generateRequestId: () => "00000000-0000-4000-8000-000000000001",
    nowMilliseconds: () => ticks.shift() ?? 14,
  }));
  app.use(router.routes());

  const response = await app.handle(
    new Request("http://stackdraft.local/api/states/secret-id?token=secret"),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(written, [{
    destination: "stdout",
    entry: {
      timestamp: "2026-07-10T12:00:00.000Z",
      level: "info",
      service: "http",
      method: "request",
      route: "GET /api/states/:stateId",
      requestId: "00000000-0000-4000-8000-000000000001",
      event: "request_completed",
      message: "Completed HTTP request.",
      httpStatus: 200,
      durationMs: 4,
      outcome: "success",
    },
  }]);
});

Deno.test("request logger writes handled client errors to stderr", async () => {
  const { logger, written } = recordingLogger();
  const app = new Application<LoggingState>({ state: { logger } });

  app.use(createRequestLogger({
    logger,
    generateRequestId: () => "request-404",
    nowMilliseconds: () => 10,
  }));

  const response = await app.handle(
    new Request("http://stackdraft.local/missing?private=value"),
  );

  assertExists(response);
  assertEquals(response.status, 404);
  assertEquals(written.length, 1);
  assertEquals(written[0]?.destination, "stderr");
  assertEquals(written[0]?.entry.route, "GET /missing");
  assertEquals(written[0]?.entry.level, "warn");
  assertEquals(written[0]?.entry.outcome, "failure");
});

Deno.test("health failures retain request context without dependency details", async () => {
  const { logger, written } = recordingLogger();
  const dependencySentinel = "open /private/secret/customer.sqlite";
  const app = createApp({
    logger,
    checkHealth: () =>
      Promise.reject(
        new HealthError({ cause: new Error(dependencySentinel) }),
      ),
    listStates: () => Promise.resolve([]),
    createState: () => Promise.reject(new Error("not called")),
    updateState: () => Promise.reject(new Error("not called")),
    moveState: () => Promise.resolve([]),
    selectDefaultState: () => Promise.reject(new Error("not called")),
    deleteState: () => Promise.resolve(),
    listStacks: () => Promise.resolve([]),
    getStack: () => Promise.reject(new Error("not called")),
    createStack: () => Promise.reject(new Error("not called")),
    frontendDistPath: "./dist",
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/health"),
  );

  assertExists(response);
  assertEquals(response.status, 503);
  assertEquals(written.length, 2);

  const healthFailure = written[0]?.entry;
  const completion = written[1]?.entry;
  assertEquals(healthFailure?.event, "health_check_failed");
  assertEquals(healthFailure?.service, "health");
  assertEquals(healthFailure?.method, "check");
  assertEquals(healthFailure?.route, "GET /api/health");
  assertMatch(String(healthFailure?.requestId), /^[0-9a-f-]{36}$/);
  const healthError = healthFailure?.error as
    | Record<string, unknown>
    | undefined;
  assertEquals(healthError?.name, "HealthError");
  assertEquals(healthError?._tag, "HealthError");
  assertEquals(completion?.event, "request_completed");
  assertEquals(completion?.requestId, healthFailure?.requestId);
  assertEquals(completion?.httpStatus, 503);
  assertEquals(JSON.stringify(written).includes(dependencySentinel), false);
});

Deno.test("request logger emits exactly one failure before 500 mapping", async () => {
  const { logger, written } = recordingLogger();
  const app = new Application<LoggingState>({ state: { logger } });

  app.use(async (context, next) => {
    try {
      await next();
    } catch {
      context.response.status = 500;
      context.response.body = "safe";
    }
  });
  app.use(createRequestLogger({
    logger,
    generateRequestId: () => "request-500",
    nowMilliseconds: () => 10,
  }));
  app.use(() => {
    throw new Error("dependency secret");
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/explode"),
  );

  assertExists(response);
  assertEquals(response.status, 500);
  assertEquals(await response.text(), "safe");
  assertEquals(written.length, 1);
  assertEquals(written[0]?.destination, "stderr");
  assertEquals(written[0]?.entry.event, "request_failed");
  assertEquals(written[0]?.entry.httpStatus, 500);
  assertEquals(written[0]?.entry.outcome, "failure");
  assertEquals(JSON.stringify(written).includes("dependency secret"), false);
});

Deno.test("request outcomes survive logger sink failures", async () => {
  const logger = createLogger({
    minimumLevel: "info",
    context: { service: "http", method: "request" },
    write: () => {
      throw new Error("sink unavailable");
    },
  });
  const app = new Application<LoggingState>({ state: { logger } });

  app.use(createRequestLogger({ logger }));
  app.use((context) => {
    context.response.status = 204;
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/health"),
  );

  assertExists(response);
  assertEquals(response.status, 204);
});

Deno.test("State persistence log inherits request and resource context", async () => {
  const { logger, written } = recordingLogger();
  const stateId = "00000000-0000-4000-8000-000000000001";
  const app = createApp({
    logger,
    checkHealth: () =>
      Promise.resolve({ status: "ok", database: "ok" } as const),
    listStates: () => Promise.resolve([]),
    createState: () => Promise.reject(new Error("not called")),
    updateState: () =>
      Promise.reject(
        new UnknownStateStoreError({
          cause: new Error("database unavailable"),
        }),
      ),
    moveState: () => Promise.resolve([]),
    selectDefaultState: () => Promise.reject(new Error("not called")),
    deleteState: () => Promise.resolve(),
    listStacks: () => Promise.resolve([]),
    getStack: () => Promise.reject(new Error("not called")),
    createStack: () => Promise.reject(new Error("not called")),
    frontendDistPath: "./dist",
  });

  const response = await app.handle(
    new Request(`http://stackdraft.local/api/states/${stateId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Scheduled" }),
    }),
  );

  assertExists(response);
  assertEquals(response.status, 500);
  assertEquals(written.length, 2);

  const persistence = written[0]?.entry;
  const completion = written[1]?.entry;
  assertEquals(persistence?.event, "state_persistence_failed");
  assertEquals(persistence?.service, "state");
  assertEquals(persistence?.method, "updateState");
  assertEquals(persistence?.route, "PATCH /api/states/:stateId");
  assertEquals(persistence?.resources, [{ type: "state", id: stateId }]);
  assertMatch(String(persistence?.requestId), /^[0-9a-f-]{36}$/);
  assertEquals(completion?.event, "request_completed");
  assertEquals(completion?.requestId, persistence?.requestId);
  assertEquals(completion?.httpStatus, 500);
});
