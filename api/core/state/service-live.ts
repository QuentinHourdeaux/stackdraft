import { Effect, Layer } from "effect";
import type { State, StateScope } from "../../defs/state/state.ts";
import { utcDateTimeFromDate } from "../../lib/time/utc.ts";
import type { CreateStateInput, UpdateStateInput } from "./input.ts";
import {
  LastStateInScopeError,
  StateInUseError,
  StateIsDefaultError,
  StateNameConflictError,
  StateNotFoundError,
  type UnknownStateStoreError,
  ValidationError,
} from "../errors.ts";
import {
  StateService,
  type StateServiceApi,
  type StateServiceDependencies,
} from "./service.ts";
import type { StateStoreApi } from "./store.ts";
import {
  validateColor,
  validateName,
  validatePosition,
  validateScope,
  validateStateId,
} from "./validation.ts";

const validateCreateInput = (
  input: CreateStateInput,
): Effect.Effect<
  { readonly scope: StateScope; readonly name: string; readonly color: string },
  ValidationError
> =>
  Effect.gen(function* () {
    const scope = yield* validateScope(input.scope);
    const name = yield* validateName(input.name);
    const color = yield* validateColor(input.color);

    return {
      scope,
      name,
      color,
    };
  });

const validateUpdateInput = (
  input: UpdateStateInput,
): Effect.Effect<
  { readonly name?: string; readonly color?: string },
  ValidationError
> => {
  if (input.name === undefined && input.color === undefined) {
    return Effect.fail(
      new ValidationError({
        fields: {
          body: "At least one field is required.",
        },
      }),
    );
  }

  return Effect.gen(function* () {
    let name: string | undefined;
    let color: string | undefined;

    if (input.name !== undefined) {
      name = yield* validateName(input.name);
    }

    if (input.color !== undefined) {
      color = yield* validateColor(input.color);
    }

    return { name, color };
  });
};

export const makeStateService = (
  store: StateStoreApi,
  dependencies: StateServiceDependencies,
): StateServiceApi => ({
  listByScope: (scope) =>
    Effect.gen(function* () {
      const validatedScope = yield* validateScope(scope);
      return yield* store.listByScope(validatedScope);
    }),

  createState: (input) =>
    Effect.gen(function* () {
      const validated = yield* validateCreateInput(input);
      const maxPosition = yield* store.maxPositionInScope(validated.scope);
      const timestamp = utcDateTimeFromDate(dependencies.now());
      const created: State = {
        id: dependencies.generateId(),
        scope: validated.scope,
        name: validated.name,
        color: validated.color,
        position: maxPosition + 1,
        isDefault: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      return yield* store.create(created);
    }),

  updateState: (stateId, input) =>
    Effect.gen(function* () {
      const validatedId = yield* validateStateId(stateId);
      const validated = yield* validateUpdateInput(input);
      const existing = yield* store.findById(validatedId);

      if (existing === null) {
        return yield* Effect.fail(
          new StateNotFoundError({
            stateId: validatedId,
          }),
        );
      }

      const updated: State = {
        ...existing,
        name: validated.name ?? existing.name,
        color: validated.color ?? existing.color,
        updatedAt: utcDateTimeFromDate(dependencies.now()),
      };

      return yield* store.update(updated);
    }),

  moveState: (stateId, input) =>
    Effect.gen(function* () {
      const validatedId = yield* validateStateId(stateId);
      const existing = yield* store.findById(validatedId);

      if (existing === null) {
        return yield* Effect.fail(
          new StateNotFoundError({
            stateId: validatedId,
          }),
        );
      }

      const scopeStates = yield* store.listByScope(existing.scope);
      const maxPosition = scopeStates.length - 1;
      const validatedPosition = yield* validatePosition(
        input.position,
        maxPosition,
      );
      const updatedAt = utcDateTimeFromDate(dependencies.now());

      return yield* store.reorderState(
        validatedId,
        validatedPosition,
        updatedAt,
      );
    }),

  selectDefaultState: (stateId) =>
    Effect.gen(function* () {
      const validatedId = yield* validateStateId(stateId);
      const existing = yield* store.findById(validatedId);

      if (existing === null) {
        return yield* Effect.fail(
          new StateNotFoundError({
            stateId: validatedId,
          }),
        );
      }

      const updatedAt = utcDateTimeFromDate(dependencies.now());

      return yield* store.selectDefault(validatedId, updatedAt);
    }),

  deleteState: (stateId) =>
    Effect.gen(function* () {
      const validatedId = yield* validateStateId(stateId);
      const existing = yield* store.findById(validatedId);

      if (existing === null) {
        return yield* Effect.fail(
          new StateNotFoundError({
            stateId: validatedId,
          }),
        );
      }

      if (existing.isDefault) {
        return yield* Effect.fail(
          new StateIsDefaultError({
            stateId: validatedId,
          }),
        );
      }

      const scopeStates = yield* store.listByScope(existing.scope);

      if (scopeStates.length === 1) {
        return yield* Effect.fail(
          new LastStateInScopeError({
            scope: existing.scope,
          }),
        );
      }

      const updatedAt = utcDateTimeFromDate(dependencies.now());

      return yield* store.deleteState(validatedId, updatedAt);
    }),
});

export const StateServiceLive = (
  store: StateStoreApi,
  dependencies: StateServiceDependencies,
): Layer.Layer<StateService> =>
  Layer.succeed(StateService, makeStateService(store, dependencies));

export type StateServiceLiveFailure =
  | ValidationError
  | UnknownStateStoreError
  | StateNotFoundError
  | StateNameConflictError
  | StateIsDefaultError
  | LastStateInScopeError
  | StateInUseError;
