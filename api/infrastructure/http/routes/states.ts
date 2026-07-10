import type { Router, RouterContext } from "@oak/oak";
import type { State } from "../../../defs/state/state.ts";
import type {
  CreateStateBody,
  MoveStateBody,
  UpdateStateBody,
} from "../../../defs/state/state-schema.ts";
import {
  CreateStateBodySchema,
  encodeStateResponse,
  encodeStatesResponse,
  MoveStateBodySchema,
  UpdateStateBodySchema,
} from "../../../defs/state/state-schema.ts";
import {
  LastStateInScopeError,
  StateInUseError,
  StateIsDefaultError,
  StateNameConflictError,
  StateNotFoundError,
  UnknownStateStoreError,
  ValidationError,
} from "../../../core/errors.ts";
import { apiError } from "../../../lib/http/api-error.ts";
import { readRequiredSingleQueryParameter } from "../../../lib/http/query.ts";
import {
  type MappedApiError,
  routeHandler,
  setJsonResponse,
  setNoContentResponse,
} from "../../../lib/http/response.ts";
import {
  type LoggingState,
  requestRoute,
} from "../../../lib/logging/request-logger.ts";
import {
  assertEmptyRequestBody,
  decodeRequestBody,
  readJsonRequestBody,
} from "../../../lib/http/request.ts";

export interface StatesRouteDependencies {
  readonly listStates: (scope: string) => Promise<readonly State[]>;
  readonly createState: (input: CreateStateBody) => Promise<State>;
  readonly updateState: (
    stateId: string,
    input: UpdateStateBody,
  ) => Promise<State>;
  readonly moveState: (
    stateId: string,
    input: MoveStateBody,
  ) => Promise<readonly State[]>;
  readonly selectDefaultState: (stateId: string) => Promise<State>;
  readonly deleteState: (stateId: string) => Promise<void>;
}

type StateRouterContext = RouterContext<
  string,
  { readonly stateId?: string },
  LoggingState
>;

const handleStateRouteError = (
  cause: unknown,
  context: StateRouterContext,
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

  if (cause instanceof StateNotFoundError) {
    return {
      status: 404,
      body: apiError(
        "STATE_NOT_FOUND",
        "The requested State does not exist.",
      ),
    };
  }

  if (cause instanceof StateNameConflictError) {
    return {
      status: 409,
      body: apiError(
        "STATE_NAME_CONFLICT",
        "A State with this name already exists in this scope.",
        {
          fields: {
            name: "A State with this name already exists in this scope.",
          },
        },
      ),
    };
  }

  if (cause instanceof StateIsDefaultError) {
    return {
      status: 409,
      body: apiError(
        "STATE_IS_DEFAULT",
        "This State is the current default for its scope.",
      ),
    };
  }

  if (cause instanceof LastStateInScopeError) {
    return {
      status: 409,
      body: apiError(
        "LAST_STATE_IN_SCOPE",
        "At least one State must remain in each scope.",
      ),
    };
  }

  if (cause instanceof StateInUseError) {
    return {
      status: 409,
      body: apiError(
        "STATE_IN_USE",
        "This State is assigned to existing Stacks or Drafts.",
      ),
    };
  }

  if (cause instanceof UnknownStateStoreError) {
    context.state.logger.error({
      event: "state_persistence_failed",
      message: "State persistence failed.",
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
 * Wraps a State route with operation-specific logging context before the shared
 * response helper maps failures. This keeps individual handlers focused on
 * decoding, invoking the service, and encoding the response.
 */
const stateRouteHandler = (
  method: string,
  handler: (context: StateRouterContext) => Promise<void> | void,
): (context: StateRouterContext) => Promise<void> =>
  routeHandler<StateRouterContext>(
    handleStateRouteError,
    async (context) => {
      // Scope before any decoding or service call so mapped persistence errors
      // inherit the request ID, matched route, operation, and State identity.
      // Oak state is request-local; assigning the immutable child logger here
      // cannot leak context into another request.
      const stateId = context.params.stateId;
      context.state.logger = context.state.logger.with({
        service: "state",
        method,
        route: requestRoute(context),
        ...(stateId === undefined
          ? {}
          : { resources: [{ type: "state", id: stateId }] }),
      });
      await handler(context);
    },
  );

export const registerStatesRoutes = (
  router: Router<LoggingState>,
  {
    listStates,
    createState,
    updateState,
    moveState,
    selectDefaultState,
    deleteState,
  }: StatesRouteDependencies,
): void => {
  router.get(
    "/api/states",
    stateRouteHandler(
      "listStates",
      async (context) => {
        const scope = readRequiredSingleQueryParameter(
          context.request.url,
          "scope",
        );
        const states = await listStates(scope);

        setJsonResponse(
          context,
          200,
          encodeStatesResponse({
            states: [...states],
          }),
        );
      },
    ),
  );

  router.post(
    "/api/states",
    stateRouteHandler(
      "createState",
      async (context) => {
        const body = await readJsonRequestBody(context.request);
        const input = decodeRequestBody(CreateStateBodySchema, body);
        const state = await createState(input);

        setJsonResponse(context, 201, encodeStateResponse(state));
      },
    ),
  );

  router.patch(
    "/api/states/:stateId",
    stateRouteHandler(
      "updateState",
      async (context) => {
        const body = await readJsonRequestBody(context.request);
        const input = decodeRequestBody(UpdateStateBodySchema, body);
        const state = await updateState(context.params.stateId ?? "", input);

        setJsonResponse(context, 200, encodeStateResponse(state));
      },
    ),
  );

  router.put(
    "/api/states/:stateId/position",
    stateRouteHandler(
      "moveState",
      async (context) => {
        const body = await readJsonRequestBody(context.request);
        const input = decodeRequestBody(MoveStateBodySchema, body);
        const states = await moveState(context.params.stateId ?? "", input);

        setJsonResponse(
          context,
          200,
          encodeStatesResponse({
            states: [...states],
          }),
        );
      },
    ),
  );

  router.put(
    "/api/states/:stateId/default",
    stateRouteHandler(
      "selectDefaultState",
      async (context) => {
        await assertEmptyRequestBody(context.request);
        const state = await selectDefaultState(context.params.stateId ?? "");

        setJsonResponse(context, 200, encodeStateResponse(state));
      },
    ),
  );

  router.delete(
    "/api/states/:stateId",
    stateRouteHandler(
      "deleteState",
      async (context) => {
        await assertEmptyRequestBody(context.request);
        await deleteState(context.params.stateId ?? "");

        setNoContentResponse(context);
      },
    ),
  );
};
