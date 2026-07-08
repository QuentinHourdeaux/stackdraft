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

const handleStateRouteError = (cause: unknown): MappedApiError | null => {
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
    console.error("State persistence failed", cause.cause);
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

export const registerStatesRoutes = (
  router: Router,
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
    routeHandler<RouterContext<string>>(
      handleStateRouteError,
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
    routeHandler<RouterContext<string>>(
      handleStateRouteError,
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
    routeHandler<RouterContext<string>>(
      handleStateRouteError,
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
    routeHandler<RouterContext<string>>(
      handleStateRouteError,
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
    routeHandler<RouterContext<string>>(
      handleStateRouteError,
      async (context) => {
        await assertEmptyRequestBody(context.request);
        const state = await selectDefaultState(context.params.stateId ?? "");

        setJsonResponse(context, 200, encodeStateResponse(state));
      },
    ),
  );

  router.delete(
    "/api/states/:stateId",
    routeHandler<RouterContext<string>>(
      handleStateRouteError,
      async (context) => {
        await assertEmptyRequestBody(context.request);
        await deleteState(context.params.stateId ?? "");

        setNoContentResponse(context);
      },
    ),
  );
};
