import { splitApiFieldError } from "../../lib/forms/api-error-fields.ts";

const draftFormFields = ["title"] as const;

export const splitApiError = (error: unknown) =>
  splitApiFieldError(error, draftFormFields);
