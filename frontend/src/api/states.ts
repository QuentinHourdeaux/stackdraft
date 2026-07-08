import { decodeApiErrorResponse } from "./api-error.ts";

export type StateScope = "stack" | "draft";

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

export interface CreateStateInput {
  readonly scope: StateScope;
  readonly name: string;
  readonly color: string;
}

export interface UpdateStateInput {
  readonly name?: string;
  readonly color?: string;
}

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw await decodeApiErrorResponse(response);
  }

  return await response.json() as T;
};

export const listStates = async (
  scope: StateScope,
  signal?: AbortSignal,
): Promise<State[]> => {
  const response = await fetch(`/api/states?scope=${scope}`, { signal });
  const body = await readJson<{ states: State[] }>(response);
  return body.states;
};

export const createState = async (
  input: CreateStateInput,
  signal?: AbortSignal,
): Promise<State> => {
  const response = await fetch("/api/states", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    signal,
  });

  return await readJson<State>(response);
};

export const updateState = async (
  stateId: string,
  input: UpdateStateInput,
  signal?: AbortSignal,
): Promise<State> => {
  const response = await fetch(`/api/states/${stateId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    signal,
  });

  return await readJson<State>(response);
};
