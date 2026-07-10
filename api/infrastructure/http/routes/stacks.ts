import type { Router, RouterContext } from "@oak/oak";
import type { Stack } from "../../../defs/stack/stack.ts";
import type {
  CreateStackBody,
  UpdateStackBody,
} from "../../../defs/stack/stack-schema.ts";
import {
  CreateStackBodySchema,
  encodeStackResponse,
  encodeStacksResponse,
  UpdateStackBodySchema,
} from "../../../defs/stack/stack-schema.ts";
import {
  InvalidStateScopeError,
  StackNotFoundError,
  StateNotFoundError,
  UnknownStackStoreError,
  ValidationError,
} from "../../../core/errors.ts";
import { apiError } from "../../../lib/http/api-error.ts";
import {
  type MappedApiError,
  routeHandler,
  setJsonResponse,
} from "../../../lib/http/response.ts";
import {
  type LoggingState,
  requestRoute,
} from "../../../lib/logging/request-logger.ts";
import {
  decodeRequestBody,
  readJsonRequestBody,
} from "../../../lib/http/request.ts";
import {
  assertAllowedQueryParameters,
  readOptionalSingleQueryParameter,
} from "../../../lib/http/query.ts";
import type { ListStacksFilter } from "../../../core/stack/input.ts";

export interface StacksRouteDependencies {
  readonly listStacks: (filter?: ListStacksFilter) => Promise<readonly Stack[]>;
  readonly getStack: (stackId: string) => Promise<Stack>;
  readonly createStack: (input: CreateStackBody) => Promise<Stack>;
  readonly updateStack: (
    stackId: string,
    input: UpdateStackBody,
  ) => Promise<Stack>;
}

type StackRouterContext = RouterContext<
  string,
  { readonly stackId?: string },
  LoggingState
>;

const handleStackRouteError = (
  cause: unknown,
  context: StackRouterContext,
): MappedApiError | null => {
  if (cause instanceof ValidationError) {
    return {
      status: 400,
      body: apiError(
        "VALIDATION_ERROR",
        "The request is invalid.",
        { fields: cause.fields },
      ),
    };
  }

  if (cause instanceof InvalidStateScopeError) {
    return {
      status: 400,
      body: apiError(
        "INVALID_STATE_SCOPE",
        "This State belongs to the wrong scope for a Stack.",
      ),
    };
  }

  if (cause instanceof StateNotFoundError) {
    return {
      status: 404,
      body: apiError(
        "STATE_NOT_FOUND",
        "The requested State does not exist.",
      ),
    };
  }

  if (cause instanceof StackNotFoundError) {
    return {
      status: 404,
      body: apiError(
        "STACK_NOT_FOUND",
        "The requested Stack does not exist.",
      ),
    };
  }

  if (cause instanceof UnknownStackStoreError) {
    context.state.logger.error({
      event: "stack_persistence_failed",
      message: "Stack persistence failed.",
      outcome: "failure",
      cause,
    });
    return {
      status: 500,
      body: apiError(
        "UNKNOWN_ERROR",
        "An unexpected error occurred.",
      ),
    };
  }

  return null;
};

/**
 * Wraps a Stack route with operation-specific logging context before the shared
 * response helper maps failures.
 */
const stackRouteHandler = (
  method: string,
  handler: (context: StackRouterContext) => Promise<void> | void,
): (context: StackRouterContext) => Promise<void> =>
  routeHandler<StackRouterContext>(
    handleStackRouteError,
    async (context) => {
      const stackId = context.params.stackId;
      context.state.logger = context.state.logger.with({
        service: "stack",
        method,
        route: requestRoute(context),
        ...(stackId === undefined
          ? {}
          : { resources: [{ type: "stack", id: stackId }] }),
      });
      await handler(context);
    },
  );

export const registerStacksRoutes = (
  router: Router<LoggingState>,
  { listStacks, getStack, createStack, updateStack }: StacksRouteDependencies,
): void => {
  router.get(
    "/api/stacks",
    stackRouteHandler(
      "listStacks",
      async (context) => {
        const url = context.request.url;
        assertAllowedQueryParameters(url, ["stateId"]);
        const stateId = readOptionalSingleQueryParameter(url, "stateId");
        const stacks = await listStacks(
          stateId === undefined ? undefined : { stateId },
        );

        setJsonResponse(
          context,
          200,
          encodeStacksResponse({
            stacks: [...stacks],
          }),
        );
      },
    ),
  );

  router.get(
    "/api/stacks/:stackId",
    stackRouteHandler(
      "getStack",
      async (context) => {
        const stack = await getStack(context.params.stackId ?? "");

        setJsonResponse(context, 200, encodeStackResponse(stack));
      },
    ),
  );

  router.post(
    "/api/stacks",
    stackRouteHandler(
      "createStack",
      async (context) => {
        const body = await readJsonRequestBody(context.request);
        const input = decodeRequestBody(CreateStackBodySchema, body);
        const stack = await createStack(input);

        setJsonResponse(context, 201, encodeStackResponse(stack));
      },
    ),
  );

  router.patch(
    "/api/stacks/:stackId",
    stackRouteHandler(
      "updateStack",
      async (context) => {
        const body = await readJsonRequestBody(context.request);
        const input = decodeRequestBody(UpdateStackBodySchema, body);
        const stack = await updateStack(context.params.stackId ?? "", input);

        setJsonResponse(context, 200, encodeStackResponse(stack));
      },
    ),
  );
};
