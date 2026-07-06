import { assertEquals } from "@std/assert";
import { Effect } from "effect";
import { makeHealthService } from "../api/application/HealthService.ts";

Deno.test("health service reports a working database", async () => {
  const service = makeHealthService({
    prepare: () =>
      ({
        get: () => ({ "1": 1 }),
      }) as never,
  });

  assertEquals(await Effect.runPromise(service.check), {
    status: "ok",
    database: "ok",
  });
});

Deno.test("health service returns a typed failure", async () => {
  const cause = new Error("database unavailable");
  const service = makeHealthService({
    prepare: () => {
      throw cause;
    },
  });

  const result = await Effect.runPromise(Effect.either(service.check));

  assertEquals(result._tag, "Left");
  if (result._tag === "Left") {
    assertEquals(result.left._tag, "HealthError");
    assertEquals(result.left.cause, cause);
  }
});
