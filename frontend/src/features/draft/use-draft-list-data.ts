import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Draft, listDrafts } from "../../api/drafts.ts";
import { listStates, type State } from "../../api/states.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { type Loadable, readErrorMessage } from "../../lib/async/loadable.ts";
import { insertDraftInOrder } from "./draft-order.ts";
import { sortStatesByPosition } from "./sort-states-by-position.ts";

type DraftListLoadable = Loadable<Draft[]>;

type StatesLoadable =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly data: State[] }
  | {
    readonly kind: "error";
    readonly message: string;
    readonly data?: State[];
  };

const draftMatchesListFilter = (
  draft: Draft,
  filter: {
    readonly effectiveStateId?: string;
    readonly stackId?: string;
  },
): boolean => {
  if (
    filter.stackId !== undefined &&
    draft.stackId !== filter.stackId
  ) {
    return false;
  }

  if (
    filter.effectiveStateId !== undefined &&
    draft.stateId !== filter.effectiveStateId
  ) {
    return false;
  }

  return true;
};

export interface UseDraftListDataOptions {
  readonly stackId?: string;
  readonly stateId?: string;
  readonly draftsLoadErrorMessage?: string;
}

export interface UseDraftListDataResult {
  readonly states: State[];
  readonly statesById: ReadonlyMap<string, State>;
  readonly drafts: readonly Draft[];
  readonly showCapture: boolean;
  readonly showEmptyState: boolean;
  readonly isLoadingDrafts: boolean;
  readonly draftsLoadError: string | null;
  readonly statesLoadError: string | null;
  readonly reloadDrafts: () => void;
  readonly reloadStates: () => void;
  readonly handleDraftCreated: (draft: Draft) => void;
}

export const useDraftListData = ({
  stackId,
  stateId,
  draftsLoadErrorMessage = "Could not load Drafts.",
}: UseDraftListDataOptions = {}): UseDraftListDataResult => {
  const [statesState, setStatesState] = useState<StatesLoadable>({
    kind: "loading",
  });
  const [draftsState, setDraftsState] = useState<DraftListLoadable>({
    kind: "loading",
  });
  const [draftsCreatedDuringError, setDraftsCreatedDuringError] = useState<
    Draft[]
  >([]);
  const [statesReloadToken, setStatesReloadToken] = useState(0);
  const [draftReloadToken, setDraftReloadToken] = useState(0);
  const draftsStateRef = useRef(draftsState);
  const listFilterRef = useRef<{
    effectiveStateId?: string;
    stackId?: string;
  }>({});

  draftsStateRef.current = draftsState;

  const reloadStates = useCallback(() => {
    setStatesReloadToken((current) => current + 1);
  }, []);

  const reloadDrafts = useCallback(() => {
    setDraftReloadToken((current) => current + 1);
  }, []);

  const handleDraftCreated = useCallback((draft: Draft) => {
    if (!draftMatchesListFilter(draft, listFilterRef.current)) {
      return;
    }

    const current = draftsStateRef.current;

    if (current.kind === "ready") {
      setDraftsState({
        kind: "ready",
        data: insertDraftInOrder(current.data, draft),
      });
      return;
    }

    if (current.kind === "error") {
      setDraftsCreatedDuringError((existing) =>
        insertDraftInOrder(existing, draft)
      );
      setDraftReloadToken((token) => token + 1);
    }
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

        setStatesState((current) => ({
          kind: "error",
          message: readErrorMessage(error, "Could not load Draft States."),
          ...(current.kind === "ready"
            ? { data: current.data }
            : current.kind === "error" && current.data !== undefined
            ? { data: current.data }
            : {}),
        }));
      });

    return () => abortController.abort();
  }, [statesReloadToken]);

  const effectiveStateId = useMemo(() => {
    if (stateId === undefined) {
      return undefined;
    }

    if (statesState.kind !== "ready") {
      return stateId;
    }

    return statesState.data.some((entry) => entry.id === stateId)
      ? stateId
      : undefined;
  }, [stateId, statesState]);

  listFilterRef.current = {
    effectiveStateId,
    stackId,
  };

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    setDraftsState((current) => {
      if (current.kind === "error") {
        return current;
      }

      return { kind: "loading" };
    });

    const filter = {
      ...(effectiveStateId !== undefined ? { stateId: effectiveStateId } : {}),
      ...(stackId !== undefined ? { stackId } : {}),
    };

    listDrafts(
      Object.keys(filter).length > 0 ? filter : undefined,
      signal,
    )
      .then((drafts) => {
        setDraftsCreatedDuringError([]);
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
          message: readErrorMessage(error, draftsLoadErrorMessage),
        });
      });

    return () => abortController.abort();
  }, [draftReloadToken, stackId, effectiveStateId, draftsLoadErrorMessage]);

  const states = statesState.kind === "ready"
    ? statesState.data
    : statesState.kind === "error" && statesState.data !== undefined
    ? statesState.data
    : [];

  const statesById = useMemo(() => {
    return new Map(states.map((state) => [state.id, state]));
  }, [states]);

  const drafts = draftsState.kind === "ready"
    ? draftsState.data
    : draftsCreatedDuringError;
  const showCapture = draftsState.kind === "ready" ||
    draftsState.kind === "error";
  const showEmptyState = draftsState.kind === "ready" &&
    draftsState.data.length === 0;
  const isLoadingDrafts = draftsState.kind === "loading";
  const draftsLoadError = draftsState.kind === "error"
    ? draftsState.message
    : null;
  const statesLoadError = statesState.kind === "error"
    ? statesState.message
    : null;

  return {
    states,
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
  };
};
