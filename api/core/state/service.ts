import { Context, Effect } from "effect";
import type { State } from "../../defs/state/state.ts";
import type {
  CreateStateInput,
  MoveStateInput,
  UpdateStateInput,
} from "./input.ts";
import type {
  LastStateInScopeError,
  StateInUseError,
  StateIsDefaultError,
  StateNameConflictError,
  StateNotFoundError,
  UnknownStateStoreError,
  ValidationError,
} from "../errors.ts";

export interface StateServiceDependencies {
  readonly generateId: () => string;
  readonly now: () => Date;
}

export interface StateServiceApi {
  readonly listByScope: (
    scope: string,
  ) => Effect.Effect<
    readonly State[],
    ValidationError | UnknownStateStoreError
  >;
  readonly createState: (
    input: CreateStateInput,
  ) => Effect.Effect<
    State,
    ValidationError | UnknownStateStoreError | StateNameConflictError
  >;
  readonly updateState: (
    stateId: string,
    input: UpdateStateInput,
  ) => Effect.Effect<
    State,
    | ValidationError
    | UnknownStateStoreError
    | StateNotFoundError
    | StateNameConflictError
  >;
  readonly moveState: (
    stateId: string,
    input: MoveStateInput,
  ) => Effect.Effect<
    readonly State[],
    ValidationError | UnknownStateStoreError | StateNotFoundError
  >;
  readonly selectDefaultState: (
    stateId: string,
  ) => Effect.Effect<
    State,
    ValidationError | UnknownStateStoreError | StateNotFoundError
  >;
  readonly deleteState: (
    stateId: string,
  ) => Effect.Effect<
    void,
    | ValidationError
    | UnknownStateStoreError
    | StateNotFoundError
    | StateIsDefaultError
    | LastStateInScopeError
    | StateInUseError
  >;
}

export class StateService extends Context.Tag("stackdraft/StateService")<
  StateService,
  StateServiceApi
>() {}

export const listStatesByScope = (
  scope: string,
): Effect.Effect<
  readonly State[],
  ValidationError | UnknownStateStoreError,
  StateService
> => Effect.flatMap(StateService, (service) => service.listByScope(scope));

export const createState = (
  input: CreateStateInput,
): Effect.Effect<
  State,
  ValidationError | UnknownStateStoreError | StateNameConflictError,
  StateService
> => Effect.flatMap(StateService, (service) => service.createState(input));

export const updateState = (
  stateId: string,
  input: UpdateStateInput,
): Effect.Effect<
  State,
  | ValidationError
  | UnknownStateStoreError
  | StateNotFoundError
  | StateNameConflictError,
  StateService
> =>
  Effect.flatMap(
    StateService,
    (service) => service.updateState(stateId, input),
  );

export const moveState = (
  stateId: string,
  input: MoveStateInput,
): Effect.Effect<
  readonly State[],
  ValidationError | UnknownStateStoreError | StateNotFoundError,
  StateService
> =>
  Effect.flatMap(StateService, (service) => service.moveState(stateId, input));

export const selectDefaultState = (
  stateId: string,
): Effect.Effect<
  State,
  ValidationError | UnknownStateStoreError | StateNotFoundError,
  StateService
> =>
  Effect.flatMap(
    StateService,
    (service) => service.selectDefaultState(stateId),
  );

export const deleteState = (
  stateId: string,
): Effect.Effect<
  void,
  | ValidationError
  | UnknownStateStoreError
  | StateNotFoundError
  | StateIsDefaultError
  | LastStateInScopeError
  | StateInUseError,
  StateService
> => Effect.flatMap(StateService, (service) => service.deleteState(stateId));
