import { splitApiFieldError } from "../../lib/forms/api-error-fields.ts";

const stackFormFields = ["title", "description", "stateId"] as const;

export const splitApiError = (error: unknown) =>
  splitApiFieldError(error, stackFormFields);
