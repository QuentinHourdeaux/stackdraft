import { Context, Effect } from "effect";
import type { Draft } from "../../defs/draft/draft.ts";
import type {
  DraftNotFoundError,
  InvalidStateScopeError,
  StackNotFoundError,
  StateNotFoundError,
  UnknownDraftStoreError,
} from "../errors.ts";
import type {
  CreateDraftRecord,
  ListDraftsFilter,
  UpdateDraftRecord,
} from "./input.ts";

export interface DraftStoreApi {
  readonly list: (
    filter?: ListDraftsFilter,
  ) => Effect.Effect<
    readonly Draft[],
    UnknownDraftStoreError | InvalidStateScopeError
  >;
  readonly findById: (
    draftId: string,
  ) => Effect.Effect<Draft | null, UnknownDraftStoreError>;
  readonly createWithResolvedStateAndStack: (
    draft: CreateDraftRecord,
  ) => Effect.Effect<
    Draft,
    | UnknownDraftStoreError
    | StateNotFoundError
    | InvalidStateScopeError
    | StackNotFoundError
  >;
  readonly updateWithResolvedStateAndStack: (
    draft: UpdateDraftRecord,
  ) => Effect.Effect<
    Draft,
    | UnknownDraftStoreError
    | DraftNotFoundError
    | StateNotFoundError
    | InvalidStateScopeError
    | StackNotFoundError
  >;
}

export class DraftStore extends Context.Tag("stackdraft/DraftStore")<
  DraftStore,
  DraftStoreApi
>() {}
