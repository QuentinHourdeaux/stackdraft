import { Router } from "@oak/oak";
import { assertEquals } from "@std/assert";
import { formatApiRouteTree } from "../api/infrastructure/http/route-tree.ts";

Deno.test("formatApiRouteTree renders declared API routes from the Oak router", () => {
  const router = new Router();
  const handler = () => {};

  router.get("/api/health", handler);
  router.get("/api/states", handler);
  router.post("/api/states", handler);
  router.patch("/api/states/:stateId", handler);
  router.put("/api/states/:stateId/position", handler);
  router.get("/internal/metrics", handler);

  assertEquals(
    formatApiRouteTree(router),
    [
      "5 routes registered across 2 APIs",
      "├── /health",
      "│   └── GET",
      "└── /states",
      "    ├── GET",
      "    ├── POST",
      "    └── /:stateId",
      "        ├── PATCH",
      "        └── /position",
      "            └── PUT",
    ].join("\n"),
  );
});

Deno.test("formatApiRouteTree keeps explicitly registered HEAD routes", () => {
  const router = new Router();

  router.head("/api/health", () => {});

  assertEquals(
    formatApiRouteTree(router),
    [
      "1 route registered across 1 API",
      "└── /health",
      "    └── HEAD",
    ].join("\n"),
  );
});
