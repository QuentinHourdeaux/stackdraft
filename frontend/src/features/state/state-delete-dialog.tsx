import { useEffect, useRef, useState } from "react";
import { deleteState, type State } from "../../api/states.ts";
import { isAbortError } from "../../lib/async/abort-error.ts";
import { splitApiError } from "./form-errors.ts";

interface StateDeleteDialogProps {
  readonly state: State;
  readonly onClose: () => void;
  readonly onDeleted: () => void;
  readonly onDeleteBlocked: (message: string) => void;
}

export function StateDeleteDialog({
  state,
  onClose,
  onDeleted,
  onDeleteBlocked,
}: StateDeleteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const suppressCloseEventRef = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogId = `delete-state-${state.id}`;

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

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    onClose();
  };

  const handleConfirm = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await deleteState(state.id);
      onDeleted();
      onClose();
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      const { formError: nextFormError } = splitApiError(error);

      if (nextFormError) {
        onDeleteBlocked(nextFormError);
        onClose();
        return;
      }

      setFormError("Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="state-dialog state-dialog--destructive"
      aria-labelledby={`${dialogId}-heading`}
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
      onClose={handleDialogClose}
    >
      <div className="state-dialog__content">
        <h3 className="state-form__heading" id={`${dialogId}-heading`}>
          Delete {state.name}
        </h3>

        <p className="state-dialog__message">
          This will permanently delete the <strong>{state.name}</strong>{" "}
          State. This action cannot be undone.
        </p>

        {formError && (
          <p className="state-form__error" role="alert">
            {formError}
          </p>
        )}

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
            className="state-form__submit state-form__submit--destructive"
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Deleting…" : "Delete state"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
