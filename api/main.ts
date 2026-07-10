import { fromFileUrl, resolve } from "@std/path";
import type { DatabaseSync } from "node:sqlite";
import { Effect, Layer } from "effect";
import { checkHealth, HealthServiceLive } from "./core/health/service.ts";
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
import { makeStateStore } from "./infrastructure/database/state-store.ts";
import { closeSqlite, openSqlite } from "./infrastructure/database/sqlite.ts";
import { migrate } from "./infrastructure/database/migrate.ts";
import { createApp } from "./infrastructure/http/app.ts";
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

  // Nested listen and startup boundaries share these flags so a failure is
  // reported once, while runtime shutdown failures are not mislabeled startup.
  let startupCompleted = false;
  let startupFailureLogged = false;

  try {
    await Effect.runPromise(migrate(database, { logger: rootLogger }));

    const stateServiceDependencies = {
      generateId: generateUuid,
      now: () => new Date(),
    };
    const stateStore = makeStateStore(database);
    const appLayer = Layer.mergeAll(
      HealthServiceLive(database),
      Layer.succeed(StateStore, stateStore),
      Layer.succeed(
        StateService,
        makeStateService(stateStore, stateServiceDependencies),
      ),
    );
    const runAppEffect = runLayerEffect(appLayer);
    const app = createApp({
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
      frontendDistPath,
      // This is opt-in developer UI, not an operational log. Keeping it outside
      // the logger prevents future remote sinks from ingesting the route tree.
      writeRouteTree: config.printRoutes
        ? (tree) => console.log(tree)
        : undefined,
    });
    // Signal handlers and app.listen's finally block can race into cleanup.
    // Sharing the in-flight promise closes SQLite and logs shutdown exactly once.
    let cleanupPromise: Promise<void> | undefined;
    const cleanup = async (): Promise<void> => {
      if (cleanupPromise !== undefined) {
        return await cleanupPromise;
      }

      const shutdownLogger = rootLogger.with({
        service: "app",
        method: "shutdown",
      });
      cleanupPromise = (async () => {
        shutdownLogger.info({
          event: "app_shutdown_started",
          message: "Started Stackdraft shutdown cleanup.",
        });

        try {
          await Effect.runPromise(closeSqlite(database));
          shutdownLogger.info({
            event: "app_shutdown_completed",
            message: "Completed Stackdraft shutdown cleanup.",
            outcome: "success",
          });
        } catch (cause) {
          shutdownLogger.error({
            event: "app_shutdown_failed",
            message: "Stackdraft shutdown cleanup failed.",
            outcome: "failure",
            cause,
          });
          throw cause;
        }
      })();

      return await cleanupPromise;
    };
    const stop = () => {
      // Do not exit until the database cleanup and its final log have completed.
      void cleanup().then(
        () => Deno.exit(0),
        () => Deno.exit(1),
      );
    };

    Deno.addSignalListener("SIGINT", stop);
    Deno.addSignalListener("SIGTERM", stop);

    // Oak's listen event fires only after binding succeeds. Logging here avoids
    // claiming the app started when the configured port is unavailable.
    app.addEventListener("listen", () => {
      rootLogger.info({
        event: "app_started",
        message: "Stackdraft started.",
        outcome: "success",
        fields: operationalFields,
      });
      startupCompleted = true;
    }, { once: true });

    try {
      await app.listen({
        hostname: config.host,
        port: config.port,
      });
    } catch (cause) {
      if (!startupCompleted) {
        rootLogger.error({
          event: "app_startup_failed",
          message: "Stackdraft startup failed.",
          outcome: "failure",
          fields: operationalFields,
          cause,
        });
        startupFailureLogged = true;
      }
      throw cause;
    } finally {
      Deno.removeSignalListener("SIGINT", stop);
      Deno.removeSignalListener("SIGTERM", stop);
      await cleanup();
    }
  } catch (cause) {
    if (!startupCompleted && !startupFailureLogged) {
      rootLogger.error({
        event: "app_startup_failed",
        message: "Stackdraft startup failed.",
        outcome: "failure",
        fields: operationalFields,
        cause,
      });
    }
    throw cause;
  } finally {
    if (database.isOpen) {
      await Effect.runPromise(closeSqlite(database));
    }
  }
};

if (import.meta.main) {
  try {
    await main();
  } catch {
    Deno.exit(1);
  }
}
