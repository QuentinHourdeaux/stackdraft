import { fromFileUrl, resolve } from "@std/path";
import { Effect, Layer } from "effect";
import {
  checkHealth,
  HealthServiceLive,
} from "./application/health-service.ts";
import {
  createState,
  listStatesByScopeValues,
  makeStateService,
  moveState,
  selectDefaultState,
  StateService,
  updateState,
} from "./application/state-service.ts";
import { StateRepository } from "./application/state-repository.ts";
import { loadConfig } from "./config.ts";
import { makeStateRepository } from "./infrastructure/database/state-repository.ts";
import { closeSqlite, openSqlite } from "./infrastructure/database/sqlite.ts";
import { migrate } from "./infrastructure/database/migrate.ts";
import { createApp } from "./infrastructure/http/app.ts";
import { runLayerEffect } from "./infrastructure/http/run-effect.ts";

const frontendDistPath = resolve(
  fromFileUrl(new URL("../dist/", import.meta.url)),
);

const main = async (): Promise<void> => {
  const config = await Effect.runPromise(loadConfig);
  const database = await Effect.runPromise(openSqlite(config.databasePath));

  try {
    await Effect.runPromise(migrate(database));

    const stateServiceDependencies = {
      generateId: () => crypto.randomUUID(),
      now: () => new Date(),
    };
    const stateRepository = makeStateRepository(database);
    const appLayer = Layer.mergeAll(
      HealthServiceLive(database),
      Layer.succeed(StateRepository, stateRepository),
      Layer.succeed(
        StateService,
        makeStateService(stateRepository, stateServiceDependencies),
      ),
    );
    const runAppEffect = runLayerEffect(appLayer);
    const app = createApp({
      checkHealth: () => runAppEffect(checkHealth),
      listStates: (scopeValues) =>
        runAppEffect(listStatesByScopeValues(scopeValues)),
      createState: (input) => runAppEffect(createState(input)),
      updateState: (stateId, input) =>
        runAppEffect(updateState(stateId, input)),
      moveState: (stateId, input) => runAppEffect(moveState(stateId, input)),
      selectDefaultState: (stateId) =>
        runAppEffect(selectDefaultState(stateId)),
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
