import { Application, Router } from "@oak/oak";
import type { HealthStatus } from "../../core/health/service.ts";
import type {
  CreateStateInput,
  MoveStateInput,
  UpdateStateInput,
} from "../../core/state/input.ts";
import type { CreateStackInput } from "../../core/stack/input.ts";
import type { State } from "../../defs/state/state.ts";
import type { Stack } from "../../defs/stack/stack.ts";
import { apiError } from "../../lib/http/api-error.ts";
import type { Logger } from "../../lib/logging/logger.ts";
import {
  createRequestLogger,
  type LoggingState,
} from "../../lib/logging/request-logger.ts";
import { formatApiRouteTree } from "./route-tree.ts";
import { registerStacksRoutes } from "./routes/stacks.ts";
import { registerStatesRoutes } from "./routes/states.ts";

export interface AppDependencies {
  readonly logger: Logger;
  readonly checkHealth: () => Promise<HealthStatus>;
  readonly listStates: (scope: string) => Promise<readonly State[]>;
  readonly createState: (input: CreateStateInput) => Promise<State>;
  readonly updateState: (
    stateId: string,
    input: UpdateStateInput,
  ) => Promise<State>;
  readonly moveState: (
    stateId: string,
    input: MoveStateInput,
  ) => Promise<readonly State[]>;
  readonly selectDefaultState: (stateId: string) => Promise<State>;
  readonly deleteState: (stateId: string) => Promise<void>;
  readonly listStacks: () => Promise<readonly Stack[]>;
  readonly getStack: (stackId: string) => Promise<Stack>;
  readonly createStack: (input: CreateStackInput) => Promise<Stack>;
  readonly frontendDistPath: string;
  readonly writeRouteTree?: (tree: string) => void;
}

export const createApp = ({
  logger,
  checkHealth,
  listStates,
  createState,
  updateState,
  moveState,
  selectDefaultState,
  deleteState,
  listStacks,
  getStack,
  createStack,
  frontendDistPath,
  writeRouteTree,
}: AppDependencies): Application => {
  const router = new Router<LoggingState>();

  router.get("/api/health", async (context) => {
    try {
      context.response.status = 200;
      context.response.type = "json";
      context.response.body = await checkHealth();
    } catch (cause) {
      context.state.logger.with({
        service: "health",
        method: "check",
      }).error({
        event: "health_check_failed",
        message: "Stackdraft health check failed.",
        outcome: "failure",
        cause,
      });
      context.response.status = 503;
      context.response.type = "json";
      context.response.body = apiError(
        "SERVICE_UNAVAILABLE",
        "Stackdraft is not ready.",
      );
    }
  });

  registerStatesRoutes(router, {
    listStates,
    createState,
    updateState,
    moveState,
    selectDefaultState,
    deleteState,
  });

  registerStacksRoutes(router, {
    listStacks,
    getStack,
    createStack,
  });

  // Read from Oak only after every route module has registered so the local
  // developer view cannot drift from the router the application will serve.
  writeRouteTree?.(formatApiRouteTree(router));

  const app = new Application<LoggingState>({ state: { logger } });

  // This mapper must wrap the request logger. Unhandled failures are logged by
  // the inner middleware, rethrown, and then converted here to a safe response.
  app.use(async (context, next) => {
    try {
      await next();
    } catch {
      context.response.status = 500;
      context.response.type = "json";
      context.response.body = apiError(
        "UNKNOWN_ERROR",
        "An unexpected error occurred.",
      );
    }
  });

  // Register request logging before routes so it observes the final status and
  // can provide a request-scoped logger to every downstream handler.
  app.use(createRequestLogger({ logger }));

  app.use(router.routes());
  app.use(router.allowedMethods());

  app.use(async (context) => {
    if (context.request.url.pathname.startsWith("/api/")) {
      context.response.status = 404;
      context.response.type = "json";
      context.response.body = apiError("NOT_FOUND", "API route not found.");
      return;
    }

    if (context.request.method !== "GET") {
      context.response.status = 405;
      return;
    }

    try {
      await context.send({
        root: frontendDistPath,
        path: context.request.url.pathname.slice(1) || "index.html",
      });

      if (context.response.status !== 404) {
        return;
      }
    } catch {
      // Fall through to the SPA entry point.
    }

    try {
      await context.send({
        root: frontendDistPath,
        path: "index.html",
      });
    } catch {
      context.response.status = 503;
      context.response.type = "text";
      context.response.body =
        "Stackdraft frontend is not built. Run `deno task build`.";
    }
  });

  return app;
};
