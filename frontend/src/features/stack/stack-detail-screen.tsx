import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { getStack, type Stack } from "../../api/stacks.ts";
import { listStates, type State } from "../../api/states.ts";
import { isApiError } from "../../lib/api/api-error.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { readErrorMessage } from "../../lib/async/loadable.ts";
import { StackEditForm } from "./stack-edit-form.tsx";

interface StackDetailData {
  readonly stack: Stack;
  readonly states: State[];
}

type StackDetailLoadable =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly data: StackDetailData }
  | { readonly kind: "not-found" }
  | { readonly kind: "error"; readonly message: string };

export function StackDetailScreen() {
  const { stackId = "" } = useParams();
  const [loadState, setLoadState] = useState<StackDetailLoadable>({
    kind: "loading",
  });
  const [reloadToken, setReloadToken] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  const handleUpdated = useCallback((stack: Stack) => {
    setLoadState((current) => {
      if (current.kind !== "ready") {
        return current;
      }

      return {
        kind: "ready",
        data: {
          ...current.data,
          stack,
        },
      };
    });
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    setLoadState({ kind: "loading" });

    Promise.all([
      getStack(stackId, signal),
      listStates("stack", signal),
    ])
      .then(([stack, states]) => {
        setLoadState({ kind: "ready", data: { stack, states } });
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted || isAbortError(error)) {
          return;
        }

        if (isApiError(error) && error.code === "STACK_NOT_FOUND") {
          setLoadState({ kind: "not-found" });
          return;
        }

        setLoadState({
          kind: "error",
          message: readErrorMessage(error, "Could not load this Stack."),
        });
      });

    return () => abortController.abort();
  }, [stackId, reloadToken]);

  useEffect(() => {
    if (loadState.kind !== "ready") {
      return;
    }

    headingRef.current?.focus();
  }, [loadState]);

  if (loadState.kind === "loading") {
    return (
      <section
        className="page stack-detail"
        aria-labelledby="stack-detail-heading"
      >
        <p className="page__eyebrow">Stack</p>
        <h1 className="page__title" id="stack-detail-heading">
          Stack
        </h1>
        <p className="stack-detail__status" aria-live="polite">
          Loading Stack…
        </p>
      </section>
    );
  }

  if (loadState.kind === "not-found") {
    return (
      <section
        className="page page--centered stack-detail"
        aria-labelledby="stack-not-found-heading"
      >
        <h1 className="page__title" id="stack-not-found-heading">
          Stack not found
        </h1>
        <p className="page__lead">
          This Stack does not exist or is no longer available.
        </p>
        <p>
          <Link className="page__action-link" to="/">
            Back to Stacks
          </Link>
        </p>
      </section>
    );
  }

  if (loadState.kind === "error") {
    return (
      <section
        className="page stack-detail"
        aria-labelledby="stack-detail-heading"
      >
        <p className="page__eyebrow">Stack</p>
        <h1 className="page__title" id="stack-detail-heading">
          Stack
        </h1>
        <div className="stack-detail__error-panel" role="alert">
          <p className="stack-detail__status">{loadState.message}</p>
          <button
            className="stack-detail__retry"
            type="button"
            onClick={reload}
          >
            Retry loading Stack
          </button>
        </div>
      </section>
    );
  }

  const { stack, states } = loadState.data;

  return (
    <section
      className="page stack-detail"
      aria-labelledby="stack-detail-heading"
    >
      <p className="page__eyebrow">Stack</p>
      <h1
        className="page__title"
        id="stack-detail-heading"
        ref={headingRef}
        tabIndex={-1}
      >
        {stack.title}
      </h1>

      <StackEditForm
        stack={stack}
        states={states}
        onUpdated={handleUpdated}
      />

      <p>
        <Link className="page__action-link" to="/">
          Back to Stacks
        </Link>
      </p>
    </section>
  );
}
