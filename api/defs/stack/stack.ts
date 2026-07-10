import type { DateTime } from "effect";

export interface Stack {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly stateId: string;
  readonly createdAt: DateTime.Utc;
  readonly updatedAt: DateTime.Utc;
}
