import { fromFileUrl, resolve } from "@std/path";
import { Effect, ManagedRuntime } from "effect";
import { checkHealth, HealthServiceLive } from "./application/HealthService.ts";
import { loadConfig } from "./config.ts";
import { closeSqlite, openSqlite } from "./infrastructure/database/Sqlite.ts";
import { migrate } from "./infrastructure/database/migrate.ts";
import { createApp } from "./infrastructure/http/app.ts";

const frontendDistPath = resolve(
  fromFileUrl(new URL("../dist/", import.meta.url)),
);

const main = async (): Promise<void> => {
  const config = await Effect.runPromise(loadConfig);
  const database = await Effect.runPromise(openSqlite(config.databasePath));

  try {
    await Effect.runPromise(migrate(database));

    const runtime = ManagedRuntime.make(HealthServiceLive(database));
    const app = createApp({
      checkHealth: () => runtime.runPromise(checkHealth),
      frontendDistPath,
    });
    let cleanedUp = false;
    const cleanup = async (): Promise<void> => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      await runtime.dispose();
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
