import type { Draft } from "../../api/drafts.ts";
import type { Stack } from "../../api/stacks.ts";
import type { State } from "../../api/states.ts";
import { DraftList } from "./draft-list.tsx";
import { DraftQuickCreateForm } from "./draft-quick-create-form.tsx";

interface DraftListSectionProps {
  readonly drafts: Draft[];
  readonly statesById: ReadonlyMap<string, State>;
  readonly stacksById?: ReadonlyMap<string, Stack>;
  readonly showStackContext: boolean;
  readonly stackId?: string;
  readonly onDraftCreated: (draft: Draft) => void;
  readonly formHeading?: string;
  readonly emptyLead?: string;
}

export function DraftListSection({
  drafts,
  statesById,
  stacksById,
  showStackContext,
  stackId,
  onDraftCreated,
  formHeading,
  emptyLead,
}: DraftListSectionProps) {
  return (
    <div className="draft-section">
      {drafts.length === 0 && emptyLead && (
        <p className="page__lead">{emptyLead}</p>
      )}

      {drafts.length > 0 && (
        <DraftList
          drafts={drafts}
          statesById={statesById}
          stacksById={stacksById}
          showStackContext={showStackContext}
        />
      )}

      <DraftQuickCreateForm
        stackId={stackId}
        onCreated={onDraftCreated}
        heading={formHeading}
      />
    </div>
  );
}
