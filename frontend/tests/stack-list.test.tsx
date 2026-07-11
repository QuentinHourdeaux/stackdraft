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
import type { Stack } from "../src/api/stacks.ts";
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

const existingStack: Stack = {
  id: "00000000-0000-4000-8000-000000000010",
  title: "Stackdraft",
  description: "Track personal engineering work.",
  stateId: stackStates[0]!.id,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

type FetchHandler = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Response | Promise<Response>;

const renderApp = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>,
  );

const mockFetch = (handler: FetchHandler) => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(handler(input, init))
    ),
  );
};

const defaultStacksHandler = (options?: {
  stacks?: Stack[];
  stackStates?: State[];
  stacksStatus?: number;
  statesStatus?: number;
}): FetchHandler =>
(input, init) => {
  const url = new URL(String(input), "http://stackdraft.local");
  const method = init?.method ?? "GET";

  if (url.pathname === "/api/health") {
    return healthResponse();
  }

  if (url.pathname === "/api/states" && method === "GET") {
    if (url.searchParams.get("scope") !== "stack") {
      return new Response("Not found", { status: 404 });
    }

    if ((options?.statesStatus ?? 200) !== 200) {
      return new Response("Server error", {
        status: options?.statesStatus ?? 500,
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

  if (url.pathname === "/api/stacks" && method === "GET") {
    if ((options?.stacksStatus ?? 200) !== 200) {
      return new Response("Server error", {
        status: options?.stacksStatus ?? 500,
      });
    }

    return new Response(
      JSON.stringify({ stacks: options?.stacks ?? [] }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (
    url.pathname === `/api/stacks/${existingStack.id}` &&
    method === "GET"
  ) {
    return new Response(JSON.stringify(existingStack), {
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

describe("stack list screen", () => {
  it("shows a first-run empty state with the create form", async () => {
    mockFetch(defaultStacksHandler());

    renderApp("/");

    await waitFor(() => {
      expect(
        screen.getByText(
          "Capture your first Stack to start tracking personal engineering work.",
        ),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("form", { name: "Create your first Stack" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("State"),
    ).toHaveDisplayValue("Planned (default)");
  });

  it("lists stacks with state and description preview", async () => {
    mockFetch(
      defaultStacksHandler({
        stacks: [
          existingStack,
          {
            ...existingStack,
            id: "00000000-0000-4000-8000-000000000011",
            title: "Side project",
            description: "",
            stateId: stackStates[1]!.id,
          },
        ],
      }),
    );

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("list")).toBeInTheDocument();
    });

    const stackList = screen.getByRole("list");
    const stackdraftLink = within(stackList).getByRole("link", {
      name: /Stackdraft/,
    });
    expect(within(stackdraftLink).getByText("Planned")).toBeInTheDocument();
    expect(
      within(stackdraftLink).getByText("Track personal engineering work."),
    ).toBeInTheDocument();

    const sideProjectLink = within(stackList).getByRole("link", {
      name: /Side project/,
    });
    expect(within(sideProjectLink).getByText("Active")).toBeInTheDocument();
    expect(
      within(sideProjectLink).queryByText(/Track personal/),
    ).not.toBeInTheDocument();
  });

  it("creates a stack with only a title and navigates to its detail page", async () => {
    const createdStack: Stack = {
      id: "00000000-0000-4000-8000-000000000099",
      title: "New Stack",
      description: "",
      stateId: stackStates[0]!.id,
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };

    let createBody: unknown;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/stacks" && method === "POST") {
        createBody = JSON.parse(String(init?.body));
        return Promise.resolve(
          new Response(JSON.stringify(createdStack), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (
        url.pathname === `/api/stacks/${createdStack.id}` &&
        method === "GET"
      ) {
        return Promise.resolve(
          new Response(JSON.stringify(createdStack), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(defaultStacksHandler()(input, init));
    });

    const user = userEvent.setup();
    renderApp("/");

    const createForm = await screen.findByRole("form", {
      name: "Create your first Stack",
    });

    await user.type(within(createForm).getByLabelText("Title"), "New Stack");
    await user.click(
      within(createForm).getByRole("button", { name: "Create Stack" }),
    );

    await waitFor(() => {
      const heading = screen.getByRole("heading", {
        name: "New Stack",
        level: 1,
      });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveFocus();
    });

    expect(createBody).toEqual({ title: "New Stack" });
  });

  it("submits an explicit state when the default is not selected", async () => {
    const createdStack: Stack = {
      id: "00000000-0000-4000-8000-000000000099",
      title: "Active Stack",
      description: "",
      stateId: stackStates[1]!.id,
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };

    let createBody: unknown;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/stacks" && method === "POST") {
        createBody = JSON.parse(String(init?.body));
        return Promise.resolve(
          new Response(JSON.stringify(createdStack), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (
        url.pathname === `/api/stacks/${createdStack.id}` &&
        method === "GET"
      ) {
        return Promise.resolve(
          new Response(JSON.stringify(createdStack), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(defaultStacksHandler()(input, init));
    });

    const user = userEvent.setup();
    renderApp("/");

    const createForm = await screen.findByRole("form", {
      name: "Create your first Stack",
    });

    await user.type(within(createForm).getByLabelText("Title"), "Active Stack");
    await user.selectOptions(
      within(createForm).getByLabelText("State"),
      stackStates[1]!.id,
    );
    await user.click(
      within(createForm).getByRole("button", { name: "Create Stack" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Active Stack", level: 1 }),
      ).toBeInTheDocument();
    });

    expect(createBody).toEqual({
      title: "Active Stack",
      stateId: stackStates[1]!.id,
    });
  });

  it("shows field errors beside the relevant input", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/stacks" && method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "VALIDATION_ERROR",
                message: "The request is invalid.",
                details: {
                  fields: {
                    title: "Title is required.",
                  },
                },
              },
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.resolve(defaultStacksHandler()(input, init));
    });

    const user = userEvent.setup();
    renderApp("/");

    const createForm = await screen.findByRole("form", {
      name: "Create your first Stack",
    });
    const titleInput = within(createForm).getByLabelText("Title");

    await user.type(titleInput, " ");
    await user.click(
      within(createForm).getByRole("button", { name: "Create Stack" }),
    );

    expect(
      within(createForm).getByText("Title is required."),
    ).toBeInTheDocument();
  });

  it("shows a recoverable error when loading stacks fails", async () => {
    mockFetch(defaultStacksHandler({ stacksStatus: 500 }));

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Request failed with status 500",
      );
    });

    expect(
      screen.getByRole("button", { name: "Retry loading Stacks" }),
    ).toBeInTheDocument();
  });

  it("shows a recoverable error when creating a stack fails", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/stacks" && method === "POST") {
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

      return Promise.resolve(defaultStacksHandler()(input, init));
    });

    const user = userEvent.setup();
    renderApp("/");

    const createForm = await screen.findByRole("form", {
      name: "Create your first Stack",
    });

    await user.type(within(createForm).getByLabelText("Title"), "Broken Stack");
    await user.click(
      within(createForm).getByRole("button", { name: "Create Stack" }),
    );

    expect(
      within(createForm).getByRole("alert"),
    ).toHaveTextContent("The requested State does not exist.");
  });

  it("prevents duplicate create submissions while pending", async () => {
    let createCalls = 0;
    let resolveCreate: ((response: Response) => void) | undefined;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/stacks" && method === "POST") {
        createCalls += 1;

        return new Promise<Response>((resolve) => {
          resolveCreate = resolve;
        });
      }

      return Promise.resolve(defaultStacksHandler()(input, init));
    });

    const user = userEvent.setup();
    renderApp("/");

    const createForm = await screen.findByRole("form", {
      name: "Create your first Stack",
    });
    const submitButton = within(createForm).getByRole("button", {
      name: "Create Stack",
    });

    await user.type(
      within(createForm).getByLabelText("Title"),
      "Pending Stack",
    );
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent("Creating…");
    });

    await user.click(submitButton);
    expect(createCalls).toBe(1);

    resolveCreate?.(
      new Response(
        JSON.stringify({
          id: "00000000-0000-4000-8000-000000000099",
          title: "Pending Stack",
          description: "",
          stateId: stackStates[0]!.id,
          createdAt: "2026-01-02T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  });

  it("submits the create form with the keyboard", async () => {
    const createdStack: Stack = {
      id: "00000000-0000-4000-8000-000000000099",
      title: "Keyboard Stack",
      description: "",
      stateId: stackStates[0]!.id,
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/stacks" && method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify(createdStack), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (
        url.pathname === `/api/stacks/${createdStack.id}` &&
        method === "GET"
      ) {
        return Promise.resolve(
          new Response(JSON.stringify(createdStack), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(defaultStacksHandler()(input, init));
    });

    const user = userEvent.setup();
    renderApp("/");

    const createForm = await screen.findByRole("form", {
      name: "Create your first Stack",
    });

    await user.type(
      within(createForm).getByLabelText("Title"),
      "Keyboard Stack",
    );
    await user.keyboard("{Enter}");

    await waitFor(() => {
      const heading = screen.getByRole("heading", {
        name: "Keyboard Stack",
        level: 1,
      });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveFocus();
    });
  });
});

describe("stack detail screen", () => {
  it("loads a stack summary from a direct navigation", async () => {
    mockFetch(defaultStacksHandler({ stacks: [existingStack] }));

    renderApp(`/stacks/${existingStack.id}`);

    await waitFor(() => {
      const heading = screen.getByRole("heading", {
        name: "Stackdraft",
        level: 1,
      });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveFocus();
    });

    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(
      screen.getByText("Track personal engineering work."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Stacks" }),
    ).toHaveAttribute("href", "/");
  });

  it("shows a useful not-found state for an unknown stack id", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (
        url.pathname === "/api/stacks/00000000-0000-4000-8000-000000000099" &&
        method === "GET"
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "STACK_NOT_FOUND",
                message: "The requested Stack does not exist.",
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

      return Promise.resolve(defaultStacksHandler()(input, init));
    });

    renderApp("/stacks/00000000-0000-4000-8000-000000000099");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Stack not found", level: 1 }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("This Stack does not exist or is no longer available."),
    ).toBeInTheDocument();
  });
});
