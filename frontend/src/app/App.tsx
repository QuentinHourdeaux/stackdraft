import { useEffect, useState } from "react";
import { fetchHealth } from "../api/health.ts";

type ConnectionState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready" }
  | { readonly kind: "error"; readonly message: string };

export function App() {
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
    <main className="app-shell">
      <section className="hero" aria-labelledby="stackdraft-title">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <p className="eyebrow">Developer project tracker</p>
        <h1 id="stackdraft-title">Stackdraft</h1>
        <p className="tagline">Track what you&apos;re building.</p>

        <div className={`system-state system-state--${connection.kind}`}>
          <span className="system-state__dot" aria-hidden="true" />
          <div>
            <strong>
              {connection.kind === "loading" && "Checking system"}
              {connection.kind === "ready" && "System ready"}
              {connection.kind === "error" && "System unavailable"}
            </strong>
            <p aria-live="polite">
              {connection.kind === "loading" &&
                "Connecting to the API and database…"}
              {connection.kind === "ready" &&
                "React, Deno, Effect, and SQLite are connected."}
              {connection.kind === "error" && connection.message}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
