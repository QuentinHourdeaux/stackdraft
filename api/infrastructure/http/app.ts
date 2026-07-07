import { Application, Router } from "@oak/oak";
import type { HealthStatus } from "../../application/health-service.ts";
import type {
  CreateStateInput,
  MoveStateInput,
  UpdateStateInput,
} from "../../application/state-service.ts";
import type { State } from "../../domain/state/state.ts";
import { apiError } from "./errors.ts";
import { registerStatesRoutes } from "./routes/states.ts";

export interface AppDependencies {
  readonly checkHealth: () => Promise<HealthStatus>;
  readonly listStates: (
    scopeValues: readonly string[],
  ) => Promise<readonly State[]>;
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
  readonly frontendDistPath: string;
}

export const createApp = ({
  checkHealth,
  listStates,
  createState,
  updateState,
  moveState,
  selectDefaultState,
  frontendDistPath,
}: AppDependencies): Application => {
  const router = new Router();

  router.get("/api/health", async (context) => {
    try {
      context.response.status = 200;
      context.response.type = "json";
      context.response.body = await checkHealth();
    } catch {
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
  });

  const app = new Application();

  app.use(async (context, next) => {
    try {
      await next();
    } catch (cause) {
      console.error("Unhandled request failure", cause);
      context.response.status = 500;
      context.response.type = "json";
      context.response.body = apiError(
        "UNKNOWN_ERROR",
        "An unexpected error occurred.",
      );
    }
  });

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
