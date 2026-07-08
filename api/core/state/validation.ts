import { Effect, Schema } from "effect";
import type { StateScope } from "../../defs/state/state.ts";
import { StateScopeSchema } from "../../defs/state/state-schema.ts";
import { ValidationError } from "../errors.ts";
import { isUuid } from "../../lib/validation/uuid.ts";
import {
  isCssHexColor,
  normalizeCssHexColor,
} from "../../lib/validation/color.ts";

const stateNameMinLength = 1;
const stateNameMaxLength = 40;

export const isStateScope = (value: string): value is StateScope =>
  Schema.is(StateScopeSchema)(value);

export const validateScope = (
  scope: string,
): Effect.Effect<StateScope, ValidationError> => {
  if (!isStateScope(scope)) {
    return Effect.fail(
      new ValidationError({
        fields: {
          scope: "Scope must be stack or draft.",
        },
      }),
    );
  }

  return Effect.succeed(scope);
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

export const validateName = (
  name: string,
  field = "name",
): Effect.Effect<string, ValidationError> => {
  const trimmed = name.trim();

  if (trimmed.length < stateNameMinLength) {
    return Effect.fail(
      new ValidationError({
        fields: {
          [field]: "Name is required.",
        },
      }),
    );
  }

  if (trimmed.length > stateNameMaxLength) {
    return Effect.fail(
      new ValidationError({
        fields: {
          [field]: "Name must be 40 characters or fewer.",
        },
      }),
    );
  }

  return Effect.succeed(trimmed);
};

export const validateColor = (
  color: string,
  field = "color",
): Effect.Effect<string, ValidationError> => {
  if (!isCssHexColor(color)) {
    return Effect.fail(
      new ValidationError({
        fields: {
          [field]: "Color must be a hex color in the form #RRGGBB.",
        },
      }),
    );
  }

  return Effect.succeed(normalizeCssHexColor(color));
};

export const validatePosition = (
  position: number,
  maxPosition: number,
): Effect.Effect<number, ValidationError> => {
  if (!Schema.is(Schema.Int)(position)) {
    return Effect.fail(
      new ValidationError({
        fields: {
          position: "Position must be a whole number.",
        },
      }),
    );
  }

  if (position < 0 || position > maxPosition) {
    return Effect.fail(
      new ValidationError({
        fields: {
          position: `Position must be between 0 and ${maxPosition}.`,
        },
      }),
    );
  }

  return Effect.succeed(position);
};
