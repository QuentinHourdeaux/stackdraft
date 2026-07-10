import type { LogEvent, LogLevel, LogOutcome } from "./events.ts";
import type { LogResourceRef } from "./resources.ts";
import type { LogService } from "./services.ts";

export interface LogContext {
  readonly service?: LogService;
  readonly method?: string;
  readonly route?: string;
  readonly requestId?: string;
  readonly resources?: readonly LogResourceRef[];
}

// Event-specific fields stay scalar and nested under `fields` so callers cannot
// overwrite the logger's stable top-level schema or pass arbitrary object dumps.
export type LogFieldValue = string | number | boolean | undefined;
export type LogFields = Readonly<Record<string, LogFieldValue>>;

export interface LogInput {
  readonly event: LogEvent;
  readonly message: string;
  readonly httpStatus?: number;
  readonly outcome?: LogOutcome;
  readonly durationMs?: number;
  readonly fields?: LogFields;
  readonly cause?: unknown;
}

export interface Logger {
  readonly with: (context: LogContext) => Logger;
  readonly debug: (entry: LogInput) => void;
  readonly info: (entry: LogInput) => void;
  readonly warn: (entry: LogInput) => void;
  readonly error: (entry: LogInput) => void;
}

export type LogDestination = "stdout" | "stderr";
// Writers receive the final JSON line, which keeps output routing replaceable
// and gives tests a narrow seam without stubbing the global console.
export type LogWriter = (destination: LogDestination, line: string) => void;

export interface LoggerOptions {
  readonly minimumLevel: LogLevel;
  readonly context: LogContext & {
    readonly service: LogService;
    readonly method: string;
  };
  readonly now?: () => Date;
  readonly write?: LogWriter;
}

interface SerializedLogError {
  readonly name?: string;
  readonly message?: string;
  readonly _tag?: string;
  readonly stack?: string;
  readonly cause?: SerializedLogError;
  readonly text?: string;
}

const levelPriorities: Readonly<Record<LogLevel, number>> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MAX_ERROR_TEXT_LENGTH = 500;

const defaultWriter: LogWriter = (destination, line) => {
  if (destination === "stderr") {
    console.error(line);
    return;
  }

  console.log(line);
};

const nonEmptyString = (value: string | undefined): string | undefined => {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  return value;
};

