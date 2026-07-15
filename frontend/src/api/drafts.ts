import { readJson } from "../lib/api/read-json.ts";

export interface Draft {
  readonly id: string;
  readonly stackId: string | null;
  readonly title: string;
  readonly description: string;
  readonly stateId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateDraftInput {
  readonly title: string;
  readonly stackId?: string;
}

export interface ListDraftsFilter {
  readonly stateId?: string;
  readonly stackId?: string;
}

/** GET /api/drafts — list Drafts, optionally filtered by stateId and/or stackId. */
export const listDrafts = async (
  filter?: ListDraftsFilter,
  signal?: AbortSignal,
): Promise<Draft[]> => {
  const searchParams = new URLSearchParams();

  if (filter?.stateId !== undefined) {
    searchParams.set("stateId", filter.stateId);
  }

  if (filter?.stackId !== undefined) {
    searchParams.set("stackId", filter.stackId);
  }

  const query = searchParams.toString();
  const path = query.length > 0 ? `/api/drafts?${query}` : "/api/drafts";
  const response = await fetch(path, { signal });
  const body = await readJson<{ drafts: Draft[] }>(response);
  return body.drafts;
};

/** GET /api/drafts/:draftId — load one Draft by id. */
export const getDraft = async (
  draftId: string,
  signal?: AbortSignal,
): Promise<Draft> => {
  const response = await fetch(`/api/drafts/${draftId}`, { signal });
  return await readJson<Draft>(response);
};

/** POST /api/drafts — create a Draft. Omit stackId for a standalone Draft. */
export const createDraft = async (
  input: CreateDraftInput,
  signal?: AbortSignal,
): Promise<Draft> => {
  const response = await fetch("/api/drafts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    signal,
  });

  return await readJson<Draft>(response);
};
