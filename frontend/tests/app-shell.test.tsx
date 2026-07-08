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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("application shell routing", () => {
  it("renders the Stack list placeholder at /", async () => {
    mockHealthFetch(
      new Response(JSON.stringify({ status: "ok", database: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderApp("/");

    expect(
      screen.getByRole("heading", { name: "Stacks", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your Stack list will appear here in a later update."),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("System ready");
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
      vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
        const url = new URL(String(input), "http://stackdraft.local");

        if (url.pathname === "/api/health") {
          return Promise.resolve(
            new Response(JSON.stringify({ status: "ok", database: "ok" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (url.pathname === "/api/states") {
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

    const user = userEvent.setup();
    renderApp("/");

    const nav = screen.getByRole("navigation", { name: "Main" });

    await user.click(within(nav).getByRole("link", { name: "States" }));

    expect(
      screen.getByRole("heading", { name: "States", level: 1 }),
    ).toBeInTheDocument();

    await user.click(within(nav).getByRole("link", { name: "Stacks" }));

    expect(
      screen.getByRole("heading", { name: "Stacks", level: 1 }),
    ).toBeInTheDocument();
  });

  it("shows a useful not-found view for unknown routes", () => {
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
      screen.getByRole("link", { name: "Back to Stacks" }),
    ).toHaveAttribute("href", "/");
  });

  it("keeps route content visible when health reporting fails", async () => {
    mockHealthFetch(new Response("Service unavailable", { status: 503 }));

    renderApp("/");

    expect(
      screen.getByRole("heading", { name: "Stacks", level: 1 }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "System unavailable",
      );
    });
  });
});
