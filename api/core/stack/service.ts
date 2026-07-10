import { Context, Effect } from "effect";
import type { Stack } from "../../defs/stack/stack.ts";
import type {
  InvalidStateScopeError,
  StackNotFoundError,
  StateNotFoundError,
  UnknownStackStoreError,
  ValidationError,
} from "../errors.ts";
import type { CreateStackInput } from "./input.ts";

export interface StackServiceDependencies {
  readonly generateId: () => string;
  readonly now: () => Date;
}

export interface StackServiceApi {
  readonly listStacks: () => Effect.Effect<
    readonly Stack[],
    UnknownStackStoreError
  >;
  readonly getStack: (
    stackId: string,
  ) => Effect.Effect<
    Stack,
    ValidationError | UnknownStackStoreError | StackNotFoundError
  >;
  readonly createStack: (
    input: CreateStackInput,
  ) => Effect.Effect<
    Stack,
    | ValidationError
    | UnknownStackStoreError
    | StateNotFoundError
    | InvalidStateScopeError
  >;
}

export class StackService extends Context.Tag("stackdraft/StackService")<
  StackService,
  StackServiceApi
>() {}

export const listStacks = (): Effect.Effect<
  readonly Stack[],
  UnknownStackStoreError,
  StackService
> => Effect.flatMap(StackService, (service) => service.listStacks());

export const getStack = (
  stackId: string,
): Effect.Effect<
  Stack,
  ValidationError | UnknownStackStoreError | StackNotFoundError,
  StackService
> => Effect.flatMap(StackService, (service) => service.getStack(stackId));

export const createStack = (
  input: CreateStackInput,
): Effect.Effect<
  Stack,
  | ValidationError
  | UnknownStackStoreError
  | StateNotFoundError
  | InvalidStateScopeError,
  StackService
> => Effect.flatMap(StackService, (service) => service.createStack(input));
