import { Schema } from "effect";
import { UuidSchema } from "../../lib/validation/uuid.ts";

export const DraftSchema = Schema.Struct({
  id: UuidSchema,
  stackId: Schema.NullOr(UuidSchema),
  title: Schema.String,
  description: Schema.String,
  stateId: UuidSchema,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
});

export const DraftsResponseSchema = Schema.Struct({
  drafts: Schema.Array(DraftSchema),
});

export const CreateDraftBodySchema = Schema.Struct({
  title: Schema.String,
  description: Schema.optional(Schema.String),
  stateId: Schema.optional(UuidSchema),
  stackId: Schema.optional(Schema.NullOr(UuidSchema)),
});

export type DraftResponse = Schema.Schema.Type<typeof DraftSchema>;
export type DraftsResponse = Schema.Schema.Type<typeof DraftsResponseSchema>;
export type CreateDraftBody = Schema.Schema.Type<typeof CreateDraftBodySchema>;

export const encodeDraftsResponse = Schema.encodeSync(DraftsResponseSchema);
export const encodeDraftResponse = Schema.encodeSync(DraftSchema);
