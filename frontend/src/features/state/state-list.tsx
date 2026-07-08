import { useState } from "react";
import type { State } from "../../api/states.ts";
import { StateEditForm } from "./state-edit-form.tsx";

interface StateListProps {
  readonly states: readonly State[];
  readonly onStateUpdated: (state: State) => void;
}

export function StateList({ states, onStateUpdated }: StateListProps) {
  const [editingState, setEditingState] = useState<State | null>(null);

  if (states.length === 0) {
    return <p className="state-scope__empty">No states yet. Add one below.</p>;
  }

  return (
    <>
      <ul className="state-list">
        {states.map((state) => (
          <li key={state.id} className="state-list__item">
            <div className="state-list__identity">
              <span
                className="state-list__swatch"
                style={{ backgroundColor: state.color }}
                aria-label={`${state.name} color`}
              />
              <span className="state-list__name">{state.name}</span>
              {state.isDefault && (
                <span className="state-list__default">Default</span>
              )}
            </div>
            <button
              className="state-list__edit"
              type="button"
              onClick={() => setEditingState(state)}
            >
              Edit {state.name}
            </button>
          </li>
        ))}
      </ul>

      {editingState && (
        <StateEditForm
          state={editingState}
          onClose={() => setEditingState(null)}
          onUpdated={onStateUpdated}
        />
      )}
    </>
  );
}
