import { Link } from "react-router";
import type { Stack } from "../../api/stacks.ts";
import type { State } from "../../api/states.ts";
import { formatDescriptionPreview } from "./description-preview.ts";
import { StateBadge } from "./state-badge.tsx";

interface StackListProps {
  readonly stacks: Stack[];
  readonly statesById: ReadonlyMap<string, State>;
}

export function StackList({ stacks, statesById }: StackListProps) {
  return (
    <ul className="stack-list">
      {stacks.map((stack) => {
        const state = statesById.get(stack.stateId);
        const descriptionPreview = formatDescriptionPreview(stack.description);

        return (
          <li key={stack.id} className="stack-list__item">
            <Link
              className="stack-list__link"
              to={`/stacks/${stack.id}`}
            >
              <span className="stack-list__title">{stack.title}</span>
              {state && <StateBadge state={state} />}
              {descriptionPreview && (
                <span className="stack-list__preview">
                  {descriptionPreview}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
