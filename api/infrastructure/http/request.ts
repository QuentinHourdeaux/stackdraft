import { ParseResult, Schema } from "effect";
import type { Request } from "@oak/oak";
import { ValidationError } from "../../application/validation-error.ts";

const schemaDecodeOptions = {
  onExcessProperty: "error" as const,
};

const schemaFieldMessages: Readonly<Record<string, string>> = {
  name: "Name is required.",
  scope: "Scope is required.",
  color: "Color is required.",
};

const formatSchemaIssueMessage = (
  issue: ParseResult.ArrayFormatterIssue,
): string => {
  if (issue._tag === "Missing") {
    const field = issue.path[0];

    if (typeof field === "string" && field in schemaFieldMessages) {
      return schemaFieldMessages[field] ?? "This field is required.";
    }
  }

  if (issue._tag === "Unexpected") {
    return "The request is invalid.";
  }

  return "The request is invalid.";
};

export const decodeRequestBody = <A, I>(
  schema: Schema.Schema<A, I, never>,
  body: unknown,
): A => {
  const result = Schema.decodeUnknownEither(schema)(body, schemaDecodeOptions);

  if (result._tag === "Right") {
    return result.right;
  }

  const issues = ParseResult.ArrayFormatter.formatIssueSync(result.left.issue);
  const fields: Record<string, string> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === "string" && !(field in fields)) {
      fields[field] = formatSchemaIssueMessage(issue);
    }
  }

  if (Object.keys(fields).length === 0) {
    throw new ValidationError({
      fields: {
        body: "The request is invalid.",
      },
    });
  }

  throw new ValidationError({ fields });
};

export const assertEmptyRequestBody = async (
  request: Request,
): Promise<void> => {
  const contentLength = request.headers.get("content-length");

  if (contentLength === "0") {
    return;
  }

  if (!request.hasBody) {
    if (contentLength === null) {
      return;
    }

    throw new ValidationError({
      fields: {
        body: "Request body must be empty.",
      },
    });
  }

  const bodyText = await request.body.text();

  if (bodyText.trim().length === 0) {
    return;
  }

  throw new ValidationError({
    fields: {
      body: "Request body must be empty.",
    },
  });
};

export const readJsonRequestBody = async (
  request: Request,
): Promise<unknown> => {
  const contentType = request.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();

  if (mediaType !== "application/json") {
    throw new ValidationError({
      fields: {
        body: "Request body must use application/json.",
      },
    });
  }

  try {
    return await request.body.json();
  } catch {
    throw new ValidationError({
      fields: {
        body: "Request body must be valid JSON.",
      },
    });
  }
};
