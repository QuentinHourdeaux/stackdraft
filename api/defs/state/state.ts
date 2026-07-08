import type { DateTime } from "effect";

export const stateScopes = ["stack", "draft"] as const;

export type StateScope = (typeof stateScopes)[number];

export interface State {
  readonly id: string;
  readonly scope: StateScope;
  readonly name: string;
  readonly color: string;
  readonly position: number;
  readonly isDefault: boolean;
  readonly createdAt: DateTime.Utc;
  readonly updatedAt: DateTime.Utc;
}
