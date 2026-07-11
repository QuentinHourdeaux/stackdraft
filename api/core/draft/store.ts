import { Context, Effect } from "effect";
import type { Draft } from "../../defs/draft/draft.ts";
import type {
  InvalidStateScopeError,
  StackNotFoundError,
  StateNotFoundError,
  UnknownDraftStoreError,
} from "../errors.ts";
import type { CreateDraftRecord } from "./input.ts";

export interface DraftStoreApi {
  readonly list: () => Effect.Effect<readonly Draft[], UnknownDraftStoreError>;
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
}

export class DraftStore extends Context.Tag("stackdraft/DraftStore")<
  DraftStore,
  DraftStoreApi
>() {}
