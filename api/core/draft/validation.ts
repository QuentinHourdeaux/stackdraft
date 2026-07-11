import { Effect } from "effect";
import { ValidationError } from "../errors.ts";
import { isUuid } from "../../lib/validation/uuid.ts";

const draftTitleMinLength = 1;
const draftTitleMaxLength = 160;
const descriptionMaxLength = 20000;

export const validateTitle = (
  title: string,
): Effect.Effect<string, ValidationError> => {
  const trimmed = title.trim();

  if (trimmed.length < draftTitleMinLength) {
    return Effect.fail(
      new ValidationError({
        fields: {
          title: "Title is required.",
        },
      }),
    );
  }

  if (trimmed.length > draftTitleMaxLength) {
    return Effect.fail(
      new ValidationError({
        fields: {
          title: "Title must be 160 characters or fewer.",
        },
      }),
    );
  }

  return Effect.succeed(trimmed);
};

export const validateDescription = (
  description: string,
): Effect.Effect<string, ValidationError> => {
  if (description.length > descriptionMaxLength) {
    return Effect.fail(
      new ValidationError({
        fields: {
          description: "Description must be 20,000 characters or fewer.",
        },
      }),
    );
  }

  return Effect.succeed(description);
};

export const validateDraftId = (
  draftId: string,
): Effect.Effect<string, ValidationError> => {
  if (!isUuid(draftId)) {
    return Effect.fail(
      new ValidationError({
        fields: {
          draftId: "Draft ID must be a valid UUID.",
        },
      }),
    );
  }

  return Effect.succeed(draftId);
};

export const validateStateId = (
  stateId: string,
): Effect.Effect<string, ValidationError> => {
  if (!isUuid(stateId)) {
    return Effect.fail(
      new ValidationError({
        fields: {
          stateId: "State ID must be a valid UUID.",
        },
      }),
    );
  }

  return Effect.succeed(stateId);
};

export const validateStackId = (
  stackId: string,
): Effect.Effect<string, ValidationError> => {
  if (!isUuid(stackId)) {
    return Effect.fail(
      new ValidationError({
        fields: {
          stackId: "Stack ID must be a valid UUID.",
        },
      }),
    );
  }

  return Effect.succeed(stackId);
};
