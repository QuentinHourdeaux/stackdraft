import type { Draft } from "../../api/drafts.ts";

export const compareDrafts = (left: Draft, right: Draft): number => {
  const byCreated = right.createdAt.localeCompare(left.createdAt);
  if (byCreated !== 0) {
    return byCreated;
  }

  return left.id.localeCompare(right.id);
};

export const insertDraftInOrder = (
  drafts: readonly Draft[],
  draft: Draft,
): Draft[] => [...drafts, draft].sort(compareDrafts);
