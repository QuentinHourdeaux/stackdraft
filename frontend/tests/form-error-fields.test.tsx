import { describe, expect, it } from "vitest";
import { ApiError } from "../src/lib/api/api-error.ts";
import { splitApiFieldError } from "../src/lib/forms/api-error-fields.ts";

describe("splitApiFieldError", () => {
  it("returns owned field errors and no form error", () => {
    const result = splitApiFieldError(
      new ApiError("VALIDATION_ERROR", "The request is invalid.", {
        fields: {
          name: "Name is required.",
          color: "Color is required.",
        },
      }),
      ["name", "color"] as const,
    );

    expect(result).toEqual({
      fieldErrors: {
        name: "Name is required.",
        color: "Color is required.",
      },
      formError: null,
    });
  });

  it("moves unowned field errors to the form error", () => {
    const result = splitApiFieldError(
      new ApiError("VALIDATION_ERROR", "The request is invalid.", {
        fields: {
          body: "At least one field is required.",
        },
      }),
      ["name", "color"] as const,
    );

    expect(result).toEqual({
      fieldErrors: {},
      formError: "At least one field is required.",
    });
  });

  it("returns a generic form error for non-API errors", () => {
    const result = splitApiFieldError(new Error("offline"), ["name"] as const);

    expect(result).toEqual({
      fieldErrors: {},
      formError: "offline",
    });
  });
});
