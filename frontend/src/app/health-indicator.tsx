import { useEffect, useState } from "react";
import { fetchHealth } from "../api/health.ts";

type ConnectionState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready" }
  | { readonly kind: "error"; readonly message: string };

const statusLabel = (connection: ConnectionState): string => {
  switch (connection.kind) {
    case "loading":
      return "Checking system";
    case "ready":
      return "System ready";
    case "error":
      return "System unavailable";
  }
};

const statusDetail = (connection: ConnectionState): string => {
  switch (connection.kind) {
    case "loading":
      return "Connecting to the API and database…";
    case "ready":
      return "API and database are connected.";
    case "error":
      return connection.message;
  }
};

export function HealthIndicator() {
  const [connection, setConnection] = useState<ConnectionState>({
    kind: "loading",
  });

  useEffect(() => {
    const abortController = new AbortController();

    fetchHealth(abortController.signal)
      .then(() => setConnection({ kind: "ready" }))
      .catch((cause: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }

        setConnection({
          kind: "error",
          message: cause instanceof Error
            ? cause.message
            : "Could not reach the Stackdraft API.",
        });
      });

    return () => abortController.abort();
  }, []);

  return (
    <div
      className={`health-indicator health-indicator--${connection.kind}`}
      role="status"
      aria-live="polite"
      title={statusDetail(connection)}
    >
      <span className="health-indicator__dot" aria-hidden="true" />
      <span className="health-indicator__label">{statusLabel(connection)}</span>
    </div>
  );
}
