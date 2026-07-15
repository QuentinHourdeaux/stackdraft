import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import { DraftListSection } from "./draft-list-section.tsx";
import { DraftStateFilter } from "./draft-state-filter.tsx";
import { useDraftListData } from "./use-draft-list-data.ts";

interface StackDraftSectionProps {
  readonly stackId: string;
}

export function StackDraftSection({ stackId }: StackDraftSectionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const draftStateIdFromUrl = searchParams.get("draftStateId");

  const {
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
  } = useDraftListData({
    stackId,
    stateId: draftStateIdFromUrl ?? undefined,
    draftsLoadErrorMessage: "Could not load Drafts for this Stack.",
  });

  const selectedStateId = useMemo(() => {
    if (draftStateIdFromUrl === null) {
      return null;
    }

    if (states.length === 0) {
      return draftStateIdFromUrl;
    }

    return states.some((state) => state.id === draftStateIdFromUrl)
      ? draftStateIdFromUrl
      : null;
  }, [draftStateIdFromUrl, states]);

  const handleFilterChange = useCallback((stateId: string | null) => {
    if (stateId === null) {
      setSearchParams({}, { replace: false });
      return;
    }

    setSearchParams({ draftStateId: stateId }, { replace: false });
  }, [setSearchParams]);

  useEffect(() => {
    if (
      draftStateIdFromUrl !== null &&
      states.length > 0 &&
      !states.some((state) => state.id === draftStateIdFromUrl)
    ) {
      setSearchParams({}, { replace: true });
    }
  }, [draftStateIdFromUrl, setSearchParams, states]);

  return (
    <section
      className="stack-detail__drafts"
      aria-label="Drafts"
    >
      <h2 className="stack-detail__drafts-heading" id="stack-drafts-heading">
        Drafts
      </h2>

      {isLoadingDrafts && (
        <p className="stack-detail__status" aria-live="polite">
          Loading Drafts…
        </p>
      )}

      {draftsLoadError !== null && (
        <div className="stack-detail__error-panel" role="alert">
          <p className="stack-detail__status">{draftsLoadError}</p>
          <button
            className="stack-detail__retry"
            type="button"
            onClick={reloadDrafts}
          >
            Retry loading Drafts
          </button>
        </div>
      )}

      {showCapture && (
        <div className="draft-section">
          {statesLoadError !== null && (
            <div className="stack-detail__labels-error" role="alert">
              <p className="stack-detail__status">{statesLoadError}</p>
              <button
                className="stack-detail__retry"
                type="button"
                onClick={reloadStates}
              >
                Retry loading Draft States
              </button>
            </div>
          )}

          {(states.length > 0 || draftStateIdFromUrl !== null) && (
            <DraftStateFilter
              states={states}
              selectedStateId={selectedStateId}
              onChange={handleFilterChange}
            />
          )}

          {showEmptyState && selectedStateId !== null
            ? (
              <p className="page__lead">
                No Drafts match this State filter.
              </p>
            )
            : (
              <DraftListSection
                drafts={[...drafts]}
                statesById={statesById}
                showStackContext={false}
                stackId={stackId}
                onDraftCreated={handleDraftCreated}
                emptyLead={showEmptyState
                  ? "Capture the first Draft for this Stack."
                  : undefined}
              />
            )}
        </div>
      )}
    </section>
  );
}
