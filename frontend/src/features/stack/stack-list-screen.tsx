import { useCallback, useEffect, useMemo, useState } from "react";
import { listStacks, type Stack } from "../../api/stacks.ts";
import { listStates, type State } from "../../api/states.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { type Loadable, readErrorMessage } from "../../lib/async/loadable.ts";
import { StackCreateForm } from "./stack-create-form.tsx";
import { StackList } from "./stack-list.tsx";

interface StackHomeData {
  readonly states: State[];
  readonly stacks: Stack[];
}

type StackHomeLoadable = Loadable<StackHomeData>;

export function StackListScreen() {
  const [loadState, setLoadState] = useState<StackHomeLoadable>({
    kind: "loading",
  });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    setLoadState({ kind: "loading" });

    Promise.all([
      listStates("stack", signal),
      listStacks(signal),
    ])
      .then(([states, stacks]) => {
        setLoadState({ kind: "ready", data: { states, stacks } });
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted || isAbortError(error)) {
          return;
        }

        setLoadState({
          kind: "error",
          message: readErrorMessage(error, "Could not load Stacks."),
        });
      });

    return () => abortController.abort();
  }, [reloadToken]);

  const statesById = useMemo(() => {
    if (loadState.kind !== "ready") {
      return new Map<string, State>();
    }

    return new Map(loadState.data.states.map((state) => [state.id, state]));
  }, [loadState]);

  return (
    <section className="page stack-home" aria-labelledby="stacks-heading">
      <p className="page__eyebrow">Home</p>
      <h1 className="page__title" id="stacks-heading">
        Stacks
      </h1>

      {loadState.kind === "loading" && (
        <p className="stack-home__status" aria-live="polite">
          Loading Stacks…
        </p>
      )}

      {loadState.kind === "error" && (
        <div className="stack-home__error-panel" role="alert">
          <p className="stack-home__status">{loadState.message}</p>
          <button
            className="stack-home__retry"
            type="button"
            onClick={reload}
          >
            Retry loading Stacks
          </button>
        </div>
      )}

      {loadState.kind === "ready" && loadState.data.stacks.length === 0 && (
        <div className="stack-home__empty">
          <p className="page__lead">
            Capture your first Stack to start tracking personal engineering
            work.
          </p>
          <StackCreateForm
            states={loadState.data.states}
            heading="Create your first Stack"
          />
        </div>
      )}

      {loadState.kind === "ready" && loadState.data.stacks.length > 0 && (
        <div className="stack-home__content">
          <StackList
            stacks={loadState.data.stacks}
            statesById={statesById}
          />
          <StackCreateForm states={loadState.data.states} />
        </div>
      )}
    </section>
  );
}
