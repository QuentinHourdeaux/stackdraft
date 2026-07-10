import type { DateTime } from "effect";

export interface CreateStackInput {
  readonly title: string;
  readonly description?: string;
  readonly stateId?: string;
}

export interface CreateStackRecord {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly createdAt: DateTime.Utc;
  readonly updatedAt: DateTime.Utc;
  readonly stateId?: string;
}

export interface UpdateStackInput {
  readonly title?: string;
  readonly description?: string;
  readonly stateId?: string;
}

export interface UpdateStackRecord {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly createdAt: DateTime.Utc;
  readonly updatedAt: DateTime.Utc;
  readonly stateId?: string;
}

export interface ListStacksFilter {
  readonly stateId: string;
}
