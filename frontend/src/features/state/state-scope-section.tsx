import { useCallback, useEffect, useState } from "react";
import { listStates, type State, type StateScope } from "../../api/states.ts";
import { isAbortError } from "./form-errors.ts";
import { StateCreateForm } from "./state-create-form.tsx";
import { StateList } from "./state-list.tsx";

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly states: State[] }
  | { readonly kind: "error"; readonly message: string };

interface StateScopeSectionProps {
  readonly scope: StateScope;
  readonly title: string;
  readonly description: string;
}

export function StateScopeSection({
  scope,
  title,
  description,
}: StateScopeSectionProps) {
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    setLoadState({ kind: "loading" });

    listStates(scope, abortController.signal)
      .then((states) => {
        setLoadState({ kind: "ready", states });
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted || isAbortError(error)) {
          return;
        }

        setLoadState({
          kind: "error",
          message: error instanceof Error
            ? error.message
            : "Could not load states.",
        });
      });

    return () => abortController.abort();
  }, [scope, reloadToken]);

  const handleStateCreated = (createdState: State) => {
    setLoadState((current) => {
      if (current.kind === "ready") {
        return {
          kind: "ready",
          states: [...current.states, createdState],
        };
      }

      return {
        kind: "ready",
        states: [createdState],
      };
    });
  };

  const handleStateUpdated = (updatedState: State) => {
    setLoadState((current) => {
      if (current.kind !== "ready") {
        return current;
      }

      return {
        kind: "ready",
        states: current.states.map((state) =>
          state.id === updatedState.id ? updatedState : state
        ),
      };
    });
  };

  const sectionId = `state-scope-${scope}`;

  return (
    <section
      className="state-scope"
      aria-labelledby={`${sectionId}-heading`}
    >
      <div className="state-scope__header">
        <h2 className="state-scope__title" id={`${sectionId}-heading`}>
          {title}
        </h2>
        <p className="state-scope__description">{description}</p>
      </div>

      {loadState.kind === "loading" && (
        <p className="state-scope__status" aria-live="polite">
          Loading {scope} states…
        </p>
      )}

      {loadState.kind === "error" && (
        <div className="state-scope__error-panel" role="alert">
          <p className="state-scope__status">{loadState.message}</p>
          <button
            className="state-scope__retry"
            type="button"
            onClick={reload}
          >
            Retry loading {scope} states
          </button>
        </div>
      )}

      {loadState.kind === "ready" && (
        <>
          <StateList
            states={loadState.states}
            onStateUpdated={handleStateUpdated}
          />
          <StateCreateForm scope={scope} onCreated={handleStateCreated} />
        </>
      )}
    </section>
  );
}
