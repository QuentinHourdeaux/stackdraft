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

export interface UseDraftListDataOptions {
  readonly stackId?: string;
  readonly draftsLoadErrorMessage?: string;
}

export interface UseDraftListDataResult {
  readonly statesById: ReadonlyMap<string, State>;
  readonly drafts: readonly Draft[];
  readonly showCapture: boolean;
  readonly isLoadingDrafts: boolean;
  readonly draftsLoadError: string | null;
  readonly statesLoadError: string | null;
  readonly reloadDrafts: () => void;
  readonly reloadStates: () => void;
  readonly handleDraftCreated: (draft: Draft) => void;
}

export const useDraftListData = ({
  stackId,
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

  draftsStateRef.current = draftsState;

  const reloadStates = useCallback(() => {
    setStatesReloadToken((current) => current + 1);
  }, []);

  const reloadDrafts = useCallback(() => {
    setDraftReloadToken((current) => current + 1);
  }, []);

  const handleDraftCreated = useCallback((draft: Draft) => {
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

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    setDraftsState((current) => {
      if (current.kind === "error") {
        return current;
      }

      return { kind: "loading" };
    });

    listDrafts(stackId === undefined ? undefined : { stackId }, signal)
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
  }, [draftReloadToken, stackId, draftsLoadErrorMessage]);

  const statesById = useMemo(() => {
    if (statesState.kind === "ready") {
      return new Map(statesState.data.map((state) => [state.id, state]));
    }

    if (statesState.kind === "error" && statesState.data !== undefined) {
      return new Map(statesState.data.map((state) => [state.id, state]));
    }

    return new Map<string, State>();
  }, [statesState]);

  const drafts = draftsState.kind === "ready"
    ? draftsState.data
    : draftsCreatedDuringError;
  const showCapture = draftsState.kind === "ready" ||
    draftsState.kind === "error";
  const isLoadingDrafts = draftsState.kind === "loading";
  const draftsLoadError = draftsState.kind === "error"
    ? draftsState.message
    : null;
  const statesLoadError = statesState.kind === "error"
    ? statesState.message
    : null;

  return {
    statesById,
    drafts,
    showCapture,
    isLoadingDrafts,
    draftsLoadError,
    statesLoadError,
    reloadDrafts,
    reloadStates,
    handleDraftCreated,
  };
};
