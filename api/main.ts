import { fromFileUrl, resolve } from "@std/path";
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
import { loadConfig } from "./config.ts";
import { makeStateStore } from "./infrastructure/database/state-store.ts";
import { closeSqlite, openSqlite } from "./infrastructure/database/sqlite.ts";
import { migrate } from "./infrastructure/database/migrate.ts";
import { createApp } from "./infrastructure/http/app.ts";
import { runLayerEffect } from "./lib/effect/run-effect.ts";
import { generateUuid } from "./lib/validation/uuid.ts";

const frontendDistPath = resolve(
  fromFileUrl(new URL("../dist/", import.meta.url)),
);

const main = async (): Promise<void> => {
  const config = await Effect.runPromise(loadConfig);
  const database = await Effect.runPromise(openSqlite(config.databasePath));

  try {
    await Effect.runPromise(migrate(database));

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
    });
    let cleanedUp = false;
    const cleanup = async (): Promise<void> => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      await Effect.runPromise(closeSqlite(database));
    };
    const stop = () => {
      void cleanup().finally(() => Deno.exit(0));
    };

    Deno.addSignalListener("SIGINT", stop);
    Deno.addSignalListener("SIGTERM", stop);

    try {
      console.log(
        `Stackdraft listening on http://${config.host}:${config.port}`,
      );

      await app.listen({
        hostname: config.host,
        port: config.port,
      });
    } finally {
      Deno.removeSignalListener("SIGINT", stop);
      Deno.removeSignalListener("SIGTERM", stop);
      await cleanup();
    }
  } finally {
    if (database.isOpen) {
      await Effect.runPromise(closeSqlite(database));
    }
  }
};

if (import.meta.main) {
  await main();
}
