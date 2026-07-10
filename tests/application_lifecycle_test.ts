import { assertEquals, assertRejects } from "@std/assert";
import {
  type LifecycleRuntime,
  runApplicationLifecycle,
} from "../api/infrastructure/http/lifecycle.ts";
import { createLogger } from "../api/lib/logging/logger.ts";

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
}

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const recordingLogger = (entries: Array<Record<string, unknown>>) =>
  createLogger({
    minimumLevel: "info",
    context: { service: "app", method: "main" },
    write: (_destination, line) => {
      entries.push(JSON.parse(line) as Record<string, unknown>);
    },
  });

const createRuntime = () => {
  const listeners = new Map<Deno.Signal, () => void>();
  const exitCodes: number[] = [];
  const runtime: LifecycleRuntime = {
    addSignalListener: (signal, listener) => {
      listeners.set(signal, listener);
    },
    removeSignalListener: (signal, listener) => {
      if (listeners.get(signal) === listener) {
        listeners.delete(signal);
      }
    },
    exit: (code) => {
      exitCodes.push(code);
    },
  };

  return { runtime, listeners, exitCodes };
};

const eventNames = (
  entries: Array<Record<string, unknown>>,
): readonly unknown[] => entries.map((entry) => entry.event);

Deno.test("application lifecycle logs bind failure and closes exactly once", async () => {
  const entries: Array<Record<string, unknown>> = [];
  const { runtime, listeners } = createRuntime();
  const bindFailure = new Error("address already in use");
  let closeCalls = 0;

  await assertRejects(
    () =>
      runApplicationLifecycle({
        server: {
          onListen: () => {},
          listen: () => Promise.reject(bindFailure),
        },
        listenOptions: { hostname: "127.0.0.1", port: 8000 },
        logger: recordingLogger(entries),
        operationalFields: { host: "127.0.0.1", port: 8000 },
        close: () => {
          closeCalls += 1;
          return Promise.resolve();
        },
        runtime,
      }),
    Error,
    "address already in use",
  );

  assertEquals(eventNames(entries), [
    "app_startup_failed",
    "app_shutdown_started",
    "app_shutdown_completed",
  ]);
  assertEquals(closeCalls, 1);
  assertEquals(listeners.size, 0);
});

Deno.test("application lifecycle logs startup only after the listen event", async () => {
  const entries: Array<Record<string, unknown>> = [];
  const { runtime } = createRuntime();
  let notifyListening: (() => void) | undefined;
  let closeCalls = 0;

  await runApplicationLifecycle({
    server: {
      onListen: (listener) => {
        notifyListening = listener;
      },
      listen: () => {
        assertEquals(eventNames(entries), []);
        notifyListening?.();
        return Promise.resolve();
      },
    },
    listenOptions: { hostname: "0.0.0.0", port: 9000 },
    logger: recordingLogger(entries),
    operationalFields: { host: "0.0.0.0", port: 9000 },
    close: () => {
      closeCalls += 1;
      return Promise.resolve();
    },
    runtime,
  });

  assertEquals(eventNames(entries), [
    "app_started",
    "app_shutdown_started",
    "app_shutdown_completed",
  ]);
  assertEquals(entries[0]?.fields, { host: "0.0.0.0", port: 9000 });
  assertEquals(closeCalls, 1);
});

Deno.test("signal and listen cleanup paths share one in-flight cleanup", async () => {
  const entries: Array<Record<string, unknown>> = [];
  const { runtime, listeners, exitCodes } = createRuntime();
  const listening = deferred<void>();
  const closing = deferred<void>();
  let notifyListening: (() => void) | undefined;
  let closeCalls = 0;

  const lifecycle = runApplicationLifecycle({
    server: {
      onListen: (listener) => {
        notifyListening = listener;
      },
      listen: () => listening.promise,
    },
    listenOptions: { hostname: "127.0.0.1", port: 8000 },
    logger: recordingLogger(entries),
    operationalFields: { host: "127.0.0.1", port: 8000 },
    close: () => {
      closeCalls += 1;
      return closing.promise;
    },
    runtime,
  });

  notifyListening?.();
  listeners.get("SIGTERM")?.();
  listening.resolve();
  closing.resolve();

  await lifecycle;
  await Promise.resolve();

  assertEquals(eventNames(entries), [
    "app_started",
    "app_shutdown_started",
    "app_shutdown_completed",
  ]);
  assertEquals(closeCalls, 1);
  assertEquals(exitCodes, [0]);
  assertEquals(listeners.size, 0);
});