const normalizeResources = (
  resources: readonly LogResourceRef[] | undefined,
): readonly LogResourceRef[] => {
  if (resources === undefined) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: LogResourceRef[] = [];

  for (const resource of resources) {
    if (resource.id.length === 0) {
      continue;
    }

    // The separator makes pairs such as (`ab`, `c`) and (`a`, `bc`) distinct.
    const key = `${resource.type}\u0000${resource.id}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(resource);
  }

  return normalized;
};

const mergeContext = (
  parent: LogContext,
  child: LogContext,
): LogContext => {
  // Scalar context becomes more specific as execution crosses boundaries,
  // while resource references accumulate to preserve the full operation scope.
  const resources = normalizeResources([
    ...(parent.resources ?? []),
    ...(child.resources ?? []),
  ]);

  return {
    service: child.service ?? parent.service,
    method: nonEmptyString(child.method) ?? parent.method,
    route: nonEmptyString(child.route) ?? parent.route,
    requestId: nonEmptyString(child.requestId) ?? parent.requestId,
    ...(resources.length > 0 ? { resources } : {}),
  };
};

const truncate = (value: string): string =>
  value.length <= MAX_ERROR_TEXT_LENGTH
    ? value
    : `${value.slice(0, MAX_ERROR_TEXT_LENGTH - 1)}…`;

const readStringProperty = (
  value: object,
  property: string,
): string | undefined => {
  try {
    const candidate = Reflect.get(value, property);
    return typeof candidate === "string" && candidate.length > 0
      ? truncate(candidate)
      : undefined;
  } catch {
    return undefined;
  }
};

const readProperty = (value: object, property: string): unknown => {
  try {
    return Reflect.get(value, property);
  } catch {
    return undefined;
  }
};

const boundedString = (value: unknown): string => {
  try {
    return truncate(String(value));
  } catch {
    return "[unserializable cause]";
  }
};

const serializeCause = (
  cause: unknown,
  includeStack: boolean,
  depth = 0,
): SerializedLogError => {
  // Error serialization is deliberately allowlisted and limited to one nested
  // cause. Logging must never turn an unknown dependency object into a dump.
  if (
    (typeof cause !== "object" && typeof cause !== "function") ||
    cause === null
  ) {
    return { text: boundedString(cause) };
  }

  const name = readStringProperty(cause, "name");
  const message = readStringProperty(cause, "message");
  const tag = readStringProperty(cause, "_tag");
  const stack = includeStack ? readStringProperty(cause, "stack") : undefined;
  const nestedCause = depth === 0 ? readProperty(cause, "cause") : undefined;
  const serializedNestedCause =
    nestedCause !== undefined && nestedCause !== cause
      ? serializeCause(nestedCause, includeStack, depth + 1)
      : undefined;

  if (
    name === undefined && message === undefined && tag === undefined &&
    stack === undefined && serializedNestedCause === undefined
  ) {
    return { text: boundedString(cause) };
  }

  return {
    ...(name === undefined ? {} : { name }),
    ...(message === undefined ? {} : { message }),
    ...(tag === undefined ? {} : { _tag: tag }),
    ...(stack === undefined ? {} : { stack }),
    ...(serializedNestedCause === undefined
      ? {}
      : { cause: serializedNestedCause }),
  };
};

const normalizeFields = (
  fields: LogFields | undefined,
): Readonly<Record<string, string | number | boolean>> | undefined => {
  if (fields === undefined) {
    return undefined;
  }

  const normalized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(fields)) {
    // JSON would silently coerce non-finite numbers to null, so omit them along
    // with empty values instead of changing their meaning in emitted output.
    if (
      key.length === 0 || value === undefined || value === "" ||
      (typeof value === "number" && !Number.isFinite(value))
    ) {
      continue;
    }

    normalized[key] = value;
  }

  return Object.keys(normalized).length === 0 ? undefined : normalized;
};

const shouldEmit = (minimumLevel: LogLevel, level: LogLevel): boolean =>
  levelPriorities[level] >= levelPriorities[minimumLevel];

const createContextualLogger = (
  minimumLevel: LogLevel,
  context: LogContext & {
    readonly service: LogService;
    readonly method: string;
  },
  now: () => Date,
  write: LogWriter,
): Logger => {
  const emit = (level: LogLevel, input: LogInput): void => {
    if (!shouldEmit(minimumLevel, level)) {
      return;
    }

    const fields = normalizeFields(input.fields);
    const error = input.cause === undefined ? undefined : serializeCause(
      input.cause,
      level === "debug" || minimumLevel === "debug",
    );
    const resources = normalizeResources(context.resources);
    const entry = {
      timestamp: now().toISOString(),
      level,
      service: context.service,
      method: context.method,
      ...(context.route === undefined ? {} : { route: context.route }),
      ...(context.requestId === undefined
        ? {}
        : { requestId: context.requestId }),
      ...(resources.length === 0 ? {} : { resources }),
      event: input.event,
      message: input.message,
      ...(input.httpStatus === undefined
        ? {}
        : { httpStatus: input.httpStatus }),
      ...(input.durationMs === undefined
        ? {}
        : { durationMs: input.durationMs }),
      ...(input.outcome === undefined ? {} : { outcome: input.outcome }),
      ...(fields === undefined ? {} : { fields }),
      ...(error === undefined ? {} : { error }),
    };

    write(
      level === "warn" || level === "error" ? "stderr" : "stdout",
      JSON.stringify(entry),
    );
  };

  return {
    with: (childContext) => {
      const merged = mergeContext(context, childContext);
      return createContextualLogger(
        minimumLevel,
        {
          ...merged,
          service: merged.service ?? context.service,
          method: merged.method ?? context.method,
        },
        now,
        write,
      );
    },
    debug: (entry) => emit("debug", entry),
    info: (entry) => emit("info", entry),
    warn: (entry) => emit("warn", entry),
    error: (entry) => emit("error", entry),
  };
};

export const createLogger = ({
  minimumLevel,
  context,
  now = () => new Date(),
  write = defaultWriter,
}: LoggerOptions): Logger =>
  createContextualLogger(
    minimumLevel,
    {
      ...context,
      method: nonEmptyString(context.method) ?? "unknown",
      resources: normalizeResources(context.resources),
    },
    now,
    write,
  );

// Tests and boundaries that intentionally do not emit logs can still satisfy a
// Logger dependency without branching at every call site.
export const noopLogger: Logger = {
  with: () => noopLogger,
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
