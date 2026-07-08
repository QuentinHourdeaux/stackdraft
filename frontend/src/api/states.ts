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

/** GET /api/states?scope=stack|draft — list States in a scope, ordered by position. */
export const listStates = async (
  scope: StateScope,
  signal?: AbortSignal,
): Promise<State[]> => {
  const response = await fetch(`/api/states?scope=${scope}`, { signal });
  const body = await readJson<{ states: State[] }>(response);
  return body.states;
};

/**
 * POST /api/states — create a State in the given scope.
 * Appends it after the current last position as non-default.
 */
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

/** PATCH /api/states/:stateId — update a State's name and/or color. */
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

/**
 * PUT /api/states/:stateId/position — set a State's position within its scope
 * and reorganise the scope's ordering. Other States in the scope may shift to
 * keep positions contiguous. Returns the full updated scope collection.
 */
export const updateStatePosition = async (
  stateId: string,
  position: number,
  signal?: AbortSignal,
): Promise<State[]> => {
  const response = await fetch(`/api/states/${stateId}/position`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ position }),
    signal,
  });

  const body = await readJson<{ states: State[] }>(response);
  return body.states;
};

/**
 * PUT /api/states/:stateId/default — set this State as the sole default in its
 * scope. The request has no body. Returns only the updated State; the previous
 * default is cleared on the server, so callers should refetch the scope when
 * they need the full updated collection.
 */
export const setDefaultState = async (
  stateId: string,
  signal?: AbortSignal,
): Promise<State> => {
  const response = await fetch(`/api/states/${stateId}/default`, {
    method: "PUT",
    signal,
  });

  return await readJson<State>(response);
};

/**
 * DELETE /api/states/:stateId — delete an eligible State and compact later
 * positions in its scope. Returns 204 with no body on success.
 */
export const deleteState = async (
  stateId: string,
  signal?: AbortSignal,
): Promise<void> => {
  const response = await fetch(`/api/states/${stateId}`, {
    method: "DELETE",
    signal,
  });

  if (!response.ok) {
    throw await decodeApiErrorResponse(response);
  }
};
