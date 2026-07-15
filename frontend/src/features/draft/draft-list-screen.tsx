import { useCallback, useEffect, useState } from "react";
import { listStacks, type Stack } from "../../api/stacks.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { readErrorMessage } from "../../lib/async/loadable.ts";
import { DraftListSection } from "./draft-list-section.tsx";
import { useDraftListData } from "./use-draft-list-data.ts";

type StackLabelsLoadable =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly stacksById: Map<string, Stack> }
  | {
    readonly kind: "error";
    readonly message: string;
    readonly stacksById?: Map<string, Stack>;
  };

export function DraftListScreen() {
  const {
    statesById,
    drafts,
    showCapture,
    showEmptyState,
    isLoadingDrafts,
    draftsLoadError,
    statesLoadError,
    reloadDrafts,
    reloadStates,
    handleDraftCreated,
  } = useDraftListData();
  const [stackLabelsState, setStackLabelsState] = useState<StackLabelsLoadable>(
    { kind: "loading" },
  );
  const [stackLabelsReloadToken, setStackLabelsReloadToken] = useState(0);

  const reloadStackLabels = useCallback(() => {
    setStackLabelsReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

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

        setStackLabelsState((current) => ({
          kind: "error",
          message: readErrorMessage(error, "Could not load Stack labels."),
          ...(current.kind === "ready" || current.kind === "error"
            ? { stacksById: current.stacksById }
            : {}),
        }));
      });

    return () => abortController.abort();
  }, [stackLabelsReloadToken]);

  const stacksById = stackLabelsState.kind === "ready" ||
      (stackLabelsState.kind === "error" &&
        stackLabelsState.stacksById !== undefined)
    ? stackLabelsState.stacksById
    : undefined;

  return (
    <section className="page draft-home" aria-labelledby="drafts-heading">
      <p className="page__eyebrow">Home</p>
      <h1 className="page__title" id="drafts-heading">
        Drafts
      </h1>

      {isLoadingDrafts && (
        <p className="draft-home__status" aria-live="polite">
          Loading Drafts…
        </p>
      )}

      {draftsLoadError !== null && (
        <div className="draft-home__error-panel" role="alert">
          <p className="draft-home__status">{draftsLoadError}</p>
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
          className={showEmptyState
            ? "draft-home__empty"
            : "draft-home__content"}
        >
          {statesLoadError !== null && (
            <div className="draft-home__labels-error" role="alert">
              <p className="draft-home__status">{statesLoadError}</p>
              <button
                className="draft-home__retry"
                type="button"
                onClick={reloadStates}
              >
                Retry loading Draft States
              </button>
            </div>
          )}

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
            drafts={[...drafts]}
            statesById={statesById}
            stacksById={stacksById}
            showStackContext
            onDraftCreated={handleDraftCreated}
            formHeading={showEmptyState
              ? "Capture your first Draft"
              : undefined}
            emptyLead={showEmptyState
              ? "Record work in seconds without creating a Stack first."
              : undefined}
          />
        </div>
      )}
    </section>
  );
}
