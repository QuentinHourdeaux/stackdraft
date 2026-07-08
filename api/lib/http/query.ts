import { ValidationError } from "../../core/errors.ts";

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
