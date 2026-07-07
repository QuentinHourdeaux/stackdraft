import { Context, Effect, Layer } from "effect";
import type { State, StateScope } from "../domain/state/state.ts";
import {
  isStateColor,
  isStateScope,
  isUuid,
  normalizeStateColor,
} from "../domain/state/state.ts";
import {
  LastStateInScopeError,
  StateInUseError,
  StateIsDefaultError,
  StateNameConflictError,
  StateNotFoundError,
  type StateRepositoryApi,
  type UnknownStateRepositoryError,
} from "./state-repository.ts";
import { ValidationError } from "./validation-error.ts";

export interface CreateStateInput {
  readonly scope: string;
  readonly name: string;
  readonly color: string;
}

export interface UpdateStateInput {
  readonly name?: string;
  readonly color?: string;
}

export interface MoveStateInput {
  readonly position: number;
}

export interface StateServiceDependencies {
  readonly generateId: () => string;
  readonly now: () => Date;
}

export interface StateServiceApi {
  readonly listByScope: (
    scopeValues: readonly string[],
  ) => Effect.Effect<
    readonly State[],
    ValidationError | UnknownStateRepositoryError
  >;
  readonly createState: (
    input: CreateStateInput,
  ) => Effect.Effect<
    State,
    ValidationError | UnknownStateRepositoryError | StateNameConflictError
  >;
  readonly updateState: (
    stateId: string,
    input: UpdateStateInput,
  ) => Effect.Effect<
    State,
    | ValidationError
    | UnknownStateRepositoryError
    | StateNotFoundError
    | StateNameConflictError
  >;
  readonly moveState: (
    stateId: string,
    input: MoveStateInput,
  ) => Effect.Effect<
    readonly State[],
    ValidationError | UnknownStateRepositoryError | StateNotFoundError
  >;
  readonly selectDefaultState: (
    stateId: string,
  ) => Effect.Effect<
    State,
    ValidationError | UnknownStateRepositoryError | StateNotFoundError
  >;
  readonly deleteState: (
    stateId: string,
  ) => Effect.Effect<
    void,
    | ValidationError
    | UnknownStateRepositoryError
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

const stateNameMinLength = 1;
const stateNameMaxLength = 40;

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

const validateScope = (
  scope: string,
): Effect.Effect<StateScope, ValidationError> => {
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

const validateStateId = (
  stateId: string,
): Effect.Effect<string, ValidationError> => {
  if (!isUuid(stateId)) {
    return Effect.fail(
      new ValidationError({
        fields: {
          stateId: "State ID must be a valid UUID.",
        },
      }),
    );
  }

  return Effect.succeed(stateId);
};

const validateName = (
  name: string,
  field = "name",
): Effect.Effect<string, ValidationError> => {
  const trimmed = name.trim();

  if (trimmed.length < stateNameMinLength) {
    return Effect.fail(
      new ValidationError({
        fields: {
          [field]: "Name is required.",
        },
      }),
    );
  }

  if (trimmed.length > stateNameMaxLength) {
    return Effect.fail(
      new ValidationError({
        fields: {
          [field]: "Name must be 40 characters or fewer.",
        },
      }),
    );
  }

  return Effect.succeed(trimmed);
};

const validateColor = (
  color: string,
  field = "color",
): Effect.Effect<string, ValidationError> => {
  if (!isStateColor(color)) {
    return Effect.fail(
      new ValidationError({
        fields: {
          [field]: "Color must be a hex color in the form #RRGGBB.",
        },
      }),
    );
  }

  return Effect.succeed(normalizeStateColor(color));
};

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

const validatePosition = (
  position: number,
  maxPosition: number,
): Effect.Effect<number, ValidationError> => {
  if (!Number.isInteger(position)) {
    return Effect.fail(
      new ValidationError({
        fields: {
          position: "Position must be a whole number.",
        },
      }),
    );
  }

  if (position < 0 || position > maxPosition) {
    return Effect.fail(
      new ValidationError({
        fields: {
          position: `Position must be between 0 and ${maxPosition}.`,
        },
      }),
    );
  }

  return Effect.succeed(position);
};

export const makeStateService = (
  repository: StateRepositoryApi,
  dependencies: StateServiceDependencies,
): StateServiceApi => ({
  listByScope: (scopeValues) =>
    Effect.gen(function* () {
      const scope = yield* validateScopeQuery(scopeValues);
      return yield* repository.listByScope(scope);
    }),

  createState: (input) =>
    Effect.gen(function* () {
      const validated = yield* validateCreateInput(input);
      const maxPosition = yield* repository.maxPositionInScope(validated.scope);
      const timestamp = dependencies.now().toISOString();
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

      return yield* repository.create(created);
    }),

  updateState: (stateId, input) =>
    Effect.gen(function* () {
      const validatedId = yield* validateStateId(stateId);
      const validated = yield* validateUpdateInput(input);
      const existing = yield* repository.findById(validatedId);

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
        updatedAt: dependencies.now().toISOString(),
      };

      return yield* repository.update(updated);
    }),

  moveState: (stateId, input) =>
    Effect.gen(function* () {
      const validatedId = yield* validateStateId(stateId);
      const existing = yield* repository.findById(validatedId);

      if (existing === null) {
        return yield* Effect.fail(
          new StateNotFoundError({
            stateId: validatedId,
          }),
        );
      }

      const scopeStates = yield* repository.listByScope(existing.scope);
      const maxPosition = scopeStates.length - 1;
      const validatedPosition = yield* validatePosition(
        input.position,
        maxPosition,
      );
      const updatedAt = dependencies.now().toISOString();

      return yield* repository.reorderState(
        validatedId,
        validatedPosition,
        updatedAt,
      );
    }),

  selectDefaultState: (stateId) =>
    Effect.gen(function* () {
      const validatedId = yield* validateStateId(stateId);
      const existing = yield* repository.findById(validatedId);

      if (existing === null) {
        return yield* Effect.fail(
          new StateNotFoundError({
            stateId: validatedId,
          }),
        );
      }

      const updatedAt = dependencies.now().toISOString();

      return yield* repository.selectDefault(validatedId, updatedAt);
    }),

  deleteState: (stateId) =>
    Effect.gen(function* () {
      const validatedId = yield* validateStateId(stateId);
      const existing = yield* repository.findById(validatedId);

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

      const scopeStates = yield* repository.listByScope(existing.scope);

      if (scopeStates.length === 1) {
        return yield* Effect.fail(
          new LastStateInScopeError({
            scope: existing.scope,
          }),
        );
      }

      const updatedAt = dependencies.now().toISOString();

      return yield* repository.deleteState(validatedId, updatedAt);
    }),
});

export const StateServiceLive = (
  repository: StateRepositoryApi,
  dependencies: StateServiceDependencies,
): Layer.Layer<StateService> =>
  Layer.succeed(StateService, makeStateService(repository, dependencies));

export const listStatesByScopeValues = (
  scopeValues: readonly string[],
): Effect.Effect<
  readonly State[],
  ValidationError | UnknownStateRepositoryError,
  StateService
> =>
  Effect.flatMap(StateService, (service) => service.listByScope(scopeValues));

export const createState = (
  input: CreateStateInput,
): Effect.Effect<
  State,
  ValidationError | UnknownStateRepositoryError | StateNameConflictError,
  StateService
> => Effect.flatMap(StateService, (service) => service.createState(input));

export const updateState = (
  stateId: string,
  input: UpdateStateInput,
): Effect.Effect<
  State,
  | ValidationError
  | UnknownStateRepositoryError
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
  ValidationError | UnknownStateRepositoryError | StateNotFoundError,
  StateService
> =>
  Effect.flatMap(StateService, (service) => service.moveState(stateId, input));

export const selectDefaultState = (
  stateId: string,
): Effect.Effect<
  State,
  ValidationError | UnknownStateRepositoryError | StateNotFoundError,
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
  | UnknownStateRepositoryError
  | StateNotFoundError
  | StateIsDefaultError
  | LastStateInScopeError
  | StateInUseError,
  StateService
> => Effect.flatMap(StateService, (service) => service.deleteState(stateId));
