import { assertEquals, assertExists } from "@std/assert";
import { createApp } from "../api/infrastructure/http/app.ts";

Deno.test("health endpoint returns 200 when dependencies are ready", async () => {
  const app = createApp({
    checkHealth: () =>
      Promise.resolve({ status: "ok", database: "ok" } as const),
    frontendDistPath: "./dist",
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/health"),
  );

  assertExists(response);
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    status: "ok",
    database: "ok",
  });
});

Deno.test("health endpoint returns 503 when a dependency fails", async () => {
  const app = createApp({
    checkHealth: () => Promise.reject(new Error("database unavailable")),
    frontendDistPath: "./dist",
  });

  const response = await app.handle(
    new Request("http://stackdraft.local/api/health"),
  );

  assertExists(response);
  assertEquals(response.status, 503);
  assertEquals(await response.json(), {
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "Stackdraft is not ready.",
      details: {},
    },
  });
});
