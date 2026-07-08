import { assertEquals, assertMatch } from "@std/assert";
import { generateUuid, isUuid } from "../api/lib/validation/uuid.ts";

Deno.test("isUuid validates UUID strings", () => {
  assertEquals(isUuid("00000000-0000-4000-8000-000000000001"), true);
  assertEquals(isUuid("not-a-uuid"), false);
});

Deno.test("generateUuid returns a valid UUID", () => {
  const id = generateUuid();

  assertEquals(isUuid(id), true);
  assertMatch(id, /^[0-9a-f-]+$/);
});
