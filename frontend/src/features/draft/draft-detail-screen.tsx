import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { type Draft, getDraft } from "../../api/drafts.ts";
import { getStack, type Stack } from "../../api/stacks.ts";
import { listStates, type State } from "../../api/states.ts";
import { isApiError } from "../../lib/api/api-error.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { readErrorMessage } from "../../lib/async/loadable.ts";
import { StateBadge } from "../stack/state-badge.tsx";

interface DraftDetailData {
  readonly draft: Draft;
  readonly states: State[];
  readonly stack: Stack | null;
}

type DraftDetailLoadable =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly data: DraftDetailData }
  | { readonly kind: "not-found" }
  | { readonly kind: "error"; readonly message: string };

export function DraftDetailScreen() {
  const { draftId = "" } = useParams();
  const [loadState, setLoadState] = useState<DraftDetailLoadable>({
    kind: "loading",
  });
  const [reloadToken, setReloadToken] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeadingOnReadyRef = useRef(false);

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    setLoadState({ kind: "loading" });

    void (async () => {
      try {
        const [draft, states] = await Promise.all([
          getDraft(draftId, signal),
          listStates("draft", signal),
        ]);

        if (signal.aborted) {
          return;
        }

        const stack = draft.stackId === null
          ? null
          : await getStack(draft.stackId, signal);

        if (signal.aborted) {
          return;
        }

        focusHeadingOnReadyRef.current = true;
        setLoadState({
          kind: "ready",
          data: { draft, states, stack },
        });
      } catch (error: unknown) {
        if (signal.aborted || isAbortError(error)) {
          return;
        }

        if (isApiError(error) && error.code === "DRAFT_NOT_FOUND") {
          setLoadState({ kind: "not-found" });
          return;
        }

        setLoadState({
          kind: "error",
          message: readErrorMessage(error, "Could not load this Draft."),
        });
      }
    })();

    return () => abortController.abort();
  }, [draftId, reloadToken]);

  useEffect(() => {
    if (loadState.kind !== "ready" || !focusHeadingOnReadyRef.current) {
      return;
    }

    focusHeadingOnReadyRef.current = false;
    headingRef.current?.focus();
  }, [loadState]);

  if (loadState.kind === "loading") {
    return (
      <section
        className="page draft-detail"
        aria-labelledby="draft-detail-heading"
      >
        <p className="page__eyebrow">Draft</p>
        <h1 className="page__title" id="draft-detail-heading">
          Draft
        </h1>
        <p className="draft-detail__status" aria-live="polite">
          Loading Draft…
        </p>
      </section>
    );
  }

  if (loadState.kind === "not-found") {
    return (
      <section
        className="page page--centered draft-detail"
        aria-labelledby="draft-not-found-heading"
      >
        <h1 className="page__title" id="draft-not-found-heading">
          Draft not found
        </h1>
        <p className="page__lead">
          This Draft does not exist or is no longer available.
        </p>
        <p>
          <Link className="page__action-link" to="/">
            Back to Drafts
          </Link>
        </p>
      </section>
    );
  }

  if (loadState.kind === "error") {
    return (
      <section
        className="page draft-detail"
        aria-labelledby="draft-detail-heading"
      >
        <p className="page__eyebrow">Draft</p>
        <h1 className="page__title" id="draft-detail-heading">
          Draft
        </h1>
        <div className="draft-detail__error-panel" role="alert">
          <p className="draft-detail__status">{loadState.message}</p>
          <button
            className="draft-detail__retry"
            type="button"
            onClick={reload}
          >
            Retry loading Draft
          </button>
        </div>
      </section>
    );
  }

  const { draft, states, stack } = loadState.data;
  const state = states.find((entry) => entry.id === draft.stateId);

  return (
    <section
      className="page draft-detail"
      aria-labelledby="draft-detail-heading"
    >
      <p className="page__eyebrow">Draft</p>
      <h1
        className="page__title"
        id="draft-detail-heading"
        ref={headingRef}
        tabIndex={-1}
      >
        {draft.title}
      </h1>

      {state && (
        <p className="draft-detail__state">
          <StateBadge state={state} />
        </p>
      )}

      {stack && (
        <p className="draft-detail__stack">
          <span className="draft-detail__stack-label">Stack</span>
          <Link className="draft-detail__stack-link" to={`/stacks/${stack.id}`}>
            {stack.title}
          </Link>
        </p>
      )}

      {draft.description.trim().length > 0
        ? <p className="draft-detail__description">{draft.description}</p>
        : (
          <p className="draft-detail__description draft-detail__description--empty">
            No description yet.
          </p>
        )}

      <p>
        <Link className="page__action-link" to="/">
          Back to Drafts
        </Link>
      </p>
    </section>
  );
}
