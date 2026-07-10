import type { LogFields, Logger } from "../../lib/logging/logger.ts";

export interface ServerListenOptions {
  readonly hostname: string;
  readonly port: number;
}

export interface LifecycleServer {
  readonly onListen: (listener: () => void) => void;
  readonly listen: (options: ServerListenOptions) => Promise<void>;
}

export interface LifecycleRuntime {
  readonly addSignalListener: (
    signal: Deno.Signal,
    listener: () => void,
  ) => void;
  readonly removeSignalListener: (
    signal: Deno.Signal,
    listener: () => void,
  ) => void;
  readonly exit: (code: number) => void;
}

export interface ApplicationLifecycleOptions {
  readonly server: LifecycleServer;
  readonly listenOptions: ServerListenOptions;
  readonly logger: Logger;
  readonly operationalFields: LogFields;
  readonly close: () => Promise<void>;
  readonly runtime?: LifecycleRuntime;
}

const defaultRuntime: LifecycleRuntime = {
  addSignalListener: (signal, listener) =>
    Deno.addSignalListener(signal, listener),
  removeSignalListener: (signal, listener) =>
    Deno.removeSignalListener(signal, listener),
  exit: (code) => Deno.exit(code),
};

const signals = ["SIGINT", "SIGTERM"] as const;

/**
 * Owns the server lifecycle after application construction: bind-aware startup
 * logging, coordinated signal handling, and exactly-once shutdown cleanup.
 */
export const runApplicationLifecycle = async ({
  server,
  listenOptions,
  logger,
  operationalFields,
  close,
  runtime = defaultRuntime,
}: ApplicationLifecycleOptions): Promise<void> => {
  let startupCompleted = false;
  let cleanupPromise: Promise<void> | undefined;
  const registeredSignals: Deno.Signal[] = [];
  const shutdownLogger = logger.with({
    service: "app",
    method: "shutdown",
  });

  // Signal handlers and the listen finally block can race. Every caller shares
  // this in-flight promise so cleanup and its boundary events happen once.
  const cleanup = (): Promise<void> => {
    if (cleanupPromise !== undefined) {
      return cleanupPromise;
    }

    cleanupPromise = (async () => {
      shutdownLogger.info({
        event: "app_shutdown_started",
        message: "Started Stackdraft shutdown cleanup.",
      });

      try {
        await close();
        shutdownLogger.info({
          event: "app_shutdown_completed",
          message: "Completed Stackdraft shutdown cleanup.",
          outcome: "success",
        });
      } catch (cause) {
        shutdownLogger.error({
          event: "app_shutdown_failed",
          message: "Stackdraft shutdown cleanup failed.",
          outcome: "failure",
          cause,
        });
        throw cause;
      }
    })();

    return cleanupPromise;
  };

  const stop = (): void => {
    // The process exits only after the database cleanup and final log complete.
    void cleanup().then(
      () => runtime.exit(0),
      () => runtime.exit(1),
    );
  };

  try {
    // Oak fires its listen event only after binding succeeds, so this callback
    // is the sole place allowed to claim successful application startup.
    server.onListen(() => {
      logger.info({
        event: "app_started",
        message: "Stackdraft started.",
        outcome: "success",
        fields: operationalFields,
      });
      startupCompleted = true;
    });

    for (const signal of signals) {
      runtime.addSignalListener(signal, stop);
      registeredSignals.push(signal);
    }

    await server.listen(listenOptions);
  } catch (cause) {
    if (!startupCompleted) {
      logger.error({
        event: "app_startup_failed",
        message: "Stackdraft startup failed.",
        outcome: "failure",
        fields: operationalFields,
        cause,
      });
    }
    throw cause;
  } finally {
    for (const signal of registeredSignals) {
      runtime.removeSignalListener(signal, stop);
    }
    await cleanup();
  }
};
