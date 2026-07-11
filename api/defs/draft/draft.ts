import type { DateTime } from "effect";

export interface Draft {
  readonly id: string;
  readonly stackId: string | null;
  readonly title: string;
  readonly description: string;
  readonly stateId: string;
  readonly createdAt: DateTime.Utc;
  readonly updatedAt: DateTime.Utc;
}
