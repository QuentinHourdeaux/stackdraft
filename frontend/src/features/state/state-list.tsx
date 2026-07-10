import { useState } from "react";
import {
  setDefaultState,
  type State,
  type StateScope,
  updateStatePosition,
} from "../../api/states.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { readErrorMessage } from "../../lib/async/loadable.ts";
import { StateDeleteDialog } from "./state-delete-dialog.tsx";
import { StateEditForm } from "./state-edit-form.tsx";

interface StateListProps {
  readonly scope: StateScope;
  readonly states: readonly State[];
  readonly onStateUpdated: (state: State) => void;
  readonly onStatesReordered: (states: State[]) => void;
  readonly onDefaultChanged: () => void;
  readonly onStateDeleted: () => void;
}

export function StateList({
  scope,
  states,
  onStateUpdated,
  onStatesReordered,
  onDefaultChanged,
  onStateDeleted,
}: StateListProps) {
  const [editingState, setEditingState] = useState<State | null>(null);
  const [deletingState, setDeletingState] = useState<State | null>(null);
  const [movingStateId, setMovingStateId] = useState<string | null>(null);
  const [selectingDefaultStateId, setSelectingDefaultStateId] = useState<
    string | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<
    Readonly<Record<string, string>>
  >({});

  if (states.length === 0) {
    return <p className="state-scope__empty">No states yet. Add one below.</p>;
  }

  const lastIndex = states.length - 1;
  const defaultGroupName = `default-${scope}-state`;
  const isMutating = movingStateId !== null || selectingDefaultStateId !== null;

  const handleMove = async (state: State, targetPosition: number) => {
    if (movingStateId !== null) {
      return;
    }

    setMovingStateId(state.id);
    setActionError(null);
    setDeleteErrors((current) => {
      if (!(state.id in current)) {
        return current;
      }

      const next = { ...current };
      delete next[state.id];
      return next;
    });

    try {
      const reorderedStates = await updateStatePosition(
        state.id,
        targetPosition,
      );
      onStatesReordered(reorderedStates);
    } catch (error) {
      if (!isAbortError(error)) {
        setActionError(
          readErrorMessage(
            error,
            "Could not move the State. Please try again.",
          ),
        );
      }
    } finally {
      setMovingStateId(null);
    }
  };

  const handleDefaultChange = async (state: State) => {
    if (state.isDefault || selectingDefaultStateId !== null) {
      return;
    }

    setSelectingDefaultStateId(state.id);
    setActionError(null);

    try {
      await setDefaultState(state.id);
      onDefaultChanged();
    } catch (error) {
      if (!isAbortError(error)) {
        setActionError(
          readErrorMessage(
            error,
            "Could not change the default State. Please try again.",
          ),
        );
      }
    } finally {
      setSelectingDefaultStateId(null);
    }
  };

  const handleDeleteBlocked = (stateId: string, message: string) => {
    setDeleteErrors((current) => ({
      ...current,
      [stateId]: message,
    }));
  };

  return (
    <>
      <fieldset className="state-list__default-fieldset">
        <legend className="state-list__default-legend">Default state</legend>
        {actionError && (
          <p className="state-list__action-error" role="alert">
            {actionError}
          </p>
        )}
        <ul className="state-list">
          {states.map((state) => {
            const defaultInputId = `${defaultGroupName}-${state.id}`;
            const deleteError = deleteErrors[state.id];
            const isMoving = movingStateId === state.id;

            return (
              <li key={state.id} className="state-list__item">
                <div className="state-list__main">
                  <div className="state-list__default-choice">
                    <input
                      className="state-list__default-input"
                      type="radio"
                      id={defaultInputId}
                      name={defaultGroupName}
                      checked={state.isDefault}
                      disabled={isMutating}
                      onChange={() => {
                        void handleDefaultChange(state);
                      }}
                    />
                    <label
                      className="state-list__default-label"
                      htmlFor={defaultInputId}
                    >
                      Set {state.name} as default
                    </label>
                  </div>

                  <div className="state-list__identity">
                    <span
                      className="state-list__swatch"
                      style={{ backgroundColor: state.color }}
                      aria-label={`${state.name} color`}
                    />
                    <span className="state-list__name">{state.name}</span>
                    {state.isDefault && (
                      <span className="state-list__default-badge">Default</span>
                    )}
                  </div>

                  {deleteError && (
                    <p
                      className="state-list__delete-error"
                      role="alert"
                      id={`${state.id}-delete-error`}
                    >
                      {deleteError}
                    </p>
                  )}
                </div>

                <div className="state-list__actions">
                  <button
                    className="state-list__move"
                    type="button"
                    disabled={state.position === 0 || isMutating}
                    aria-disabled={state.position === 0 || isMutating}
                    onClick={() => {
                      void handleMove(state, state.position - 1);
                    }}
                  >
                    {isMoving ? "Moving…" : `Move ${state.name} up`}
                  </button>
                  <button
                    className="state-list__move"
                    type="button"
                    disabled={state.position === lastIndex || isMutating}
                    aria-disabled={state.position === lastIndex || isMutating}
                    onClick={() => {
                      void handleMove(state, state.position + 1);
                    }}
                  >
                    {isMoving ? "Moving…" : `Move ${state.name} down`}
                  </button>
                  <button
                    className="state-list__edit"
                    type="button"
                    disabled={isMutating}
                    onClick={() => setEditingState(state)}
                  >
                    Edit {state.name}
                  </button>
                  <button
                    className="state-list__delete"
                    type="button"
                    disabled={isMutating || deletingState !== null}
                    onClick={() => setDeletingState(state)}
                  >
                    Delete {state.name}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {editingState && (
        <StateEditForm
          state={editingState}
          onClose={() => setEditingState(null)}
          onUpdated={onStateUpdated}
        />
      )}

      {deletingState && (
        <StateDeleteDialog
          state={deletingState}
          onClose={() => setDeletingState(null)}
          onDeleted={() => {
            onStateDeleted();
            setDeleteErrors((current) => {
              if (!(deletingState.id in current)) {
                return current;
              }

              const next = { ...current };
              delete next[deletingState.id];
              return next;
            });
          }}
          onDeleteBlocked={(message) => {
            handleDeleteBlocked(deletingState.id, message);
          }}
        />
      )}
    </>
  );
}
