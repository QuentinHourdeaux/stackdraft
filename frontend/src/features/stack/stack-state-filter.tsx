import type { State } from "../../api/states.ts";

interface StackStateFilterProps {
  readonly states: State[];
  readonly selectedStateId: string | null;
  readonly onChange: (stateId: string | null) => void;
}

export function StackStateFilter({
  states,
  selectedStateId,
  onChange,
}: StackStateFilterProps) {
  const groupName = "stack-state-filter";

  return (
    <fieldset className="stack-filter">
      <legend className="stack-filter__legend">Filter by State</legend>
      <div className="stack-filter__options">
        <label className="stack-filter__option">
          <input
            type="radio"
            name={groupName}
            value=""
            checked={selectedStateId === null}
            onChange={() => onChange(null)}
          />
          <span>All</span>
        </label>
        {states.map((state) => (
          <label key={state.id} className="stack-filter__option">
            <input
              type="radio"
              name={groupName}
              value={state.id}
              checked={selectedStateId === state.id}
              onChange={() =>
                onChange(state.id)}
            />
            <span>{state.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
