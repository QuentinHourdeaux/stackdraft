import { isApiError } from "../../api/api-error.ts";

export interface FieldErrors {
  readonly name?: string;
  readonly color?: string;
}

export const splitApiError = (
  error: unknown,
): { fieldErrors: FieldErrors; formError: string | null } => {
  if (!isApiError(error)) {
    return {
      fieldErrors: {},
      formError: error instanceof Error
        ? error.message
        : "Something went wrong.",
    };
  }

  const fieldErrors: FieldErrors = {
    name: error.fieldErrors.name,
    color: error.fieldErrors.color,
  };

  const otherFieldMessages = Object.entries(error.fieldErrors)
    .filter(([field]) => field !== "name" && field !== "color")
    .map(([, message]) => message);

  if (otherFieldMessages.length > 0) {
    return { fieldErrors, formError: otherFieldMessages[0] ?? null };
  }

  if (!fieldErrors.name && !fieldErrors.color) {
    return { fieldErrors, formError: error.message };
  }

  return { fieldErrors, formError: null };
};

export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

export const formatScopeLabel = (scope: "stack" | "draft"): string =>
  scope === "stack" ? "Stack" : "Draft";
