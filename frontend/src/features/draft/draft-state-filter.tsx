import type { State } from "../../api/states.ts";

interface DraftStateFilterProps {
  readonly states: State[];
  readonly selectedStateId: string | null;
  readonly onChange: (stateId: string | null) => void;
}

export function DraftStateFilter({
  states,
  selectedStateId,
  onChange,
}: DraftStateFilterProps) {
  if (states.length === 0) {
    if (selectedStateId === null) {
      return null;
    }

    return (
      <div className="draft-filter draft-filter--unavailable">
        <p className="draft-filter__status">Draft States are unavailable.</p>
        <button
          className="draft-filter__clear"
          type="button"
          onClick={() => onChange(null)}
        >
          Show all Drafts
        </button>
      </div>
    );
  }

  const groupName = "draft-state-filter";

  return (
    <fieldset className="draft-filter">
      <legend className="draft-filter__legend">Filter by State</legend>
      <div className="draft-filter__options">
        <label className="draft-filter__option">
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
          <label key={state.id} className="draft-filter__option">
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
