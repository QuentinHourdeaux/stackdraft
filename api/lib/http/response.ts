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

export type ApiErrorMapper = (cause: unknown) => MappedApiError | null;

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
  mapError: ApiErrorMapper,
  handler: (context: Context) => Promise<void> | void,
): (context: Context) => Promise<void> =>
async (context) => {
  try {
    await handler(context);
  } catch (cause) {
    const response = mapError(cause);

    if (response === null) {
      throw cause;
    }

    setMappedApiErrorResponse(context, response);
  }
};
