import { Schema } from "effect";

export const UuidSchema = Schema.UUID;

export const isUuid = Schema.is(UuidSchema);

export const generateUuid = (): string => crypto.randomUUID();
