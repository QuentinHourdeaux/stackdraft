import { Effect, Layer } from "effect";
import { utcDateTimeFromDate } from "../../lib/time/utc.ts";
import { DraftNotFoundError } from "../errors.ts";
import {
  DraftService,
  type DraftServiceApi,
  type DraftServiceDependencies,
} from "./service.ts";
import type { DraftStoreApi } from "./store.ts";
import {
  validateDescription,
  validateDraftId,
  validateStackId,
  validateStateId,
  validateTitle,
} from "./validation.ts";

export const makeDraftService = (
  draftStore: DraftStoreApi,
  dependencies: DraftServiceDependencies,
): DraftServiceApi => ({
  listDrafts: () => draftStore.list(),

  getDraft: (draftId) =>
    Effect.gen(function* () {
      const validatedId = yield* validateDraftId(draftId);
      const draft = yield* draftStore.findById(validatedId);

      if (draft === null) {
        return yield* Effect.fail(
          new DraftNotFoundError({
            draftId: validatedId,
          }),
        );
      }

      return draft;
    }),

  createDraft: (input) =>
    Effect.gen(function* () {
      const title = yield* validateTitle(input.title);
      const description = yield* validateDescription(input.description ?? "");

      if (input.stateId !== undefined) {
        yield* validateStateId(input.stateId);
      }

      if (input.stackId !== undefined && input.stackId !== null) {
        yield* validateStackId(input.stackId);
      }

      const timestamp = utcDateTimeFromDate(dependencies.now());

      return yield* draftStore.createWithResolvedStateAndStack({
        id: dependencies.generateId(),
        title,
        description,
        stateId: input.stateId,
        stackId: input.stackId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }),
});

export const DraftServiceLive = (
  draftStore: DraftStoreApi,
  dependencies: DraftServiceDependencies,
): Layer.Layer<DraftService> =>
  Layer.succeed(DraftService, makeDraftService(draftStore, dependencies));
