import { type FormEvent, useEffect, useRef, useState } from "react";
import { type State, updateState } from "../../api/states.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { splitApiError } from "./form-errors.ts";

interface StateEditFormProps {
  readonly state: State;
  readonly onClose: () => void;
  readonly onUpdated: (state: State) => void;
}

export function StateEditForm({
  state,
  onClose,
  onUpdated,
}: StateEditFormProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const suppressCloseEventRef = useRef(false);
  const [name, setName] = useState(state.name);
  const [color, setColor] = useState(state.color);
  const [nameError, setNameError] = useState<string | undefined>();
  const [colorError, setColorError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formId = `edit-state-${state.id}`;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      suppressCloseEventRef.current = true;

      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  const handleDialogClose = () => {
    if (suppressCloseEventRef.current) {
      suppressCloseEventRef.current = false;
      return;
    }

    handleClose();
  };

  useEffect(() => {
    setName(state.name);
    setColor(state.color);
    setNameError(undefined);
    setColorError(undefined);
    setFormError(null);
  }, [state.id, state.name, state.color]);

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setNameError(undefined);
    setColorError(undefined);
    setFormError(null);

    try {
      const updatedState = await updateState(state.id, { name, color });
      onUpdated(updatedState);
      onClose();
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      const { fieldErrors, formError: nextFormError } = splitApiError(error);
      setNameError(fieldErrors.name);
      setColorError(fieldErrors.color);
      setFormError(nextFormError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="state-dialog"
      aria-labelledby={`${formId}-heading`}
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
      onClose={handleDialogClose}
    >
      <form className="state-form" id={formId} onSubmit={handleSubmit}>
        <h3 className="state-form__heading" id={`${formId}-heading`}>
          Edit {state.name}
        </h3>

        {formError && (
          <p className="state-form__error" role="alert">
            {formError}
          </p>
        )}

        <div className="state-form__field">
          <label className="state-form__label" htmlFor={`${formId}-name`}>
            Name
          </label>
          <input
            className="state-form__input"
            id={`${formId}-name`}
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${formId}-name-error` : undefined}
            required
          />
          {nameError && (
            <p
              className="state-form__field-error"
              id={`${formId}-name-error`}
              role="alert"
            >
              {nameError}
            </p>
          )}
        </div>

        <div className="state-form__field">
          <label className="state-form__label" htmlFor={`${formId}-color`}>
            Color
          </label>
          <div className="state-form__color-row">
            <input
              className="state-form__color-picker"
              id={`${formId}-color-picker`}
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              aria-label={`${state.name} color picker`}
            />
            <input
              className="state-form__input state-form__input--mono"
              id={`${formId}-color`}
              name="color"
              type="text"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              aria-invalid={colorError ? true : undefined}
              aria-describedby={colorError
                ? `${formId}-color-error`
                : undefined}
              required
              spellCheck={false}
            />
          </div>
          {colorError && (
            <p
              className="state-form__field-error"
              id={`${formId}-color-error`}
              role="alert"
            >
              {colorError}
            </p>
          )}
        </div>

        <div className="state-form__actions">
          <button
            className="state-form__secondary"
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="state-form__submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
