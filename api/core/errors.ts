import { Data } from "effect";
import type { StateScope } from "../defs/state/state.ts";

// Configuration

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
}> {}

// Validation

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly fields: Readonly<Record<string, string>>;
}> {}

// Health

export class HealthError extends Data.TaggedError("HealthError")<{
  readonly cause: unknown;
}> {}

// State

export class UnknownStateStoreError
  extends Data.TaggedError("UnknownStateStoreError")<{
    readonly cause: unknown;
  }> {}

export class StateNotFoundError extends Data.TaggedError("StateNotFoundError")<{
  readonly stateId: string;
}> {}

export class StateNameConflictError
  extends Data.TaggedError("StateNameConflictError")<{
    readonly scope: StateScope;
    readonly name: string;
  }> {}

export class StateIsDefaultError
  extends Data.TaggedError("StateIsDefaultError")<{
    readonly stateId: string;
  }> {}

export class LastStateInScopeError
  extends Data.TaggedError("LastStateInScopeError")<{
    readonly scope: StateScope;
  }> {}

export class StateInUseError extends Data.TaggedError("StateInUseError")<{
  readonly stateId: string;
}> {}

// Database

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly operation: "open" | "close";
  readonly cause: unknown;
}> {}

export class MigrationError extends Data.TaggedError("MigrationError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
