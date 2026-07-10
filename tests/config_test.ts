import { assertEquals } from "@std/assert";
import { Effect } from "effect";
import {
  classifyDatabasePath,
  CONTAINER_DATABASE_PATH,
  DEFAULT_DEV_DATABASE_PATH,
  DEFAULT_PROD_HOST_DATABASE_PATH,
  loadConfig,
} from "../api/config.ts";

const CONFIG_ENV_KEYS = [
  "STACKDRAFT_HOST",
  "STACKDRAFT_PORT",
  "STACKDRAFT_DATABASE_PATH",
  "STACKDRAFT_LOG_LEVEL",
] as const;

function withConfigEnv(
  values: Partial<Record<(typeof CONFIG_ENV_KEYS)[number], string>>,
  run: () => Promise<void> | void,
): Promise<void> {
  const saved = new Map<string, string | undefined>();

  for (const key of CONFIG_ENV_KEYS) {
    saved.set(key, Deno.env.get(key));
    Deno.env.delete(key);
  }

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      Deno.env.set(key, value);
    }
  }

  return Promise.resolve(run()).finally(() => {
    for (const key of CONFIG_ENV_KEYS) {
      const value = saved.get(key);
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  });
}

Deno.test("loadConfig defaults to the development database path", async () => {
  await withConfigEnv({}, async () => {
    const config = await Effect.runPromise(loadConfig);

    assertEquals(config.host, "127.0.0.1");
    assertEquals(config.port, 8000);
    assertEquals(config.databasePath, DEFAULT_DEV_DATABASE_PATH);
    assertEquals(config.logLevel, "info");
  });
});

Deno.test("loadConfig reads environment overrides", async () => {
  await withConfigEnv(
    {
      STACKDRAFT_HOST: "0.0.0.0",
      STACKDRAFT_PORT: "9001",
      STACKDRAFT_DATABASE_PATH: "/tmp/custom.sqlite",
      STACKDRAFT_LOG_LEVEL: "debug",
    },
    async () => {
      const config = await Effect.runPromise(loadConfig);

      assertEquals(config.host, "0.0.0.0");
      assertEquals(config.port, 9001);
      assertEquals(config.databasePath, "/tmp/custom.sqlite");
      assertEquals(config.logLevel, "debug");
    },
  );
});

Deno.test("config exports document the dev and prod database paths", () => {
  assertEquals(DEFAULT_DEV_DATABASE_PATH, "./data/dev/stackdraft.sqlite");
  assertEquals(
    DEFAULT_PROD_HOST_DATABASE_PATH,
    "./data/prod/stackdraft.sqlite",
  );
  assertEquals(CONTAINER_DATABASE_PATH, "/data/stackdraft.sqlite");
});

Deno.test("classifyDatabasePath returns only safe operational categories", () => {
  assertEquals(
    classifyDatabasePath("./data/dev/experiment.sqlite"),
    "development",
  );
  assertEquals(
    classifyDatabasePath("./data/prod/stackdraft.sqlite"),
    "production",
  );
  assertEquals(classifyDatabasePath(CONTAINER_DATABASE_PATH), "container");
  assertEquals(classifyDatabasePath("/tmp/private/database.sqlite"), "custom");
});
