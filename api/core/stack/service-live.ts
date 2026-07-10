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
} from "./validation.ts";

export const makeStackService = (
  stackStore: StackStoreApi,
  dependencies: StackServiceDependencies,
): StackServiceApi => ({
  listStacks: () => stackStore.list(),

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
});

export const StackServiceLive = (
  stackStore: StackStoreApi,
  dependencies: StackServiceDependencies,
): Layer.Layer<StackService> =>
  Layer.succeed(StackService, makeStackService(stackStore, dependencies));
