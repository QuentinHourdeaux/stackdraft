import type { Router } from "@oak/oak";
import type { State } from "../../../domain/state/state.ts";
import type {
  CreateStateBody,
  MoveStateBody,
  UpdateStateBody,
} from "../../../domain/state/state-schema.ts";
import {
  CreateStateBodySchema,
  encodeStateResponse,
  encodeStatesResponse,
  MoveStateBodySchema,
  UpdateStateBodySchema,
} from "../../../domain/state/state-schema.ts";
import { ValidationError } from "../../../application/validation-error.ts";
import {
  StateNameConflictError,
  StateNotFoundError,
  UnknownStateRepositoryError,
} from "../../../application/state-repository.ts";
import { apiError } from "../errors.ts";
import { decodeRequestBody, readJsonRequestBody } from "../request.ts";

export interface StatesRouteDependencies {
  readonly listStates: (
    scopeValues: readonly string[],
  ) => Promise<readonly State[]>;
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
}

const handleStateRouteError = (
  cause: unknown,
): { status: number; body: ReturnType<typeof apiError> } | null => {
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

  if (cause instanceof UnknownStateRepositoryError) {
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
  }: StatesRouteDependencies,
): void => {
  router.get("/api/states", async (context) => {
    const scopeValues = context.request.url.searchParams.getAll("scope");

    try {
      const states = await listStates(scopeValues);

      context.response.status = 200;
      context.response.type = "json";
      context.response.body = encodeStatesResponse({ states: [...states] });
    } catch (cause) {
      const response = handleStateRouteError(cause);

      if (response === null) {
        throw cause;
      }

      context.response.status = response.status;
      context.response.type = "json";
      context.response.body = response.body;
    }
  });

  router.post("/api/states", async (context) => {
    try {
      const body = await readJsonRequestBody(context.request);
      const input = decodeRequestBody(CreateStateBodySchema, body);
      const state = await createState(input);

      context.response.status = 201;
      context.response.type = "json";
      context.response.body = encodeStateResponse(state);
    } catch (cause) {
      const response = handleStateRouteError(cause);

      if (response === null) {
        throw cause;
      }

      context.response.status = response.status;
      context.response.type = "json";
      context.response.body = response.body;
    }
  });

  router.patch("/api/states/:stateId", async (context) => {
    try {
      const body = await readJsonRequestBody(context.request);
      const input = decodeRequestBody(UpdateStateBodySchema, body);
      const state = await updateState(context.params.stateId ?? "", input);

      context.response.status = 200;
      context.response.type = "json";
      context.response.body = encodeStateResponse(state);
    } catch (cause) {
      const response = handleStateRouteError(cause);

      if (response === null) {
        throw cause;
      }

      context.response.status = response.status;
      context.response.type = "json";
      context.response.body = response.body;
    }
  });

  router.put("/api/states/:stateId/position", async (context) => {
    try {
      const body = await readJsonRequestBody(context.request);
      const input = decodeRequestBody(MoveStateBodySchema, body);
      const states = await moveState(context.params.stateId ?? "", input);

      context.response.status = 200;
      context.response.type = "json";
      context.response.body = encodeStatesResponse({ states: [...states] });
    } catch (cause) {
      const response = handleStateRouteError(cause);

      if (response === null) {
        throw cause;
      }

      context.response.status = response.status;
      context.response.type = "json";
      context.response.body = response.body;
    }
  });

  router.put("/api/states/:stateId/default", async (context) => {
    try {
      const state = await selectDefaultState(context.params.stateId ?? "");

      context.response.status = 200;
      context.response.type = "json";
      context.response.body = encodeStateResponse(state);
    } catch (cause) {
      const response = handleStateRouteError(cause);

      if (response === null) {
        throw cause;
      }

      context.response.status = response.status;
      context.response.type = "json";
      context.response.body = response.body;
    }
  });
};
