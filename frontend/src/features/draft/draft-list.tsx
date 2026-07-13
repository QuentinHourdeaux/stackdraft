import { Link } from "react-router";
import type { Draft } from "../../api/drafts.ts";
import type { Stack } from "../../api/stacks.ts";
import type { State } from "../../api/states.ts";
import { StateBadge } from "../stack/state-badge.tsx";

interface DraftListProps {
  readonly drafts: Draft[];
  readonly statesById: ReadonlyMap<string, State>;
  readonly stacksById?: ReadonlyMap<string, Stack>;
  readonly showStackContext: boolean;
}

export function DraftList({
  drafts,
  statesById,
  stacksById,
  showStackContext,
}: DraftListProps) {
  return (
    <ul className="draft-list">
      {drafts.map((draft) => {
        const state = statesById.get(draft.stateId);
        const stack = draft.stackId === null
          ? undefined
          : stacksById?.get(draft.stackId);

        return (
          <li key={draft.id} className="draft-list__item">
            <div className="draft-list__content">
              <Link className="draft-list__link" to={`/drafts/${draft.id}`}>
                <span className="draft-list__title">{draft.title}</span>
                {state && <StateBadge state={state} />}
              </Link>
              {showStackContext && stack && (
                <p className="draft-list__stack">
                  <span className="draft-list__stack-label">Stack</span>
                  <Link
                    className="draft-list__stack-link"
                    to={`/stacks/${stack.id}`}
                  >
                    {stack.title}
                  </Link>
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
