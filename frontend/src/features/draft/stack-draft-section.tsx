import { DraftListSection } from "./draft-list-section.tsx";
import { useDraftListData } from "./use-draft-list-data.ts";

interface StackDraftSectionProps {
  readonly stackId: string;
}

export function StackDraftSection({ stackId }: StackDraftSectionProps) {
  const {
    statesById,
    drafts,
    showCapture,
    isLoadingDrafts,
    draftsLoadError,
    statesLoadError,
    reloadDrafts,
    reloadStates,
    handleDraftCreated,
  } = useDraftListData({
    stackId,
    draftsLoadErrorMessage: "Could not load Drafts for this Stack.",
  });

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

          <DraftListSection
            drafts={[...drafts]}
            statesById={statesById}
            showStackContext={false}
            stackId={stackId}
            onDraftCreated={handleDraftCreated}
            emptyLead="Capture the first Draft for this Stack."
          />
        </div>
      )}
    </section>
  );
}
