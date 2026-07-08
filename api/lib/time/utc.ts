import { DateTime, Schema } from "effect";

export const utcDateTimeFromDate = (date: Date): DateTime.Utc =>
  DateTime.unsafeFromDate(date);

export const utcDateTimeFromIsoString = (value: string): DateTime.Utc =>
  Schema.decodeUnknownSync(Schema.DateTimeUtc)(value);

export const utcDateTimeToIsoString = (value: DateTime.Utc): string =>
  DateTime.formatIso(value);
