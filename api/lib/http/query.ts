import { ValidationError } from "../../core/errors.ts";

export const assertAllowedQueryParameters = (
  url: URL,
  allowedNames: readonly string[],
): void => {
  const allowed = new Set(allowedNames);

  for (const key of new Set(url.searchParams.keys())) {
    if (!allowed.has(key)) {
      throw new ValidationError({
        fields: {
          [key]: "Unknown query parameter.",
        },
      });
    }
  }
};

export const readRequiredSingleQueryParameter = (
  url: URL,
  name: string,
): string => {
  const values = url.searchParams.getAll(name);

  if (values.length !== 1) {
    throw new ValidationError({
      fields: {
        [name]: `Exactly one ${name} query parameter is required.`,
      },
    });
  }

  return values[0] ?? "";
};

export const readOptionalSingleQueryParameter = (
  url: URL,
  name: string,
): string | undefined => {
  const values = url.searchParams.getAll(name);

  if (values.length === 0) {
    return undefined;
  }

  if (values.length !== 1) {
    throw new ValidationError({
      fields: {
        [name]: `At most one ${name} query parameter is allowed.`,
      },
    });
  }

  return values[0];
};
