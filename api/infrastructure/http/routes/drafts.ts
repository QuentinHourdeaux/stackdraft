import type { Router, RouterContext } from "@oak/oak";
import type { Draft } from "../../../defs/draft/draft.ts";
import type {
  CreateDraftBody,
  UpdateDraftBody,
} from "../../../defs/draft/draft-schema.ts";
import {
  CreateDraftBodySchema,
  encodeDraftResponse,
  encodeDraftsResponse,
  UpdateDraftBodySchema,
} from "../../../defs/draft/draft-schema.ts";
import type { ListDraftsFilter } from "../../../core/draft/input.ts";
import {
  DraftNotFoundError,
  InvalidStateScopeError,
  StackNotFoundError,
  StateNotFoundError,
  UnknownDraftStoreError,
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

export interface DraftsRouteDependencies {
  readonly listDrafts: (
    filter?: ListDraftsFilter,
  ) => Promise<readonly Draft[]>;
  readonly getDraft: (draftId: string) => Promise<Draft>;
  readonly createDraft: (input: CreateDraftBody) => Promise<Draft>;
  readonly updateDraft: (
    draftId: string,
    input: UpdateDraftBody,
  ) => Promise<Draft>;
}

type DraftRouterContext = RouterContext<
  string,
  { readonly draftId?: string },
  LoggingState
>;

const handleDraftRouteError = (
  cause: unknown,
  context: DraftRouterContext,
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
        "This State belongs to the wrong scope for a Draft.",
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

  if (cause instanceof DraftNotFoundError) {
    return {
      status: 404,
      body: apiError(
        "DRAFT_NOT_FOUND",
        "The requested Draft does not exist.",
      ),
    };
  }

  if (cause instanceof UnknownDraftStoreError) {
    context.state.logger.error({
      event: "draft_persistence_failed",
      message: "Draft persistence failed.",
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
 * Wraps a Draft route with operation-specific logging context before the shared
 * response helper maps failures.
 */
const draftRouteHandler = (
  method: string,
  handler: (context: DraftRouterContext) => Promise<void> | void,
): (context: DraftRouterContext) => Promise<void> =>
  routeHandler<DraftRouterContext>(
    handleDraftRouteError,
    async (context) => {
      const draftId = context.params.draftId;
      context.state.logger = context.state.logger.with({
        service: "draft",
        method,
        route: requestRoute(context),
        ...(draftId === undefined
          ? {}
          : { resources: [{ type: "draft", id: draftId }] }),
      });
      await handler(context);
    },
  );

export const registerDraftsRoutes = (
  router: Router<LoggingState>,
  { listDrafts, getDraft, createDraft, updateDraft }: DraftsRouteDependencies,
): void => {
  router.get(
    "/api/drafts",
    draftRouteHandler(
      "listDrafts",
      async (context) => {
        const url = context.request.url;
        assertAllowedQueryParameters(url, ["stateId", "stackId"]);
        const stateId = readOptionalSingleQueryParameter(url, "stateId");
        const stackId = readOptionalSingleQueryParameter(url, "stackId");
        const drafts = await listDrafts(
          stateId === undefined && stackId === undefined ? undefined : {
            ...(stateId === undefined ? {} : { stateId }),
            ...(stackId === undefined ? {} : { stackId }),
          },
        );

        setJsonResponse(
          context,
          200,
          encodeDraftsResponse({
            drafts: [...drafts],
          }),
        );
      },
    ),
  );

  router.get(
    "/api/drafts/:draftId",
    draftRouteHandler(
      "getDraft",
      async (context) => {
        const draft = await getDraft(context.params.draftId ?? "");

        setJsonResponse(context, 200, encodeDraftResponse(draft));
      },
    ),
  );

  router.post(
    "/api/drafts",
    draftRouteHandler(
      "createDraft",
      async (context) => {
        const body = await readJsonRequestBody(context.request);
        const input = decodeRequestBody(CreateDraftBodySchema, body);
        const draft = await createDraft(input);

        setJsonResponse(context, 201, encodeDraftResponse(draft));
      },
    ),
  );

  router.patch(
    "/api/drafts/:draftId",
    draftRouteHandler(
      "updateDraft",
      async (context) => {
        const body = await readJsonRequestBody(context.request);
        const input = decodeRequestBody(UpdateDraftBodySchema, body);
        const draft = await updateDraft(context.params.draftId ?? "", input);

        setJsonResponse(context, 200, encodeDraftResponse(draft));
      },
    ),
  );
};
