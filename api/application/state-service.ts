import { Context, Effect, Layer } from "effect";
import type { State, StateScope } from "../domain/state/state.ts";
import { isStateScope } from "../domain/state/state.ts";
import {
  type StateRepositoryApi,
  type StateRepositoryError,
} from "./state-repository.ts";
import { ValidationError } from "./validation-error.ts";

export interface StateServiceApi {
  readonly listByScope: (
    scopeValues: readonly string[],
  ) => Effect.Effect<
    readonly State[],
    ValidationError | StateRepositoryError
  >;
}

export class StateService extends Context.Tag("stackdraft/StateService")<
  StateService,
  StateServiceApi
>() {}

const validateScopeQuery = (
  scopeValues: readonly string[],
): Effect.Effect<StateScope, ValidationError> => {
  if (scopeValues.length !== 1) {
    return Effect.fail(
      new ValidationError({
        fields: {
          scope: "Exactly one scope query parameter is required.",
        },
      }),
    );
  }

  const scope = scopeValues[0] ?? "";

  if (!isStateScope(scope)) {
    return Effect.fail(
      new ValidationError({
        fields: {
          scope: "Scope must be stack or draft.",
        },
      }),
    );
  }

  return Effect.succeed(scope);
};

export const makeStateService = (
  repository: StateRepositoryApi,
): StateServiceApi => ({
  listByScope: (scopeValues) =>
    Effect.gen(function* () {
      const scope = yield* validateScopeQuery(scopeValues);
      return yield* repository.listByScope(scope);
    }),
});

export const StateServiceLive = (
  repository: StateRepositoryApi,
): Layer.Layer<StateService> =>
  Layer.succeed(StateService, makeStateService(repository));

export const listStatesByScopeValues = (
  scopeValues: readonly string[],
): Effect.Effect<
  readonly State[],
  ValidationError | StateRepositoryError,
  StateService
> =>
  Effect.flatMap(StateService, (service) => service.listByScope(scopeValues));
