import type { Context, Middleware } from "@oak/oak";
import type { Logger } from "./logger.ts";

export interface LoggingState {
  // Oak clones application state for each request. Replacing this logger only
  // refines the current request and never mutates global logger state.
  logger: Logger;
}

export interface RequestLoggerOptions {
  readonly logger: Logger;
  readonly generateRequestId?: () => string;
  readonly nowMilliseconds?: () => number;
}

interface MatchedRouteContext {
  readonly matched?: readonly { readonly path: string }[];
}

const requestDuration = (startedAt: number, finishedAt: number): number =>
  Math.round(Math.max(0, finishedAt - startedAt) * 1_000) / 1_000;

export const requestRoute = (
  context: Context<LoggingState> & MatchedRouteContext,
): string => {
  // Prefer the router pattern so resource IDs and other concrete path values do
  // not leak when Oak has already matched a known route.
  const routePattern = context.matched?.at(-1)?.path;
  return `${context.request.method} ${
    routePattern ?? context.request.url.pathname
  }`;
};

export const createRequestLogger = ({
  logger,
  generateRequestId = () => crypto.randomUUID(),
  nowMilliseconds = () => performance.now(),
}: RequestLoggerOptions): Middleware<LoggingState> =>
async (context, next) => {
  const startedAt = nowMilliseconds();
  const requestId = generateRequestId();
  const requestLogger = logger.with({
    service: "http",
    method: "request",
    route: requestRoute(context),
    requestId,
  });
  // Route modules read and further scope this same request logger, preserving
  // the request ID across lifecycle and operation-specific events.
  context.state.logger = requestLogger;

  try {
    await next();
  } catch (cause) {
    requestLogger.with({ route: requestRoute(context) }).error({
      event: "request_failed",
      message: "HTTP request failed unexpectedly.",
      httpStatus: 500,
      durationMs: requestDuration(startedAt, nowMilliseconds()),
      outcome: "failure",
      cause,
    });
    // The outer application middleware owns the public 500 response. Rethrowing
    // keeps logging and HTTP error mapping separate and avoids a second log.
    throw cause;
  }

  const status = context.response.status;
  const input = {
    event: "request_completed" as const,
    message: "Completed HTTP request.",
    httpStatus: status,
    durationMs: requestDuration(startedAt, nowMilliseconds()),
    outcome: status >= 400 ? "failure" as const : "success" as const,
  };
  const completedLogger = requestLogger.with({ route: requestRoute(context) });

  // Stream and level follow the final HTTP outcome, including handled errors
  // that did not throw through the middleware chain.
  if (status >= 500) {
    completedLogger.error(input);
  } else if (status >= 400) {
    completedLogger.warn(input);
  } else {
    completedLogger.info(input);
  }
};
