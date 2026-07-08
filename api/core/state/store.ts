import { Context, DateTime, Effect } from "effect";
import type { State, StateScope } from "../../defs/state/state.ts";
import type {
  StateInUseError,
  StateNameConflictError,
  StateNotFoundError,
  UnknownStateStoreError,
  ValidationError,
} from "../errors.ts";

export interface StateStoreApi {
  readonly listByScope: (
    scope: StateScope,
  ) => Effect.Effect<readonly State[], UnknownStateStoreError>;
  readonly findById: (
    stateId: string,
  ) => Effect.Effect<State | null, UnknownStateStoreError>;
  readonly maxPositionInScope: (
    scope: StateScope,
  ) => Effect.Effect<number, UnknownStateStoreError>;
  readonly create: (
    state: State,
  ) => Effect.Effect<
    State,
    UnknownStateStoreError | StateNameConflictError
  >;
  readonly update: (
    state: State,
  ) => Effect.Effect<
    State,
    UnknownStateStoreError | StateNotFoundError | StateNameConflictError
  >;
  readonly reorderState: (
    stateId: string,
    position: number,
    updatedAt: DateTime.Utc,
  ) => Effect.Effect<
    readonly State[],
    UnknownStateStoreError | StateNotFoundError | ValidationError
  >;
  readonly selectDefault: (
    stateId: string,
    updatedAt: DateTime.Utc,
  ) => Effect.Effect<
    State,
    UnknownStateStoreError | StateNotFoundError
  >;
  readonly deleteState: (
    stateId: string,
    updatedAt: DateTime.Utc,
  ) => Effect.Effect<
    void,
    | UnknownStateStoreError
    | StateNotFoundError
    | StateInUseError
  >;
}

export class StateStore extends Context.Tag("stackdraft/StateStore")<
  StateStore,
  StateStoreApi
>() {}
