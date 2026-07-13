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
  validateUpdateInput,
} from "./validation.ts";

export const makeDraftService = (
  draftStore: DraftStoreApi,
  dependencies: DraftServiceDependencies,
): DraftServiceApi => ({
  listDrafts: (filter) =>
    Effect.gen(function* () {
      if (filter?.stateId !== undefined) {
        yield* validateStateId(filter.stateId);
      }

      if (filter?.stackId !== undefined) {
        yield* validateStackId(filter.stackId);
      }

      return yield* draftStore.list(filter);
    }),

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

  updateDraft: (draftId, input) =>
    Effect.gen(function* () {
      const validatedId = yield* validateDraftId(draftId);
      const validated = yield* validateUpdateInput(input);
      const existing = yield* draftStore.findById(validatedId);

      if (existing === null) {
        return yield* Effect.fail(
          new DraftNotFoundError({
            draftId: validatedId,
          }),
        );
      }

      const hasTitleChange = validated.title !== undefined &&
        validated.title !== existing.title;
      const hasDescriptionChange = validated.description !== undefined &&
        validated.description !== existing.description;
      const hasStateChange = validated.stateId !== undefined &&
        validated.stateId !== existing.stateId;
      const hasStackChange = validated.stackId !== undefined &&
        validated.stackId !== existing.stackId;

      if (
        !hasTitleChange && !hasDescriptionChange && !hasStateChange &&
        !hasStackChange
      ) {
        return existing;
      }

      const timestamp = utcDateTimeFromDate(dependencies.now());

      return yield* draftStore.updateWithResolvedStateAndStack({
        id: validatedId,
        title: validated.title ?? existing.title,
        description: validated.description ?? existing.description,
        stateId: validated.stateId,
        stackId: validated.stackId,
        createdAt: existing.createdAt,
        updatedAt: timestamp,
      });
    }),
});

export const DraftServiceLive = (
  draftStore: DraftStoreApi,
  dependencies: DraftServiceDependencies,
): Layer.Layer<DraftService> =>
  Layer.succeed(DraftService, makeDraftService(draftStore, dependencies));
