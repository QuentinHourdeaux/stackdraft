import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { App } from "../src/app/app.tsx";

const renderApp = (initialEntry: string) => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>,
  );
};

const mockHealthFetch = (response: Response) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(response)),
  );
};

const defaultFetchHandler = (
  input: RequestInfo | URL,
  init?: RequestInit,
): Response => {
  const url = new URL(String(input), "http://stackdraft.local");
  const method = init?.method ?? "GET";

  if (url.pathname === "/api/health") {
    return new Response(JSON.stringify({ status: "ok", database: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/api/states" && method === "GET") {
    return new Response(JSON.stringify({ states: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/api/drafts" && method === "GET") {
    return new Response(JSON.stringify({ drafts: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/api/stacks" && method === "GET") {
    return new Response(JSON.stringify({ stacks: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Not found", { status: 404 });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("application shell routing", () => {
  it("renders the Draft list at /", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        Promise.resolve(defaultFetchHandler(input, init))
      ),
    );

    renderApp("/");

    expect(
      screen.getByRole("heading", { name: "Drafts", level: 1 }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Record work in seconds without creating a Stack first.",
        ),
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("System ready");
    });
  });

  it("renders the Stack list at /stacks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        Promise.resolve(defaultFetchHandler(input, init))
      ),
    );

    renderApp("/stacks");

    expect(
      screen.getByRole("heading", { name: "Stacks", level: 1 }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Capture your first Stack to start tracking personal engineering work.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("renders the State settings screen at /settings/states", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), "http://stackdraft.local");
        const method = init?.method ?? "GET";

        if (url.pathname === "/api/health") {
          return Promise.resolve(
            new Response(JSON.stringify({ status: "ok", database: "ok" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (url.pathname === "/api/states" && method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ states: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        return Promise.resolve(new Response("Not found", { status: 404 }));
      }),
    );

    renderApp("/settings/states");

    expect(
      screen.getByRole("heading", { name: "States", level: 1 }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Stack states" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("region", { name: "Draft states" }),
      ).toBeInTheDocument();
    });
  });

  it("navigates between routes from the main navigation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        Promise.resolve(defaultFetchHandler(input, init))
      ),
    );

    const user = userEvent.setup();
    renderApp("/");

    const nav = screen.getByRole("navigation", { name: "Main" });

    await user.click(within(nav).getByRole("link", { name: "Stacks" }));

    expect(
      screen.getByRole("heading", { name: "Stacks", level: 1 }),
    ).toBeInTheDocument();

    await user.click(within(nav).getByRole("link", { name: "Drafts" }));

    expect(
      screen.getByRole("heading", { name: "Drafts", level: 1 }),
    ).toBeInTheDocument();

    await user.click(within(nav).getByRole("link", { name: "States" }));

    expect(
      screen.getByRole("heading", { name: "States", level: 1 }),
    ).toBeInTheDocument();
  });

  it("shows a useful not-found view for unknown routes", async () => {
    mockHealthFetch(
      new Response(JSON.stringify({ status: "ok", database: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderApp("/does-not-exist");

    expect(
      screen.getByRole("heading", { name: "Page not found", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Drafts" }),
    ).toHaveAttribute("href", "/");

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("System ready");
    });
  });

  it("keeps route content visible when health reporting fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), "http://stackdraft.local");

        if (url.pathname === "/api/health") {
          return Promise.resolve(
            new Response("Service unavailable", {
              status: 503,
            }),
          );
        }

        return Promise.resolve(defaultFetchHandler(input, init));
      }),
    );

    renderApp("/");

    expect(
      screen.getByRole("heading", { name: "Drafts", level: 1 }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "System unavailable",
      );
    });
  });
});
