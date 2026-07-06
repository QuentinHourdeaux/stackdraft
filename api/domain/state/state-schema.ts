import { Schema } from "effect";
import { stateScopes } from "./state.ts";

export const StateScopeSchema = Schema.Literal(...stateScopes);

export const StateSchema = Schema.Struct({
  id: Schema.String,
  scope: StateScopeSchema,
  name: Schema.String,
  color: Schema.String,
  position: Schema.Number,
  isDefault: Schema.Boolean,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

export const StatesResponseSchema = Schema.Struct({
  states: Schema.Array(StateSchema),
});

export type StateResponse = Schema.Schema.Type<typeof StateSchema>;
export type StatesResponse = Schema.Schema.Type<typeof StatesResponseSchema>;

export const encodeStatesResponse = Schema.encodeSync(StatesResponseSchema);
