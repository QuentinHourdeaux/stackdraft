import { Schema } from "effect";
import { UuidSchema } from "../../lib/validation/uuid.ts";
import { stateScopes } from "./state.ts";

export const StateScopeSchema = Schema.Literal(...stateScopes);

export const StateSchema = Schema.Struct({
  id: UuidSchema,
  scope: StateScopeSchema,
  name: Schema.String,
  color: Schema.String,
  position: Schema.Int,
  isDefault: Schema.Boolean,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
});

export const StatesResponseSchema = Schema.Struct({
  states: Schema.Array(StateSchema),
});

export const CreateStateBodySchema = Schema.Struct({
  scope: StateScopeSchema,
  name: Schema.String,
  color: Schema.String,
});

export const UpdateStateBodySchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  color: Schema.optional(Schema.String),
});

export const MoveStateBodySchema = Schema.Struct({
  position: Schema.Int,
});

export type StateResponse = Schema.Schema.Type<typeof StateSchema>;
export type StatesResponse = Schema.Schema.Type<typeof StatesResponseSchema>;
export type CreateStateBody = Schema.Schema.Type<typeof CreateStateBodySchema>;
export type UpdateStateBody = Schema.Schema.Type<typeof UpdateStateBodySchema>;
export type MoveStateBody = Schema.Schema.Type<typeof MoveStateBodySchema>;

export const encodeStatesResponse = Schema.encodeSync(StatesResponseSchema);
export const encodeStateResponse = Schema.encodeSync(StateSchema);
