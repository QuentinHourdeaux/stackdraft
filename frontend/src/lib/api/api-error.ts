export class ApiError extends Error {
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: string,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.fieldErrors = readFieldErrors(details);
  }
}

const readFieldErrors = (
  details: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string>> => {
  const fields = details.fields;

  if (
    fields === null ||
    typeof fields !== "object" ||
    Array.isArray(fields)
  ) {
    return {};
  }

  const fieldErrors: Record<string, string> = {};

  for (const [field, message] of Object.entries(fields)) {
    if (typeof message === "string") {
      fieldErrors[field] = message;
    }
  }

  return fieldErrors;
};

export const isApiError = (cause: unknown): cause is ApiError =>
  cause instanceof ApiError;

export const getFieldError = (
  error: ApiError,
  field: string,
): string | undefined => error.fieldErrors[field];

export const decodeApiErrorResponse = async (
  response: Response,
): Promise<ApiError> => {
  try {
    const body = await response.json() as {
      error?: {
        code?: string;
        message?: string;
        details?: Readonly<Record<string, unknown>>;
      };
    };

    if (body.error?.code && body.error.message) {
      return new ApiError(
        body.error.code,
        body.error.message,
        body.error.details ?? {},
      );
    }
  } catch {
    // Fall through to generic error below.
  }

  return new ApiError(
    "UNKNOWN_ERROR",
    `Request failed with status ${response.status}`,
  );
};
