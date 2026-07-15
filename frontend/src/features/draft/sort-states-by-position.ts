import type { State } from "../../api/states.ts";

export const sortStatesByPosition = (states: readonly State[]): State[] =>
  [...states].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position;
    }

    return left.id.localeCompare(right.id);
  });
