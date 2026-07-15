import { useCallback, useEffect, useMemo, useState } from "react";
import { type Draft, listDrafts } from "../../api/drafts.ts";
import { listStacks, type Stack } from "../../api/stacks.ts";
import { listStates, type State } from "../../api/states.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { type Loadable, readErrorMessage } from "../../lib/async/loadable.ts";
import { DraftListSection } from "./draft-list-section.tsx";
import { insertDraftInOrder } from "./draft-order.ts";

type DraftListLoadable = Loadable<Draft[]>;

type StackLabelsLoadable =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly stacksById: Map<string, Stack> }
  | { readonly kind: "error"; readonly message: string };

const sortStatesByPosition = (states: readonly State[]): State[] =>
  [...states].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position;
    }

    return left.id.localeCompare(right.id);
  });

export function DraftListScreen() {
  const [statesState, setStatesState] = useState<Loadable<State[]>>({
    kind: "loading",
  });
  const [draftsState, setDraftsState] = useState<DraftListLoadable>({
    kind: "loading",
  });
  const [stackLabelsState, setStackLabelsState] = useState<StackLabelsLoadable>(
    { kind: "loading" },
  );
  const [draftReloadToken, setDraftReloadToken] = useState(0);
  const [stackLabelsReloadToken, setStackLabelsReloadToken] = useState(0);

  const reloadDrafts = useCallback(() => {
    setDraftReloadToken((current) => current + 1);
  }, []);

  const reloadStackLabels = useCallback(() => {
    setStackLabelsReloadToken((current) => current + 1);
  }, []);

  const handleDraftCreated = useCallback((draft: Draft) => {
    setDraftsState((current) => {
      if (current.kind === "ready") {
        return {
          kind: "ready",
          data: insertDraftInOrder(current.data, draft),
        };
      }

      if (current.kind === "error") {
        return {
          kind: "ready",
          data: [draft],
        };
      }

      return current;
    });
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    listStates("draft", signal)
      .then((states) => {
        setStatesState({
          kind: "ready",
          data: sortStatesByPosition(states),
        });
      })
      .catch((error: unknown) => {
        if (signal.aborted || isAbortError(error)) {
          return;
        }

        setStatesState({
          kind: "error",
          message: readErrorMessage(error, "Could not load Draft States."),
        });
      });

    return () => abortController.abort();
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    setDraftsState({ kind: "loading" });

    listDrafts(undefined, signal)
      .then((drafts) => {
        setDraftsState({
          kind: "ready",
          data: drafts,
        });
      })
      .catch((error: unknown) => {
        if (signal.aborted || isAbortError(error)) {
          return;
        }

        setDraftsState({
          kind: "error",
          message: readErrorMessage(error, "Could not load Drafts."),
        });
      });

    return () => abortController.abort();
  }, [draftReloadToken]);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    setStackLabelsState({ kind: "loading" });

    listStacks(undefined, signal)
      .then((stacks) => {
        setStackLabelsState({
          kind: "ready",
          stacksById: new Map(stacks.map((stack) => [stack.id, stack])),
        });
      })
      .catch((error: unknown) => {
        if (signal.aborted || isAbortError(error)) {
          return;
        }

        setStackLabelsState({
          kind: "error",
          message: readErrorMessage(error, "Could not load Stack labels."),
        });
      });

    return () => abortController.abort();
  }, [stackLabelsReloadToken]);

  const statesById = useMemo(() => {
    if (statesState.kind !== "ready") {
      return new Map<string, State>();
    }

    return new Map(statesState.data.map((state) => [state.id, state]));
  }, [statesState]);

  const stacksById = stackLabelsState.kind === "ready"
    ? stackLabelsState.stacksById
    : undefined;

  const drafts = draftsState.kind === "ready" ? draftsState.data : [];
  const showCapture = draftsState.kind === "ready" || draftsState.kind === "error";

  return (
    <section className="page draft-home" aria-labelledby="drafts-heading">
      <p className="page__eyebrow">Home</p>
      <h1 className="page__title" id="drafts-heading">
        Drafts
      </h1>

      {draftsState.kind === "loading" && (
        <p className="draft-home__status" aria-live="polite">
          Loading Drafts…
        </p>
      )}

      {draftsState.kind === "error" && (
        <div className="draft-home__error-panel" role="alert">
          <p className="draft-home__status">{draftsState.message}</p>
          <button
            className="draft-home__retry"
            type="button"
            onClick={reloadDrafts}
          >
            Retry loading Drafts
          </button>
        </div>
      )}

      {showCapture && (
        <div
          className={drafts.length === 0
            ? "draft-home__empty"
            : "draft-home__content"}
        >
          {stackLabelsState.kind === "error" && (
            <div className="draft-home__labels-error" role="alert">
              <p className="draft-home__status">{stackLabelsState.message}</p>
              <button
                className="draft-home__retry"
                type="button"
                onClick={reloadStackLabels}
              >
                Retry loading Stack labels
              </button>
            </div>
          )}

          <DraftListSection
            drafts={drafts}
            statesById={statesById}
            stacksById={stacksById}
            showStackContext
            onDraftCreated={handleDraftCreated}
            formHeading={drafts.length === 0
              ? "Capture your first Draft"
              : undefined}
            emptyLead={drafts.length === 0
              ? "Record work in seconds without creating a Stack first."
              : undefined}
          />
        </div>
      )}
    </section>
  );
}
