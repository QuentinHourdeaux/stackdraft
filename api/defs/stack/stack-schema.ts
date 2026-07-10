import { Schema } from "effect";
import { UuidSchema } from "../../lib/validation/uuid.ts";

export const StackSchema = Schema.Struct({
  id: UuidSchema,
  title: Schema.String,
  description: Schema.String,
  stateId: UuidSchema,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
});

export const StacksResponseSchema = Schema.Struct({
  stacks: Schema.Array(StackSchema),
});

export const CreateStackBodySchema = Schema.Struct({
  title: Schema.String,
  description: Schema.optional(Schema.String),
  stateId: Schema.optional(UuidSchema),
});

export const UpdateStackBodySchema = Schema.Struct({
  title: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  stateId: Schema.optional(UuidSchema),
});

export type StackResponse = Schema.Schema.Type<typeof StackSchema>;
export type StacksResponse = Schema.Schema.Type<typeof StacksResponseSchema>;
export type CreateStackBody = Schema.Schema.Type<typeof CreateStackBodySchema>;
export type UpdateStackBody = Schema.Schema.Type<typeof UpdateStackBodySchema>;

export const encodeStacksResponse = Schema.encodeSync(StacksResponseSchema);
export const encodeStackResponse = Schema.encodeSync(StackSchema);
