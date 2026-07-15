import { type FormEvent, useEffect, useState } from "react";
import { type Draft, updateDraft } from "../../api/drafts.ts";
import type { Stack } from "../../api/stacks.ts";
import type { State } from "../../api/states.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { splitApiError } from "./form-errors.ts";

const descriptionMaxLength = 20_000;
const noStackValue = "";

interface DraftEditFormProps {
  readonly draft: Draft;
  readonly states: State[];
  readonly stacks: Stack[];
  readonly onUpdated: (draft: Draft) => void;
}

export function DraftEditForm({
  draft,
  states,
  stacks,
  onUpdated,
}: DraftEditFormProps) {
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  const [selectedStateId, setSelectedStateId] = useState(draft.stateId);
  const [selectedStackId, setSelectedStackId] = useState(
    draft.stackId ?? noStackValue,
  );
  const [titleError, setTitleError] = useState<string | undefined>();
  const [descriptionError, setDescriptionError] = useState<
    string | undefined
  >();
  const [stateIdError, setStateIdError] = useState<string | undefined>();
  const [stackIdError, setStackIdError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTitle(draft.title);
    setDescription(draft.description);
    setSelectedStateId(draft.stateId);
    setSelectedStackId(draft.stackId ?? noStackValue);
    setTitleError(undefined);
    setDescriptionError(undefined);
    setStateIdError(undefined);
    setStackIdError(undefined);
    setFormError(null);
  }, [
    draft.id,
    draft.title,
    draft.description,
    draft.stateId,
    draft.stackId,
  ]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setTitleError(undefined);
    setDescriptionError(undefined);
    setStateIdError(undefined);
    setStackIdError(undefined);
    setFormError(null);

    try {
      const updatedDraft = await updateDraft(draft.id, {
        title,
        description,
        ...(selectedStateId !== draft.stateId
          ? { stateId: selectedStateId }
          : {}),
        ...(selectedStackId === noStackValue
          ? draft.stackId !== null ? { stackId: null } : {}
          : selectedStackId !== draft.stackId
          ? { stackId: selectedStackId }
          : {}),
      });
      onUpdated(updatedDraft);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      const { fieldErrors, formError: nextFormError } = splitApiError(error);
      setTitleError(fieldErrors.title);
      setDescriptionError(fieldErrors.description);
      setStateIdError(fieldErrors.stateId);
      setStackIdError(fieldErrors.stackId);
      setFormError(nextFormError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="draft-form"
      aria-labelledby="edit-draft-heading"
      onSubmit={handleSubmit}
    >
      <h2 className="draft-form__heading" id="edit-draft-heading">
        Edit Draft
      </h2>

      {formError && (
        <p className="draft-form__error" role="alert">
          {formError}
        </p>
      )}

      <div className="draft-form__field">
        <label className="draft-form__label" htmlFor="edit-draft-title">
          Title
        </label>
        <input
          className="draft-form__input"
          id="edit-draft-title"
          name="title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? "edit-draft-title-error" : undefined}
          required
        />
        {titleError && (
          <p
            className="draft-form__field-error"
            id="edit-draft-title-error"
            role="alert"
          >
            {titleError}
          </p>
        )}
      </div>

      <div className="draft-form__field">
        <label
          className="draft-form__label"
          htmlFor="edit-draft-description"
        >
          Description
        </label>
        <textarea
          className="draft-form__textarea"
          id="edit-draft-description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={descriptionError ? true : undefined}
          aria-describedby="edit-draft-description-hint"
          rows={6}
        />
        <p className="draft-form__hint" id="edit-draft-description-hint">
          Up to {descriptionMaxLength.toLocaleString()} characters.
        </p>
        {descriptionError && (
          <p
            className="draft-form__field-error"
            id="edit-draft-description-error"
            role="alert"
          >
            {descriptionError}
          </p>
        )}
      </div>

      {states.length > 0 && (
        <div className="draft-form__field">
          <label className="draft-form__label" htmlFor="edit-draft-state">
            State
          </label>
          <select
            className="draft-form__select"
            id="edit-draft-state"
            name="stateId"
            value={selectedStateId}
            onChange={(event) => setSelectedStateId(event.target.value)}
            aria-invalid={stateIdError ? true : undefined}
            aria-describedby={stateIdError
              ? "edit-draft-state-error"
              : undefined}
          >
            {states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.name}
                {state.isDefault ? " (default)" : ""}
              </option>
            ))}
          </select>
          {stateIdError && (
            <p
              className="draft-form__field-error"
              id="edit-draft-state-error"
              role="alert"
            >
              {stateIdError}
            </p>
          )}
        </div>
      )}

      {stacks.length > 0 && (
        <div className="draft-form__field">
          <label className="draft-form__label" htmlFor="edit-draft-stack">
            Stack
          </label>
          <select
            className="draft-form__select"
            id="edit-draft-stack"
            name="stackId"
            value={selectedStackId}
            onChange={(event) => setSelectedStackId(event.target.value)}
            aria-invalid={stackIdError ? true : undefined}
            aria-describedby={stackIdError
              ? "edit-draft-stack-error"
              : undefined}
          >
            <option value={noStackValue}>No Stack</option>
            {stacks.map((stack) => (
              <option key={stack.id} value={stack.id}>
                {stack.title}
              </option>
            ))}
          </select>
          {stackIdError && (
            <p
              className="draft-form__field-error"
              id="edit-draft-stack-error"
              role="alert"
            >
              {stackIdError}
            </p>
          )}
        </div>
      )}

      <button
        className="draft-form__submit"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
