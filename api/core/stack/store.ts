import { Context, Effect } from "effect";
import type { Stack } from "../../defs/stack/stack.ts";
import type {
  InvalidStateScopeError,
  StackNotFoundError,
  StateNotFoundError,
  UnknownStackStoreError,
} from "../errors.ts";
import type {
  CreateStackRecord,
  ListStacksFilter,
  UpdateStackRecord,
} from "./input.ts";

export interface StackStoreApi {
  readonly list: (
    filter?: ListStacksFilter,
  ) => Effect.Effect<
    readonly Stack[],
    UnknownStackStoreError | InvalidStateScopeError
  >;
  readonly findById: (
    stackId: string,
  ) => Effect.Effect<Stack | null, UnknownStackStoreError>;
  readonly create: (
    stack: Stack,
  ) => Effect.Effect<Stack, UnknownStackStoreError>;
  readonly createWithResolvedState: (
    stack: CreateStackRecord,
  ) => Effect.Effect<
    Stack,
    UnknownStackStoreError | StateNotFoundError | InvalidStateScopeError
  >;
  readonly updateWithResolvedState: (
    stack: UpdateStackRecord,
  ) => Effect.Effect<
    Stack,
    | UnknownStackStoreError
    | StackNotFoundError
    | StateNotFoundError
    | InvalidStateScopeError
  >;
}

export class StackStore extends Context.Tag("stackdraft/StackStore")<
  StackStore,
  StackStoreApi
>() {}
