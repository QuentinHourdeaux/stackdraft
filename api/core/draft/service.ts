import { Context, Effect } from "effect";
import type { Draft } from "../../defs/draft/draft.ts";
import type {
  DraftNotFoundError,
  InvalidStateScopeError,
  StackNotFoundError,
  StateNotFoundError,
  UnknownDraftStoreError,
  ValidationError,
} from "../errors.ts";
import type {
  CreateDraftInput,
  ListDraftsFilter,
  UpdateDraftInput,
} from "./input.ts";

export interface DraftServiceDependencies {
  readonly generateId: () => string;
  readonly now: () => Date;
}

export interface DraftServiceApi {
  readonly listDrafts: (
    filter?: ListDraftsFilter,
  ) => Effect.Effect<
    readonly Draft[],
    UnknownDraftStoreError | ValidationError | InvalidStateScopeError
  >;
  readonly getDraft: (
    draftId: string,
  ) => Effect.Effect<
    Draft,
    ValidationError | UnknownDraftStoreError | DraftNotFoundError
  >;
  readonly createDraft: (
    input: CreateDraftInput,
  ) => Effect.Effect<
    Draft,
    | ValidationError
    | UnknownDraftStoreError
    | StateNotFoundError
    | InvalidStateScopeError
    | StackNotFoundError
  >;
  readonly updateDraft: (
    draftId: string,
    input: UpdateDraftInput,
  ) => Effect.Effect<
    Draft,
    | ValidationError
    | UnknownDraftStoreError
    | DraftNotFoundError
    | StateNotFoundError
    | InvalidStateScopeError
    | StackNotFoundError
  >;
}

export class DraftService extends Context.Tag("stackdraft/DraftService")<
  DraftService,
  DraftServiceApi
>() {}

export const listDrafts = (
  filter?: ListDraftsFilter,
): Effect.Effect<
  readonly Draft[],
  UnknownDraftStoreError | ValidationError | InvalidStateScopeError,
  DraftService
> => Effect.flatMap(DraftService, (service) => service.listDrafts(filter));

export const getDraft = (
  draftId: string,
): Effect.Effect<
  Draft,
  ValidationError | UnknownDraftStoreError | DraftNotFoundError,
  DraftService
> => Effect.flatMap(DraftService, (service) => service.getDraft(draftId));

export const createDraft = (
  input: CreateDraftInput,
): Effect.Effect<
  Draft,
  | ValidationError
  | UnknownDraftStoreError
  | StateNotFoundError
  | InvalidStateScopeError
  | StackNotFoundError,
  DraftService
> => Effect.flatMap(DraftService, (service) => service.createDraft(input));

export const updateDraft = (
  draftId: string,
  input: UpdateDraftInput,
): Effect.Effect<
  Draft,
  | ValidationError
  | UnknownDraftStoreError
  | DraftNotFoundError
  | StateNotFoundError
  | InvalidStateScopeError
  | StackNotFoundError,
  DraftService
> =>
  Effect.flatMap(
    DraftService,
    (service) => service.updateDraft(draftId, input),
  );
