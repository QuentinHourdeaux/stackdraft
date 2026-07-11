import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { listStacks, type Stack } from "../../api/stacks.ts";
import { listStates, type State } from "../../api/states.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { type Loadable, readErrorMessage } from "../../lib/async/loadable.ts";
import { StackCreateForm } from "./stack-create-form.tsx";
import { StackList } from "./stack-list.tsx";
import { StackStateFilter } from "./stack-state-filter.tsx";

interface StackHomeData {
  readonly states: State[];
  readonly stacks: Stack[];
}

type StackHomeLoadable = Loadable<StackHomeData>;

const sortStatesByPosition = (states: readonly State[]): State[] =>
  [...states].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position;
    }

    return left.id.localeCompare(right.id);
  });

export function StackListScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const stateIdFromUrl = searchParams.get("stateId");
  const [loadState, setLoadState] = useState<StackHomeLoadable>({
    kind: "loading",
  });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  const handleFilterChange = useCallback((stateId: string | null) => {
    if (stateId === null) {
      setSearchParams({}, { replace: false });
      return;
    }

    setSearchParams({ stateId }, { replace: false });
  }, [setSearchParams]);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    setLoadState({ kind: "loading" });

    void (async () => {
      try {
        const states = await listStates("stack", signal);
        if (signal.aborted) {
          return;
        }

        const sortedStates = sortStatesByPosition(states);
        const filterStateId = stateIdFromUrl !== null &&
            sortedStates.some((state) => state.id === stateIdFromUrl)
          ? stateIdFromUrl
          : undefined;

        if (
          stateIdFromUrl !== null &&
          filterStateId === undefined
        ) {
          setSearchParams({}, { replace: true });
          if (signal.aborted) {
            return;
          }
        }

        const stacks = await listStacks(
          filterStateId === undefined ? undefined : { stateId: filterStateId },
          signal,
        );
        if (signal.aborted) {
          return;
        }

        setLoadState({
          kind: "ready",
          data: {
            states: sortedStates,
            stacks,
          },
        });
      } catch (error: unknown) {
        if (signal.aborted || isAbortError(error)) {
          return;
        }

        setLoadState({
          kind: "error",
          message: readErrorMessage(error, "Could not load Stacks."),
        });
      }
    })();

    return () => abortController.abort();
  }, [stateIdFromUrl, reloadToken, setSearchParams]);

  const statesById = useMemo(() => {
    if (loadState.kind !== "ready") {
      return new Map<string, State>();
    }

    return new Map(loadState.data.states.map((state) => [state.id, state]));
  }, [loadState]);

  const selectedStateId = useMemo(() => {
    if (stateIdFromUrl === null) {
      return null;
    }

    if (loadState.kind !== "ready") {
      return stateIdFromUrl;
    }

    return loadState.data.states.some((state) => state.id === stateIdFromUrl)
      ? stateIdFromUrl
      : null;
  }, [loadState, stateIdFromUrl]);

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
          {loadState.data.states.length > 0 && (
            <StackStateFilter
              states={loadState.data.states}
              selectedStateId={selectedStateId}
              onChange={handleFilterChange}
            />
          )}
          {selectedStateId === null
            ? (
              <>
                <p className="page__lead">
                  Capture your first Stack to start tracking personal
                  engineering work.
                </p>
                <StackCreateForm
                  states={loadState.data.states}
                  heading="Create your first Stack"
                />
              </>
            )
            : (
              <p className="page__lead">
                No Stacks match this State filter.
              </p>
            )}
        </div>
      )}

      {loadState.kind === "ready" && loadState.data.stacks.length > 0 && (
        <div className="stack-home__content">
          <StackStateFilter
            states={loadState.data.states}
            selectedStateId={selectedStateId}
            onChange={handleFilterChange}
          />
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
