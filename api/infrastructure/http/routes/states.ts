import type { Router } from "@oak/oak";
import type { State } from "../../../domain/state/state.ts";
import { encodeStatesResponse } from "../../../domain/state/state-schema.ts";
import { ValidationError } from "../../../application/validation-error.ts";
import { StateRepositoryError } from "../../../application/state-repository.ts";
import { apiError } from "../errors.ts";

export interface StatesRouteDependencies {
  readonly listStates: (
    scopeValues: readonly string[],
  ) => Promise<readonly State[]>;
}

export const registerStatesRoutes = (
  router: Router,
  { listStates }: StatesRouteDependencies,
): void => {
  router.get("/api/states", async (context) => {
    const scopeValues = context.request.url.searchParams.getAll("scope");

    try {
      const states = await listStates(scopeValues);

      context.response.status = 200;
      context.response.type = "json";
      context.response.body = encodeStatesResponse({ states: [...states] });
    } catch (cause) {
      if (cause instanceof ValidationError) {
        context.response.status = 400;
        context.response.type = "json";
        context.response.body = apiError(
          "VALIDATION_ERROR",
          "The request is invalid.",
          { fields: cause.fields },
        );
        return;
      }

      if (cause instanceof StateRepositoryError) {
        console.error("State query failed", cause.cause);
        context.response.status = 500;
        context.response.type = "json";
        context.response.body = apiError(
          "INTERNAL_SERVER_ERROR",
          "An unexpected error occurred.",
        );
        return;
      }

      throw cause;
    }
  });
};
