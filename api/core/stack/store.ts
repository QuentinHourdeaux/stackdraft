import { Context, Effect } from "effect";
import type { Stack } from "../../defs/stack/stack.ts";
import type {
  InvalidStateScopeError,
  StateNotFoundError,
  UnknownStackStoreError,
} from "../errors.ts";
import type { CreateStackRecord } from "./input.ts";

export interface StackStoreApi {
  readonly list: () => Effect.Effect<readonly Stack[], UnknownStackStoreError>;
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
}

export class StackStore extends Context.Tag("stackdraft/StackStore")<
  StackStore,
  StackStoreApi
>() {}
