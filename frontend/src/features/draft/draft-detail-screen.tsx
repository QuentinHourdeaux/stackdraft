import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { type Draft, getDraft } from "../../api/drafts.ts";
import { getStack, type Stack } from "../../api/stacks.ts";
import { listStates, type State } from "../../api/states.ts";
import { isApiError } from "../../lib/api/api-error.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { readErrorMessage } from "../../lib/async/loadable.ts";
import { StateBadge } from "../stack/state-badge.tsx";
import { sortStatesByPosition } from "./sort-states-by-position.ts";

type DraftLoadable =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly draft: Draft }
  | { readonly kind: "not-found" }
  | { readonly kind: "error"; readonly message: string };

type StatesEnrichmentLoadable =
  | { readonly kind: "none" }
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly states: State[] }
  | {
    readonly kind: "error";
    readonly message: string;
    readonly states?: State[];
  };

type StackEnrichmentLoadable =
  | { readonly kind: "none" }
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly stack: Stack }
  | { readonly kind: "error"; readonly message: string };

export function DraftDetailScreen() {
  const { draftId = "" } = useParams();
  const [draftState, setDraftState] = useState<DraftLoadable>({
    kind: "loading",
  });
  const [statesState, setStatesState] = useState<StatesEnrichmentLoadable>({
    kind: "none",
  });
  const [stackState, setStackState] = useState<StackEnrichmentLoadable>({
    kind: "none",
  });
  const [reloadToken, setReloadToken] = useState(0);
  const [statesReloadToken, setStatesReloadToken] = useState(0);
  const [stackReloadToken, setStackReloadToken] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeadingOnReadyRef = useRef(false);

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  const reloadStates = useCallback(() => {
    setStatesReloadToken((current) => current + 1);
  }, []);

  const reloadStack = useCallback(() => {
    setStackReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    setDraftState({ kind: "loading" });
    setStatesState({ kind: "none" });
    setStackState({ kind: "none" });

    void (async () => {
      try {
        const draft = await getDraft(draftId, signal);

        if (signal.aborted) {
          return;
        }

        focusHeadingOnReadyRef.current = true;
        setDraftState({
          kind: "ready",
          draft,
        });
      } catch (error: unknown) {
        if (signal.aborted || isAbortError(error)) {
          return;
        }

        if (isApiError(error) && error.code === "DRAFT_NOT_FOUND") {
          setDraftState({ kind: "not-found" });
          return;
        }

        setDraftState({
          kind: "error",
          message: readErrorMessage(error, "Could not load this Draft."),
        });
      }
    })();

    return () => abortController.abort();
  }, [draftId, reloadToken]);

  useEffect(() => {
    if (draftState.kind !== "ready") {
      setStatesState({ kind: "none" });
      return;
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    setStatesState((current) => {
      if (current.kind === "error") {
        return current;
      }

      return { kind: "loading" };
    });

    void (async () => {
      try {
        const states = await listStates("draft", signal);

        if (signal.aborted) {
          return;
        }

        setStatesState({
          kind: "ready",
          states: sortStatesByPosition(states),
        });
      } catch (error: unknown) {
        if (signal.aborted || isAbortError(error)) {
          return;
        }

        setStatesState((current) => ({
          kind: "error",
          message: readErrorMessage(error, "Could not load Draft States."),
          ...(current.kind === "ready"
            ? { states: current.states }
            : current.kind === "error" && current.states !== undefined
            ? { states: current.states }
            : {}),
        }));
      }
    })();

    return () => abortController.abort();
  }, [draftState, statesReloadToken]);

  useEffect(() => {
    if (draftState.kind !== "ready" || draftState.draft.stackId === null) {
      setStackState({ kind: "none" });
      return;
    }

    const abortController = new AbortController();
    const { signal } = abortController;
    const { stackId } = draftState.draft;

    setStackState((current) => {
      if (current.kind === "ready" && current.stack.id === stackId) {
        return current;
      }

      if (current.kind === "error") {
        return current;
      }

      return { kind: "loading" };
    });

    void (async () => {
      try {
        const stack = await getStack(stackId, signal);

        if (signal.aborted) {
          return;
        }

        setStackState({
          kind: "ready",
          stack,
        });
      } catch (error: unknown) {
        if (signal.aborted || isAbortError(error)) {
          return;
        }

        setStackState({
          kind: "error",
          message: readErrorMessage(error, "Could not load Stack context."),
        });
      }
    })();

    return () => abortController.abort();
  }, [draftState, stackReloadToken]);

  useEffect(() => {
    if (draftState.kind !== "ready" || !focusHeadingOnReadyRef.current) {
      return;
    }

    focusHeadingOnReadyRef.current = false;
    headingRef.current?.focus();
  }, [draftState]);

  if (draftState.kind === "loading") {
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

  if (draftState.kind === "not-found") {
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

  if (draftState.kind === "error") {
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
          <p className="draft-detail__status">{draftState.message}</p>
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

  const { draft } = draftState;
  const states = statesState.kind === "ready"
    ? statesState.states
    : statesState.kind === "error" && statesState.states !== undefined
    ? statesState.states
    : [];
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

      {statesState.kind === "error" && (
        <div className="draft-detail__enrichment-error" role="alert">
          <p className="draft-detail__status">{statesState.message}</p>
          <button
            className="draft-detail__retry"
            type="button"
            onClick={reloadStates}
          >
            Retry loading Draft States
          </button>
        </div>
      )}

      {state && (
        <p className="draft-detail__state">
          <StateBadge state={state} />
        </p>
      )}

      {stackState.kind === "error" && (
        <div className="draft-detail__enrichment-error" role="alert">
          <p className="draft-detail__status">{stackState.message}</p>
          <button
            className="draft-detail__retry"
            type="button"
            onClick={reloadStack}
          >
            Retry loading Stack context
          </button>
        </div>
      )}

      {stackState.kind === "ready" && (
        <p className="draft-detail__stack">
          <span className="draft-detail__stack-label">Stack</span>
          <Link
            className="draft-detail__stack-link"
            to={`/stacks/${stackState.stack.id}`}
          >
            {stackState.stack.title}
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
