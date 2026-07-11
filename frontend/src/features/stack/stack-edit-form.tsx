import { type FormEvent, useEffect, useState } from "react";
import { type Stack, updateStack } from "../../api/stacks.ts";
import type { State } from "../../api/states.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { splitApiError } from "./form-errors.ts";

const descriptionMaxLength = 20_000;

interface StackEditFormProps {
  readonly stack: Stack;
  readonly states: State[];
  readonly onUpdated: (stack: Stack) => void;
}

export function StackEditForm({
  stack,
  states,
  onUpdated,
}: StackEditFormProps) {
  const [title, setTitle] = useState(stack.title);
  const [description, setDescription] = useState(stack.description);
  const [selectedStateId, setSelectedStateId] = useState(stack.stateId);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [descriptionError, setDescriptionError] = useState<
    string | undefined
  >();
  const [stateIdError, setStateIdError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTitle(stack.title);
    setDescription(stack.description);
    setSelectedStateId(stack.stateId);
    setTitleError(undefined);
    setDescriptionError(undefined);
    setStateIdError(undefined);
    setFormError(null);
  }, [
    stack.id,
    stack.title,
    stack.description,
    stack.stateId,
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
    setFormError(null);

    try {
      const updatedStack = await updateStack(stack.id, {
        title,
        description,
        ...(selectedStateId !== stack.stateId
          ? { stateId: selectedStateId }
          : {}),
      });

      onUpdated(updatedStack);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      const { fieldErrors, formError: nextFormError } = splitApiError(error);
      setTitleError(fieldErrors.title);
      setDescriptionError(fieldErrors.description);
      setStateIdError(fieldErrors.stateId);
      setFormError(nextFormError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="stack-form"
      aria-labelledby="edit-stack-heading"
      onSubmit={handleSubmit}
    >
      <h2 className="stack-form__heading" id="edit-stack-heading">
        Edit Stack
      </h2>

      {formError && (
        <p className="stack-form__error" role="alert">
          {formError}
        </p>
      )}

      <div className="stack-form__field">
        <label className="stack-form__label" htmlFor="edit-stack-title">
          Title
        </label>
        <input
          className="stack-form__input"
          id="edit-stack-title"
          name="title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? "edit-stack-title-error" : undefined}
          required
        />
        {titleError && (
          <p
            className="stack-form__field-error"
            id="edit-stack-title-error"
            role="alert"
          >
            {titleError}
          </p>
        )}
      </div>

      <div className="stack-form__field">
        <label
          className="stack-form__label"
          htmlFor="edit-stack-description"
        >
          Description
        </label>
        <textarea
          className="stack-form__textarea"
          id="edit-stack-description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={descriptionError ? true : undefined}
          aria-describedby="edit-stack-description-hint"
          rows={6}
        />
        <p className="stack-form__hint" id="edit-stack-description-hint">
          Up to {descriptionMaxLength.toLocaleString()} characters.
        </p>
        {descriptionError && (
          <p
            className="stack-form__field-error"
            id="edit-stack-description-error"
            role="alert"
          >
            {descriptionError}
          </p>
        )}
      </div>

      {states.length > 0 && (
        <div className="stack-form__field">
          <label className="stack-form__label" htmlFor="edit-stack-state">
            State
          </label>
          <select
            className="stack-form__select"
            id="edit-stack-state"
            name="stateId"
            value={selectedStateId}
            onChange={(event) => setSelectedStateId(event.target.value)}
            aria-invalid={stateIdError ? true : undefined}
            aria-describedby={stateIdError
              ? "edit-stack-state-error"
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
              className="stack-form__field-error"
              id="edit-stack-state-error"
              role="alert"
            >
              {stateIdError}
            </p>
          )}
        </div>
      )}

      <button
        className="stack-form__submit"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
