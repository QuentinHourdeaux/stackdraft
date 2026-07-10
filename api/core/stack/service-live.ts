import { Effect, Layer } from "effect";
import { utcDateTimeFromDate } from "../../lib/time/utc.ts";
import { StackNotFoundError } from "../errors.ts";
import {
  StackService,
  type StackServiceApi,
  type StackServiceDependencies,
} from "./service.ts";
import type { StackStoreApi } from "./store.ts";
import {
  validateDescription,
  validateStackId,
  validateStateId,
  validateTitle,
  validateUpdateInput,
} from "./validation.ts";

export const makeStackService = (
  stackStore: StackStoreApi,
  dependencies: StackServiceDependencies,
): StackServiceApi => ({
  listStacks: (filter) =>
    Effect.gen(function* () {
      if (filter?.stateId !== undefined) {
        yield* validateStateId(filter.stateId);
      }

      return yield* stackStore.list(filter);
    }),

  getStack: (stackId) =>
    Effect.gen(function* () {
      const validatedId = yield* validateStackId(stackId);
      const stack = yield* stackStore.findById(validatedId);

      if (stack === null) {
        return yield* Effect.fail(
          new StackNotFoundError({
            stackId: validatedId,
          }),
        );
      }

      return stack;
    }),

  createStack: (input) =>
    Effect.gen(function* () {
      const title = yield* validateTitle(input.title);
      const description = yield* validateDescription(input.description ?? "");

      if (input.stateId !== undefined) {
        yield* validateStateId(input.stateId);
      }

      const timestamp = utcDateTimeFromDate(dependencies.now());

      return yield* stackStore.createWithResolvedState({
        id: dependencies.generateId(),
        title,
        description,
        stateId: input.stateId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }),

  updateStack: (stackId, input) =>
    Effect.gen(function* () {
      const validatedId = yield* validateStackId(stackId);
      const validated = yield* validateUpdateInput(input);
      const existing = yield* stackStore.findById(validatedId);

      if (existing === null) {
        return yield* Effect.fail(
          new StackNotFoundError({
            stackId: validatedId,
          }),
        );
      }

      const hasTitleChange = validated.title !== undefined &&
        validated.title !== existing.title;
      const hasDescriptionChange = validated.description !== undefined &&
        validated.description !== existing.description;
      const hasStateChange = validated.stateId !== undefined &&
        validated.stateId !== existing.stateId;

      if (!hasTitleChange && !hasDescriptionChange && !hasStateChange) {
        return existing;
      }

      const timestamp = utcDateTimeFromDate(dependencies.now());

      return yield* stackStore.updateWithResolvedState({
        id: validatedId,
        title: validated.title ?? existing.title,
        description: validated.description ?? existing.description,
        stateId: validated.stateId,
        createdAt: existing.createdAt,
        updatedAt: timestamp,
      });
    }),
});

export const StackServiceLive = (
  stackStore: StackStoreApi,
  dependencies: StackServiceDependencies,
): Layer.Layer<StackService> =>
  Layer.succeed(StackService, makeStackService(stackStore, dependencies));
