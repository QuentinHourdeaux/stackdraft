import { splitApiFieldError } from "../../lib/forms/api-error-fields.ts";

const stateFormFields = ["name", "color"] as const;

export const splitApiError = (error: unknown) =>
  splitApiFieldError(error, stateFormFields);

export const formatScopeLabel = (scope: "stack" | "draft"): string =>
  scope === "stack" ? "Stack" : "Draft";
