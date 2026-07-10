import { fromFileUrl, resolve } from "@std/path";
import type { DatabaseSync } from "node:sqlite";
import { Effect, Layer } from "effect";
import { checkHealth, HealthServiceLive } from "./core/health/service.ts";
import {
  createStack,
  getStack,
  listStacks,
  StackService,
  updateStack,
} from "./core/stack/service.ts";
import { makeStackService } from "./core/stack/service-live.ts";
import { StackStore } from "./core/stack/store.ts";
import {
  createState,
  deleteState,
  listStatesByScope,
  moveState,
  selectDefaultState,
  StateService,
  updateState,
} from "./core/state/service.ts";
import { StateStore } from "./core/state/store.ts";
import { makeStateService } from "./core/state/service-live.ts";
import { type AppConfig, classifyDatabasePath, loadConfig } from "./config.ts";
import { makeStackStore } from "./infrastructure/database/stack-store.ts";
import { makeStateStore } from "./infrastructure/database/state-store.ts";
import { closeSqlite, openSqlite } from "./infrastructure/database/sqlite.ts";
import { migrate } from "./infrastructure/database/migrate.ts";
import { createApp } from "./infrastructure/http/app.ts";
import { runApplicationLifecycle } from "./infrastructure/http/lifecycle.ts";
import { runLayerEffect } from "./lib/effect/run-effect.ts";
import { createLogger } from "./lib/logging/logger.ts";
import { generateUuid } from "./lib/validation/uuid.ts";

const frontendDistPath = resolve(
  fromFileUrl(new URL("../dist/", import.meta.url)),
);

const main = async (): Promise<void> => {
  let config: AppConfig;

  try {
    config = await Effect.runPromise(loadConfig);
  } catch (cause) {
    // Configuration owns the desired log level, so use a safe default to ensure
    // even invalid configuration produces one structured startup failure.
    createLogger({
      minimumLevel: "info",
      context: { service: "app", method: "loadConfig" },
    }).error({
      event: "app_startup_failed",
      message: "Stackdraft configuration failed.",
      outcome: "failure",
      cause,
    });
    throw cause;
  }

  const rootLogger = createLogger({
    minimumLevel: config.logLevel,
    context: { service: "app", method: "main" },
  });
  // Startup events include enough deployment context to diagnose an instance
  // without exposing the configured database path.
  const operationalFields = {
    host: config.host,
    port: config.port,
    configuredLogLevel: config.logLevel,
    databasePathCategory: classifyDatabasePath(config.databasePath),
  };
  let database: DatabaseSync;

  try {
    database = await Effect.runPromise(openSqlite(config.databasePath));
  } catch (cause) {
    rootLogger.error({
      event: "app_startup_failed",
      message: "Stackdraft startup failed.",
      outcome: "failure",
      fields: operationalFields,
      cause,
    });
    throw cause;
  }

  let app: ReturnType<typeof createApp> | undefined;
  try {
    await Effect.runPromise(migrate(database, { logger: rootLogger }));

    const stateServiceDependencies = {
      generateId: generateUuid,
      now: () => new Date(),
    };
    const stateStore = makeStateStore(database);
    const stackStore = makeStackStore(database);
    const appLayer = Layer.mergeAll(
      HealthServiceLive(database),
      Layer.succeed(StateStore, stateStore),
      Layer.succeed(
        StateService,
        makeStateService(stateStore, stateServiceDependencies),
      ),
      Layer.succeed(StackStore, stackStore),
      Layer.succeed(
        StackService,
        makeStackService(stackStore, stateServiceDependencies),
      ),
    );
    const runAppEffect = runLayerEffect(appLayer);
    app = createApp({
      logger: rootLogger.with({ service: "http", method: "request" }),
      checkHealth: () => runAppEffect(checkHealth),
      listStates: (scope) => runAppEffect(listStatesByScope(scope)),
      createState: (input) => runAppEffect(createState(input)),
      updateState: (stateId, input) =>
        runAppEffect(updateState(stateId, input)),
      moveState: (stateId, input) => runAppEffect(moveState(stateId, input)),
      selectDefaultState: (stateId) =>
        runAppEffect(selectDefaultState(stateId)),
      deleteState: (stateId) => runAppEffect(deleteState(stateId)),
      listStacks: (filter) => runAppEffect(listStacks(filter)),
      getStack: (stackId) => runAppEffect(getStack(stackId)),
      createStack: (input) => runAppEffect(createStack(input)),
      updateStack: (stackId, input) =>
        runAppEffect(updateStack(stackId, input)),
      frontendDistPath,
      // This is opt-in developer UI, not an operational log. Keeping it outside
      // the logger prevents future remote sinks from ingesting the route tree.
      writeRouteTree: config.printRoutes
        ? (tree) => console.log(tree)
        : undefined,
    });
  } catch (cause) {
    rootLogger.error({
      event: "app_startup_failed",
      message: "Stackdraft startup failed.",
      outcome: "failure",
      fields: operationalFields,
      cause,
    });
    throw cause;
  } finally {
    // Before the lifecycle takes ownership, setup failures still need to close
    // the database. Successful setup leaves cleanup to the lifecycle module.
    if (app === undefined && database.isOpen) {
      await Effect.runPromise(closeSqlite(database));
    }
  }

  await runApplicationLifecycle({
    server: {
      onListen: (listener) =>
        app.addEventListener("listen", listener, { once: true }),
      listen: (options) => app.listen(options),
    },
    listenOptions: {
      hostname: config.host,
      port: config.port,
    },
    logger: rootLogger,
    operationalFields,
    close: () => Effect.runPromise(closeSqlite(database)),
  });
};

if (import.meta.main) {
  try {
    await main();
  } catch {
    Deno.exit(1);
  }
}
