import { type FormEvent, useState } from "react";
import { createState, type State, type StateScope } from "../../api/states.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { splitApiError } from "./form-errors.ts";

interface StateCreateFormProps {
  readonly scope: StateScope;
  readonly onCreated: (state: State) => void;
}

export function StateCreateForm({ scope, onCreated }: StateCreateFormProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8fa8ff");
  const [nameError, setNameError] = useState<string | undefined>();
  const [colorError, setColorError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const createdState = await createState({ scope, name, color });
      onCreated(createdState);
      setName("");
      setColor("#8fa8ff");
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

  const scopeLabel = scope === "stack" ? "Stack" : "Draft";
  const formId = `create-state-${scope}`;

  return (
    <form
      className="state-form"
      id={formId}
      aria-labelledby={`${formId}-heading`}
      onSubmit={handleSubmit}
    >
      <h3 className="state-form__heading" id={`${formId}-heading`}>
        Add {scopeLabel} state
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
            aria-label={`${scopeLabel} state color picker`}
          />
          <input
            className="state-form__input state-form__input--mono"
            id={`${formId}-color`}
            name="color"
            type="text"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            aria-invalid={colorError ? true : undefined}
            aria-describedby={colorError ? `${formId}-color-error` : undefined}
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

      <button
        className="state-form__submit"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Adding…" : "Add state"}
      </button>
    </form>
  );
}
