import { Data } from "effect";

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly fields: Readonly<Record<string, string>>;
}> {}
