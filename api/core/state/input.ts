export interface CreateStateInput {
  readonly scope: string;
  readonly name: string;
  readonly color: string;
}

export interface UpdateStateInput {
  readonly name?: string;
  readonly color?: string;
}

export interface MoveStateInput {
  readonly position: number;
}
