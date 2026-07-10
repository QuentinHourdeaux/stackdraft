import type { apiError } from "./api-error.ts";

export interface ResponseContext {
  readonly response: {
    status: number;
    type?: string;
    body?: unknown;
  };
}

export interface MappedApiError {
  readonly status: number;
  readonly body: ReturnType<typeof apiError>;
}

// Error mappers receive the request context so infrastructure-specific handlers
// can use request-local dependencies such as the scoped logger before mapping.
export type ApiErrorMapper<Context extends ResponseContext> = (
  cause: unknown,
  context: Context,
) => MappedApiError | null;

export const setJsonResponse = (
  context: ResponseContext,
  status: number,
  body: unknown,
): void => {
  context.response.status = status;
  context.response.type = "json";
  context.response.body = body;
};

export const setNoContentResponse = (
  context: ResponseContext,
): void => {
  context.response.status = 204;
};

export const setMappedApiErrorResponse = (
  context: ResponseContext,
  response: MappedApiError,
): void => {
  setJsonResponse(context, response.status, response.body);
};

export const routeHandler = <Context extends ResponseContext>(
  mapError: ApiErrorMapper<Context>,
  handler: (context: Context) => Promise<void> | void,
): (context: Context) => Promise<void> =>
async (context) => {
  try {
    await handler(context);
  } catch (cause) {
    const response = mapError(cause, context);

    if (response === null) {
      throw cause;
    }

    setMappedApiErrorResponse(context, response);
  }
};
