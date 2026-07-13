import { type FormEvent, useEffect, useRef, useState } from "react";
import { createDraft, type Draft } from "../../api/drafts.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { splitApiError } from "./form-errors.ts";

interface DraftQuickCreateFormProps {
  readonly stackId?: string;
  readonly onCreated: (draft: Draft) => void;
  readonly heading?: string;
  readonly submitLabel?: string;
}

export function DraftQuickCreateForm({
  stackId,
  onCreated,
  heading = "Capture Draft",
  submitLabel = "Add Draft",
}: DraftQuickCreateFormProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const focusInputOnReadyRef = useRef(false);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isSubmitting || !focusInputOnReadyRef.current) {
      return;
    }

    focusInputOnReadyRef.current = false;
    titleInputRef.current?.focus();
  }, [isSubmitting]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      return;
    }

    const submittedTitle = trimmedTitle;

    setIsSubmitting(true);
    setTitleError(undefined);
    setFormError(null);

    try {
      const createdDraft = await createDraft({
        title: submittedTitle,
        ...(stackId === undefined ? {} : { stackId }),
      });

      setTitle((currentTitle) =>
        currentTitle.trim() !== submittedTitle ? currentTitle : ""
      );

      onCreated(createdDraft);
      focusInputOnReadyRef.current = true;
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      const { fieldErrors, formError: nextFormError } = splitApiError(error);
      setTitleError(fieldErrors.title);
      setFormError(nextFormError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="draft-form"
      aria-labelledby="create-draft-heading"
      onSubmit={handleSubmit}
    >
      <h2 className="draft-form__heading" id="create-draft-heading">
        {heading}
      </h2>

      {formError && (
        <p className="draft-form__error" role="alert">
          {formError}
        </p>
      )}

      <div className="draft-form__field">
        <label className="draft-form__label" htmlFor="create-draft-title">
          Title
        </label>
        <input
          className="draft-form__input"
          id="create-draft-title"
          name="title"
          type="text"
          value={title}
          ref={titleInputRef}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? "create-draft-title-error" : undefined}
        />
        {titleError && (
          <p
            className="draft-form__field-error"
            id="create-draft-title-error"
            role="alert"
          >
            {titleError}
          </p>
        )}
      </div>

      <button
        className="draft-form__submit"
        type="submit"
        disabled={isSubmitting}
        onMouseDown={(event) => event.preventDefault()}
      >
        {isSubmitting ? "Adding…" : submitLabel}
      </button>
    </form>
  );
}
