import type { DateTime } from "effect";

export interface CreateDraftInput {
  readonly title: string;
  readonly description?: string;
  readonly stateId?: string;
  readonly stackId?: string | null;
}

export interface CreateDraftRecord {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly createdAt: DateTime.Utc;
  readonly updatedAt: DateTime.Utc;
  readonly stateId?: string;
  readonly stackId?: string | null;
}
