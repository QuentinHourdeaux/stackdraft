import type { State } from "../../api/states.ts";

interface StateBadgeProps {
  readonly state: State;
}

export function StateBadge({ state }: StateBadgeProps) {
  return (
    <span className="state-badge">
      <span
        className="state-badge__swatch"
        style={{ backgroundColor: state.color }}
        aria-hidden="true"
      />
      <span className="state-badge__name">{state.name}</span>
    </span>
  );
}
