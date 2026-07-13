import { useCallback, useEffect, useMemo, useState } from "react";
import { type Draft, listDrafts } from "../../api/drafts.ts";
import { listStates, type State } from "../../api/states.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { type Loadable, readErrorMessage } from "../../lib/async/loadable.ts";
import { DraftListSection } from "./draft-list-section.tsx";
import { insertDraftInOrder } from "./draft-order.ts";

interface StackDraftSectionProps {
  readonly stackId: string;
}

interface StackDraftData {
  readonly states: State[];
  readonly drafts: Draft[];
}

type StackDraftLoadable = Loadable<StackDraftData>;

const sortStatesByPosition = (states: readonly State[]): State[] =>
  [...states].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position;
    }

    return left.id.localeCompare(right.id);
  });

export function StackDraftSection({ stackId }: StackDraftSectionProps) {
  const [loadState, setLoadState] = useState<StackDraftLoadable>({
    kind: "loading",
  });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  const handleDraftCreated = useCallback((draft: Draft) => {
    setLoadState((current) => {
      if (current.kind !== "ready") {
        return current;
      }

      return {
        kind: "ready",
        data: {
          ...current.data,
          drafts: insertDraftInOrder(current.data.drafts, draft),
        },
      };
    });
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    setLoadState({ kind: "loading" });

    Promise.all([
      listStates("draft", signal),
      listDrafts({ stackId }, signal),
    ])
      .then(([states, drafts]) => {
        setLoadState({
          kind: "ready",
          data: {
            states: sortStatesByPosition(states),
            drafts,
          },
        });
      })
      .catch((error: unknown) => {
        if (signal.aborted || isAbortError(error)) {
          return;
        }

        setLoadState({
          kind: "error",
          message: readErrorMessage(
            error,
            "Could not load Drafts for this Stack.",
          ),
        });
      });

    return () => abortController.abort();
  }, [stackId, reloadToken]);

  const statesById = useMemo(() => {
    if (loadState.kind !== "ready") {
      return new Map<string, State>();
    }

    return new Map(loadState.data.states.map((state) => [state.id, state]));
  }, [loadState]);

  return (
    <section
      className="stack-detail__drafts"
      aria-label="Drafts"
    >
      <h2 className="stack-detail__drafts-heading" id="stack-drafts-heading">
        Drafts
      </h2>

      {loadState.kind === "loading" && (
        <p className="stack-detail__status" aria-live="polite">
          Loading Drafts…
        </p>
      )}

      {loadState.kind === "error" && (
        <div className="stack-detail__error-panel" role="alert">
          <p className="stack-detail__status">{loadState.message}</p>
          <button
            className="stack-detail__retry"
            type="button"
            onClick={reload}
          >
            Retry loading Drafts
          </button>
        </div>
      )}

      {loadState.kind === "ready" && (
        <DraftListSection
          drafts={loadState.data.drafts}
          statesById={statesById}
          showStackContext={false}
          stackId={stackId}
          onDraftCreated={handleDraftCreated}
          emptyLead="Capture the first Draft for this Stack."
        />
      )}
    </section>
  );
}
