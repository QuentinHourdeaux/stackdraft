import { assertEquals, assertRejects } from "@std/assert";
import { apiError } from "../api/lib/http/api-error.ts";
import { routeHandler, setJsonResponse } from "../api/lib/http/response.ts";
import { ValidationError } from "../api/core/errors.ts";

const makeContext = () => ({
  response: {
    status: 0,
    type: undefined as string | undefined,
    body: undefined as unknown,
  },
});

Deno.test("setJsonResponse writes status, type, and body", () => {
  const context = makeContext();

  setJsonResponse(context, 201, { ok: true });

  assertEquals(context.response, {
    status: 201,
    type: "json",
    body: { ok: true },
  });
});

Deno.test("routeHandler maps expected API errors", async () => {
  const context = makeContext();
  const handler = routeHandler(
    (cause) =>
      cause instanceof ValidationError
        ? {
          status: 400,
          body: apiError("VALIDATION_ERROR", "The request is invalid."),
        }
        : null,
    () => {
      throw new ValidationError({ fields: { name: "Name is required." } });
    },
  );

  await handler(context);

  assertEquals(context.response.status, 400);
  assertEquals(context.response.type, "json");
  assertEquals(context.response.body, {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: {},
    },
  });
});

Deno.test("routeHandler rethrows unmapped failures", async () => {
  const context = makeContext();
  const failure = new Error("unexpected");
  const handler = routeHandler(
    () => null,
    () => {
      throw failure;
    },
  );

  await assertRejects(() => handler(context), Error, "unexpected");
});
