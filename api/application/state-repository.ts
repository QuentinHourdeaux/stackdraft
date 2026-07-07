import { Context, Data, Effect } from "effect";
import type { State, StateScope } from "../domain/state/state.ts";

export class UnknownStateRepositoryError
  extends Data.TaggedError("UnknownStateRepositoryError")<{
    readonly cause: unknown;
  }> {}

export class StateNotFoundError extends Data.TaggedError("StateNotFoundError")<{
  readonly stateId: string;
}> {}

export class StateNameConflictError
  extends Data.TaggedError("StateNameConflictError")<{
    readonly scope: StateScope;
    readonly name: string;
  }> {}

export interface StateRepositoryApi {
  readonly listByScope: (
    scope: StateScope,
  ) => Effect.Effect<readonly State[], UnknownStateRepositoryError>;
  readonly findById: (
    stateId: string,
  ) => Effect.Effect<State | null, UnknownStateRepositoryError>;
  readonly maxPositionInScope: (
    scope: StateScope,
  ) => Effect.Effect<number, UnknownStateRepositoryError>;
  readonly create: (
    state: State,
  ) => Effect.Effect<
    State,
    UnknownStateRepositoryError | StateNameConflictError
  >;
  readonly update: (
    state: State,
  ) => Effect.Effect<
    State,
    UnknownStateRepositoryError | StateNotFoundError | StateNameConflictError
  >;
  readonly reorderState: (
    stateId: string,
    position: number,
    updatedAt: string,
  ) => Effect.Effect<
    readonly State[],
    UnknownStateRepositoryError | StateNotFoundError
  >;
  readonly selectDefault: (
    stateId: string,
    updatedAt: string,
  ) => Effect.Effect<
    State,
    UnknownStateRepositoryError | StateNotFoundError
  >;
}

export class StateRepository extends Context.Tag("stackdraft/StateRepository")<
  StateRepository,
  StateRepositoryApi
>() {}
