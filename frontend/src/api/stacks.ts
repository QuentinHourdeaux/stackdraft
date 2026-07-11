import { readJson } from "../lib/api/read-json.ts";

export interface Stack {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly stateId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateStackInput {
  readonly title: string;
  readonly description?: string;
  readonly stateId?: string;
}

export interface UpdateStackInput {
  readonly title?: string;
  readonly description?: string;
  readonly stateId?: string;
}

export interface ListStacksFilter {
  readonly stateId?: string;
}

/** GET /api/stacks — list Stacks, optionally filtered by stateId on the server. */
export const listStacks = async (
  filter?: ListStacksFilter,
  signal?: AbortSignal,
): Promise<Stack[]> => {
  const searchParams = new URLSearchParams();

  if (filter?.stateId !== undefined) {
    searchParams.set("stateId", filter.stateId);
  }

  const query = searchParams.toString();
  const path = query.length > 0 ? `/api/stacks?${query}` : "/api/stacks";
  const response = await fetch(path, { signal });
  const body = await readJson<{ stacks: Stack[] }>(response);
  return body.stacks;
};

/** GET /api/stacks/:stackId — load one Stack by id. */
export const getStack = async (
  stackId: string,
  signal?: AbortSignal,
): Promise<Stack> => {
  const response = await fetch(`/api/stacks/${stackId}`, { signal });
  return await readJson<Stack>(response);
};

/** POST /api/stacks — create a Stack. Omit stateId to use the scope default. */
export const createStack = async (
  input: CreateStackInput,
  signal?: AbortSignal,
): Promise<Stack> => {
  const response = await fetch("/api/stacks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    signal,
  });

  return await readJson<Stack>(response);
};

/** PATCH /api/stacks/:stackId — update a Stack's title, description, and/or State. */
export const updateStack = async (
  stackId: string,
  input: UpdateStackInput,
  signal?: AbortSignal,
): Promise<Stack> => {
  const response = await fetch(`/api/stacks/${stackId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    signal,
  });

  return await readJson<Stack>(response);
};
