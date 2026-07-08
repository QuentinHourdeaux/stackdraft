import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { MemoryRouter } from "react-router";
import { App } from "../src/app/app.tsx";
import type { State } from "../src/api/states.ts";

const healthResponse = () =>
  new Response(JSON.stringify({ status: "ok", database: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const stackStates: State[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    scope: "stack",
    name: "Planned",
    color: "#8d98a5",
    position: 0,
    isDefault: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    scope: "stack",
    name: "Active",
    color: "#8fa8ff",
    position: 1,
    isDefault: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const draftStates: State[] = [
  {
    id: "00000000-0000-4000-8000-000000000005",
    scope: "draft",
    name: "Backlog",
    color: "#8d98a5",
    position: 0,
    isDefault: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    scope: "draft",
    name: "Todo",
    color: "#8fa8ff",
    position: 1,
    isDefault: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

type FetchHandler = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Response | Promise<Response>;

const renderStatesPage = (options?: { strict?: boolean }) => {
  const app = (
    <MemoryRouter initialEntries={["/settings/states"]}>
      <App />
    </MemoryRouter>
  );

  return render(options?.strict ? <StrictMode>{app}</StrictMode> : app);
};

const mockFetch = (handler: FetchHandler) => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(handler(input, init))
    ),
  );
};

const defaultStatesHandler = (options?: {
  stackStates?: State[];
  draftStates?: State[];
  stackStatus?: number;
  draftStatus?: number;
}): FetchHandler =>
(input, init) => {
  const url = new URL(String(input), "http://stackdraft.local");
  const method = init?.method ?? "GET";

  if (url.pathname === "/api/health") {
    return healthResponse();
  }

  if (url.pathname === "/api/states" && method === "GET") {
    if (url.searchParams.get("scope") === "stack") {
      if ((options?.stackStatus ?? 200) !== 200) {
        return new Response("Server error", {
          status: options?.stackStatus ?? 500,
        });
      }

      return new Response(
        JSON.stringify({ states: options?.stackStates ?? stackStates }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (url.searchParams.get("scope") === "draft") {
      if ((options?.draftStatus ?? 200) !== 200) {
        return new Response("Server error", {
          status: options?.draftStatus ?? 500,
        });
      }

      return new Response(
        JSON.stringify({ states: options?.draftStates ?? draftStates }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  return new Response("Not found", { status: 404 });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("state settings screen", () => {
  it("loads stack and draft states in API order with default markers", async () => {
    mockFetch(defaultStatesHandler());

    renderStatesPage();

    const stackSection = screen.getByRole("region", { name: "Stack states" });
    const draftSection = screen.getByRole("region", { name: "Draft states" });

    await waitFor(() => {
      expect(within(stackSection).getByText("Planned")).toBeInTheDocument();
      expect(within(stackSection).getByText("Active")).toBeInTheDocument();
      expect(within(draftSection).getByText("Backlog")).toBeInTheDocument();
      expect(within(draftSection).getByText("Todo")).toBeInTheDocument();
    });

    expect(within(stackSection).getAllByText("Default")).toHaveLength(1);
    expect(within(draftSection).getAllByText("Default")).toHaveLength(1);
    expect(
      within(stackSection).getByLabelText("Planned color"),
    ).toHaveStyle({ backgroundColor: "rgb(141, 152, 165)" });
  });

  it("keeps the other scope visible when one scope fails to load", async () => {
    mockFetch(defaultStatesHandler({ stackStatus: 500 }));

    renderStatesPage();

    const stackSection = screen.getByRole("region", { name: "Stack states" });
    const draftSection = screen.getByRole("region", { name: "Draft states" });

    await waitFor(() => {
      expect(
        within(stackSection).getByRole("alert"),
      ).toHaveTextContent("Request failed with status 500");
      expect(within(draftSection).getByText("Backlog")).toBeInTheDocument();
    });

    expect(
      within(stackSection).queryByRole("form", { name: "Add Stack state" }),
    ).not.toBeInTheDocument();
  });

  it("shows the create form only after a scope finishes loading", async () => {
    let resolveStackLoad: ((response: Response) => void) | undefined;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/health") {
        return Promise.resolve(healthResponse());
      }

      if (url.pathname === "/api/states" && method === "GET") {
        if (url.searchParams.get("scope") === "stack") {
          return new Promise<Response>((resolve) => {
            resolveStackLoad = resolve;
          });
        }

        if (url.searchParams.get("scope") === "draft") {
          return Promise.resolve(
            new Response(JSON.stringify({ states: draftStates }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
      }

      return Promise.resolve(new Response("Not found", { status: 404 }));
    });

    renderStatesPage();

    const stackSection = screen.getByRole("region", { name: "Stack states" });

    expect(
      within(stackSection).queryByRole("form", { name: "Add Stack state" }),
    ).not.toBeInTheDocument();

    resolveStackLoad?.(
      new Response(JSON.stringify({ states: stackStates }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await waitFor(() => {
      expect(
        within(stackSection).getByRole("form", { name: "Add Stack state" }),
      ).toBeInTheDocument();
    });
  });

  it("creates a state and appends the server response", async () => {
    const createdState: State = {
      id: "00000000-0000-4000-8000-000000000099",
      scope: "stack",
      name: "Review",
      color: "#aabbcc",
      position: 2,
      isDefault: false,
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/states" && method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify(createdState), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(defaultStatesHandler()(input, init));
    });

    const user = userEvent.setup();
    renderStatesPage();

    const stackSection = screen.getByRole("region", { name: "Stack states" });
    await waitFor(() => {
      expect(within(stackSection).getByText("Planned")).toBeInTheDocument();
    });

    const createForm = within(stackSection).getByRole("form", {
      name: "Add Stack state",
    });

    await user.type(within(createForm).getByLabelText("Name"), "Review");
    await user.clear(within(createForm).getByLabelText("Color"));
    await user.type(within(createForm).getByLabelText("Color"), "#aabbcc");
    await user.click(
      within(createForm).getByRole("button", { name: "Add state" }),
    );

    await waitFor(() => {
      expect(within(stackSection).getByText("Review")).toBeInTheDocument();
    });
  });

  it("edits a state and replaces the matching row", async () => {
    const updatedState: State = {
      ...stackStates[1]!,
      name: "In Flight",
      color: "#224466",
      updatedAt: "2026-01-03T00:00:00.000Z",
    };

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (
        url.pathname ===
          "/api/states/00000000-0000-4000-8000-000000000002" &&
        method === "PATCH"
      ) {
        return Promise.resolve(
          new Response(JSON.stringify(updatedState), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(defaultStatesHandler()(input, init));
    });

    const user = userEvent.setup();
    renderStatesPage();

    const stackSection = screen.getByRole("region", { name: "Stack states" });
    await waitFor(() => {
      expect(within(stackSection).getByText("Active")).toBeInTheDocument();
    });

    await user.click(
      within(stackSection).getByRole("button", { name: "Edit Active" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Edit Active" });
    const nameInput = within(dialog).getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "In Flight");
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() => {
      expect(within(stackSection).getByText("In Flight")).toBeInTheDocument();
      expect(within(stackSection).queryByText("Active")).not
        .toBeInTheDocument();
    });
  });

  it("opens the edit dialog under React StrictMode", async () => {
    mockFetch(defaultStatesHandler());

    const user = userEvent.setup();
    renderStatesPage({ strict: true });

    const stackSection = screen.getByRole("region", { name: "Stack states" });
    await waitFor(() => {
      expect(within(stackSection).getByText("Active")).toBeInTheDocument();
    });

    await user.click(
      within(stackSection).getByRole("button", { name: "Edit Active" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Edit Active" }),
    ).toBeInTheDocument();
  });

  it("prevents duplicate create submissions while pending", async () => {
    let createCalls = 0;
    let resolveCreate: ((response: Response) => void) | undefined;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/states" && method === "POST") {
        createCalls += 1;

        return new Promise<Response>((resolve) => {
          resolveCreate = resolve;
        });
      }

      return Promise.resolve(defaultStatesHandler()(input, init));
    });

    const user = userEvent.setup();
    renderStatesPage();

    const stackSection = screen.getByRole("region", { name: "Stack states" });
    await waitFor(() => {
      expect(within(stackSection).getByText("Planned")).toBeInTheDocument();
    });

    const createForm = within(stackSection).getByRole("form", {
      name: "Add Stack state",
    });
    const submitButton = within(createForm).getByRole("button", {
      name: "Add state",
    });

    await user.type(within(createForm).getByLabelText("Name"), "Review");
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent("Adding…");
    });

    await user.click(submitButton);
    expect(createCalls).toBe(1);

    resolveCreate?.(
      new Response(
        JSON.stringify({
          id: "00000000-0000-4000-8000-000000000099",
          scope: "stack",
          name: "Review",
          color: "#8fa8ff",
          position: 2,
          isDefault: false,
          createdAt: "2026-01-02T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await waitFor(() => {
      expect(createCalls).toBe(1);
    });
  });

  it("shows field errors beside the relevant input", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/states" && method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "STATE_NAME_CONFLICT",
                message: "A State with this name already exists in this scope.",
                details: {
                  fields: {
                    name:
                      "A State with this name already exists in this scope.",
                  },
                },
              },
            }),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.resolve(defaultStatesHandler()(input, init));
    });

    const user = userEvent.setup();
    renderStatesPage();

    const stackSection = screen.getByRole("region", { name: "Stack states" });
    await waitFor(() => {
      expect(within(stackSection).getByText("Planned")).toBeInTheDocument();
    });

    const createForm = within(stackSection).getByRole("form", {
      name: "Add Stack state",
    });

    await user.type(within(createForm).getByLabelText("Name"), "Planned");
    await user.click(
      within(createForm).getByRole("button", { name: "Add state" }),
    );

    expect(
      within(createForm).getByText(
        "A State with this name already exists in this scope.",
      ),
    ).toBeInTheDocument();
  });

  it("shows non-field edit errors in an alert region", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (
        url.pathname ===
          "/api/states/00000000-0000-4000-8000-000000000002" &&
        method === "PATCH"
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "STATE_NOT_FOUND",
                message: "The requested State does not exist.",
                details: {},
              },
            }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.resolve(defaultStatesHandler()(input, init));
    });

    const user = userEvent.setup();
    renderStatesPage();

    const stackSection = screen.getByRole("region", { name: "Stack states" });
    await waitFor(() => {
      expect(within(stackSection).getByText("Active")).toBeInTheDocument();
    });

    await user.click(
      within(stackSection).getByRole("button", { name: "Edit Active" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Edit Active" });
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    expect(
      within(dialog).getByRole("alert"),
    ).toHaveTextContent("The requested State does not exist.");
  });
});
