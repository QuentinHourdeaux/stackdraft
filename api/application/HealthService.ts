import type { DatabaseSync } from "node:sqlite";
import { Context, Data, Effect, Layer } from "effect";

export interface HealthStatus {
  readonly status: "ok";
  readonly database: "ok";
}

export class HealthError extends Data.TaggedError("HealthError")<{
  readonly cause: unknown;
}> {}

export interface HealthServiceApi {
  readonly check: Effect.Effect<HealthStatus, HealthError>;
}

export class HealthService extends Context.Tag("stackdraft/HealthService")<
  HealthService,
  HealthServiceApi
>() {}

export const makeHealthService = (
  database: Pick<DatabaseSync, "prepare">,
): HealthServiceApi => ({
  check: Effect.try({
    try: () => {
      database.prepare("SELECT 1").get();
      return {
        status: "ok",
        database: "ok",
      } as const;
    },
    catch: (cause) => new HealthError({ cause }),
  }),
});

export const HealthServiceLive = (
  database: Pick<DatabaseSync, "prepare">,
): Layer.Layer<HealthService> =>
  Layer.succeed(HealthService, makeHealthService(database));

export const checkHealth: Effect.Effect<
  HealthStatus,
  HealthError,
  HealthService
> = Effect.flatMap(HealthService, (service) => service.check);
