import { type FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { createStack, type Stack } from "../../api/stacks.ts";
import type { State } from "../../api/states.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { splitApiError } from "./form-errors.ts";

interface StackCreateFormProps {
  readonly states: State[];
  readonly onCreated?: (stack: Stack) => void;
  readonly heading?: string;
}

export function StackCreateForm({
  states,
  onCreated,
  heading = "Create Stack",
}: StackCreateFormProps) {
  const navigate = useNavigate();
  const defaultState = useMemo(
    () => states.find((state) => state.isDefault) ?? states[0],
    [states],
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedStateId, setSelectedStateId] = useState(
    () => defaultState?.id ?? "",
  );
  const [titleError, setTitleError] = useState<string | undefined>();
  const [descriptionError, setDescriptionError] = useState<
    string | undefined
  >();
  const [stateIdError, setStateIdError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    const trimmedDescription = description.trim();
    const useDefaultState = defaultState !== undefined &&
      selectedStateId === defaultState.id;

    try {
      const createdStack = await createStack({
        title,
        ...(trimmedDescription.length > 0
          ? { description: trimmedDescription }
          : {}),
        ...(useDefaultState ? {} : { stateId: selectedStateId }),
      });

      onCreated?.(createdStack);
      navigate(`/stacks/${createdStack.id}`);
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
      aria-labelledby="create-stack-heading"
      onSubmit={handleSubmit}
    >
      <h2 className="stack-form__heading" id="create-stack-heading">
        {heading}
      </h2>

      {formError && (
        <p className="stack-form__error" role="alert">
          {formError}
        </p>
      )}

      <div className="stack-form__field">
        <label className="stack-form__label" htmlFor="create-stack-title">
          Title
        </label>
        <input
          className="stack-form__input"
          id="create-stack-title"
          name="title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? "create-stack-title-error" : undefined}
          required
        />
        {titleError && (
          <p
            className="stack-form__field-error"
            id="create-stack-title-error"
            role="alert"
          >
            {titleError}
          </p>
        )}
      </div>

      <div className="stack-form__field">
        <label
          className="stack-form__label"
          htmlFor="create-stack-description"
        >
          Description
        </label>
        <textarea
          className="stack-form__textarea"
          id="create-stack-description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={descriptionError ? true : undefined}
          aria-describedby={descriptionError
            ? "create-stack-description-error"
            : undefined}
          rows={4}
        />
        {descriptionError && (
          <p
            className="stack-form__field-error"
            id="create-stack-description-error"
            role="alert"
          >
            {descriptionError}
          </p>
        )}
      </div>

      {states.length > 0 && (
        <div className="stack-form__field">
          <label className="stack-form__label" htmlFor="create-stack-state">
            State
          </label>
          <select
            className="stack-form__select"
            id="create-stack-state"
            name="stateId"
            value={selectedStateId}
            onChange={(event) => setSelectedStateId(event.target.value)}
            aria-invalid={stateIdError ? true : undefined}
            aria-describedby={stateIdError
              ? "create-stack-state-error"
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
              id="create-stack-state-error"
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
        {isSubmitting ? "Creating…" : "Create Stack"}
      </button>
    </form>
  );
}
