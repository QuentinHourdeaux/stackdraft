import { Context, Data, Effect } from "effect";
import type { State, StateScope } from "../domain/state/state.ts";

export class StateRepositoryError
  extends Data.TaggedError("StateRepositoryError")<{
    readonly cause: unknown;
  }> {}

export interface StateRepositoryApi {
  readonly listByScope: (
    scope: StateScope,
  ) => Effect.Effect<readonly State[], StateRepositoryError>;
}

export class StateRepository extends Context.Tag("stackdraft/StateRepository")<
  StateRepository,
  StateRepositoryApi
>() {}
