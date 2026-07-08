import { isApiError } from "../api/api-error.ts";

export type FieldErrorMap<Field extends string> = Partial<
  Record<Field, string>
>;

export interface SplitApiFieldErrorResult<Field extends string> {
  readonly fieldErrors: FieldErrorMap<Field>;
  readonly formError: string | null;
}

export const splitApiFieldError = <const Field extends string>(
  error: unknown,
  fields: readonly Field[],
): SplitApiFieldErrorResult<Field> => {
  if (!isApiError(error)) {
    return {
      fieldErrors: {},
      formError: error instanceof Error
        ? error.message
        : "Something went wrong.",
    };
  }

  const ownedFields = new Set<string>(fields);
  const fieldErrors: FieldErrorMap<Field> = {};
  const otherFieldMessages: string[] = [];

  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if (ownedFields.has(field)) {
      fieldErrors[field as Field] = message;
    } else {
      otherFieldMessages.push(message);
    }
  }

  if (otherFieldMessages.length > 0) {
    return { fieldErrors, formError: otherFieldMessages[0] ?? null };
  }

  if (Object.keys(fieldErrors).length === 0) {
    return { fieldErrors, formError: error.message };
  }

  return { fieldErrors, formError: null };
};
