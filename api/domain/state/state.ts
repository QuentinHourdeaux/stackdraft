export const stateScopes = ["stack", "draft"] as const;

export type StateScope = (typeof stateScopes)[number];

export interface State {
  readonly id: string;
  readonly scope: StateScope;
  readonly name: string;
  readonly color: string;
  readonly position: number;
  readonly isDefault: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const isStateScope = (value: string): value is StateScope =>
  stateScopes.includes(value as StateScope);

export const stateColorPattern = /^#[0-9a-f]{6}$/i;

export const isStateColor = (value: string): boolean =>
  stateColorPattern.test(value);

export const normalizeStateColor = (value: string): string =>
  value.toLowerCase();

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => uuidPattern.test(value);
