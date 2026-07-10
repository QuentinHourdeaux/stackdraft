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

  it("disables move up on the first state and move down on the last state", async () => {
    mockFetch(defaultStatesHandler());

    renderStatesPage();

    const stackSection = screen.getByRole("region", { name: "Stack states" });
    await waitFor(() => {
      expect(within(stackSection).getByText("Planned")).toBeInTheDocument();
    });

    expect(
      within(stackSection).getByRole("button", { name: "Move Planned up" }),
    ).toBeDisabled();
    expect(
      within(stackSection).getByRole("button", { name: "Move Active down" }),
    ).toBeDisabled();
    expect(
      within(stackSection).getByRole("button", { name: "Move Planned down" }),
    ).toBeEnabled();
    expect(
      within(stackSection).getByRole("button", { name: "Move Active up" }),
    ).toBeEnabled();
  });

  it("reorders states from the server response after moving down", async () => {
    const reorderedStates: State[] = [
      { ...stackStates[1]!, position: 0 },
      { ...stackStates[0]!, position: 1 },
    ];

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (
        url.pathname ===
          "/api/states/00000000-0000-4000-8000-000000000001/position" &&
        method === "PUT"
      ) {
        return Promise.resolve(
          new Response(JSON.stringify({ states: reorderedStates }), {
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
      expect(within(stackSection).getByText("Planned")).toBeInTheDocument();
    });

    await user.click(
      within(stackSection).getByRole("button", { name: "Move Planned down" }),
    );

    await waitFor(() => {
      const listItems = within(stackSection).getAllByRole("listitem");
      expect(listItems[0]).toHaveTextContent("Active");
      expect(listItems[1]).toHaveTextContent("Planned");
    });
  });

  it("shows a recoverable error when moving a state fails", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname.endsWith("/position") && method === "PUT") {
        return new Response(
          JSON.stringify({
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "Could not save the new State order.",
            },
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return defaultStatesHandler()(input, init);
    });

    const user = userEvent.setup();
    renderStatesPage();

    const stackSection = screen.getByRole("region", { name: "Stack states" });
    await waitFor(() => {
      expect(within(stackSection).getByText("Planned")).toBeInTheDocument();
    });

    await user.click(
      within(stackSection).getByRole("button", { name: "Move Planned down" }),
    );

    expect(within(stackSection).getByRole("alert")).toHaveTextContent(
      "Could not save the new State order.",
    );
  });

  it("activates move controls with the keyboard", async () => {
    const reorderedStates: State[] = [
      { ...stackStates[1]!, position: 0 },
      { ...stackStates[0]!, position: 1 },
    ];

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (
        url.pathname.endsWith("/position") &&
        method === "PUT"
      ) {
        return Promise.resolve(
          new Response(JSON.stringify({ states: reorderedStates }), {
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
      expect(within(stackSection).getByText("Planned")).toBeInTheDocument();
    });

    const moveDown = within(stackSection).getByRole("button", {
      name: "Move Planned down",
    });
    moveDown.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      const listItems = within(stackSection).getAllByRole("listitem");
      expect(listItems[0]).toHaveTextContent("Active");
    });
  });

  it("changes the default state through the radio group", async () => {
    let defaultChanged = false;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (
        url.pathname ===
          "/api/states/00000000-0000-4000-8000-000000000002/default" &&
        method === "PUT"
      ) {
        defaultChanged = true;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...stackStates[1]!,
              isDefault: true,
              updatedAt: "2026-01-04T00:00:00.000Z",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      if (url.pathname === "/api/states" && method === "GET") {
        if (url.searchParams.get("scope") === "stack") {
          const states = defaultChanged
            ? [
              { ...stackStates[0]!, isDefault: false },
              { ...stackStates[1]!, isDefault: true },
            ]
            : stackStates;

          return Promise.resolve(
            new Response(JSON.stringify({ states }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
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
      within(stackSection).getByLabelText("Set Active as default"),
    );

    await waitFor(() => {
      expect(
        within(stackSection).getByLabelText("Set Active as default"),
      ).toBeChecked();
      expect(
        within(stackSection).getByLabelText("Set Planned as default"),
      ).not.toBeChecked();
      const defaultBadges = within(stackSection).getAllByText("Default");
      expect(defaultBadges).toHaveLength(1);
      expect(defaultBadges[0]?.closest("li")).toHaveTextContent("Active");
    });
  });

  it("shows a recoverable error when changing the default state fails", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname.endsWith("/default") && method === "PUT") {
        return new Response(
          JSON.stringify({
            error: {
              code: "STATE_NOT_FOUND",
              message: "The requested State does not exist.",
            },
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return defaultStatesHandler()(input, init);
    });

    const user = userEvent.setup();
    renderStatesPage();

    const stackSection = screen.getByRole("region", { name: "Stack states" });
    await waitFor(() => {
      expect(within(stackSection).getByText("Active")).toBeInTheDocument();
    });

    await user.click(
      within(stackSection).getByLabelText("Set Active as default"),
    );

    expect(within(stackSection).getByRole("alert")).toHaveTextContent(
      "The requested State does not exist.",
    );
  });

  it("requires confirmation before deleting a state", async () => {
    mockFetch(defaultStatesHandler());

    const user = userEvent.setup();
    renderStatesPage();

    const stackSection = screen.getByRole("region", { name: "Stack states" });
    await waitFor(() => {
      expect(within(stackSection).getByText("Active")).toBeInTheDocument();
    });

    await user.click(
      within(stackSection).getByRole("button", { name: "Delete Active" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Delete Active" });
    expect(dialog).toHaveTextContent("Active");
    expect(dialog).toHaveTextContent("cannot be undone");

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(dialog).not.toBeInTheDocument();
    expect(within(stackSection).getByText("Active")).toBeInTheDocument();
  });

  it("deletes a state after confirmation", async () => {
    let activeDeleted = false;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (
        url.pathname ===
          "/api/states/00000000-0000-4000-8000-000000000002" &&
        method === "DELETE"
      ) {
        activeDeleted = true;
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      if (url.pathname === "/api/states" && method === "GET") {
        if (url.searchParams.get("scope") === "stack") {
          const states = activeDeleted
            ? [{ ...stackStates[0]!, position: 0 }]
            : stackStates;

          return Promise.resolve(
            new Response(JSON.stringify({ states }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
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
      within(stackSection).getByRole("button", { name: "Delete Active" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Delete Active" });
    await user.click(
      within(dialog).getByRole("button", { name: "Delete state" }),
    );

    await waitFor(() => {
      expect(within(stackSection).queryByText("Active")).not
        .toBeInTheDocument();
      expect(within(stackSection).getByText("Planned")).toBeInTheDocument();
    });
  });

  it("refetches compacted positions after deleting a middle state", async () => {
    const threeStackStates: State[] = [
      stackStates[0]!,
      stackStates[1]!,
      {
        id: "00000000-0000-4000-8000-000000000003",
        scope: "stack",
        name: "Done",
        color: "#44aa88",
        position: 2,
        isDefault: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    let activeDeleted = false;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (
        url.pathname ===
          "/api/states/00000000-0000-4000-8000-000000000002" &&
        method === "DELETE"
      ) {
        activeDeleted = true;
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      if (url.pathname === "/api/states" && method === "GET") {
        if (url.searchParams.get("scope") === "stack") {
          const states = activeDeleted
            ? [
              { ...threeStackStates[0]!, position: 0 },
              { ...threeStackStates[2]!, position: 1 },
            ]
            : threeStackStates;

          return Promise.resolve(
            new Response(JSON.stringify({ states }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
      }

      return Promise.resolve(
        defaultStatesHandler({ stackStates: threeStackStates })(input, init),
      );
    });

    const user = userEvent.setup();
    renderStatesPage();

    const stackSection = screen.getByRole("region", { name: "Stack states" });
    await waitFor(() => {
      expect(within(stackSection).getByText("Done")).toBeInTheDocument();
    });

    await user.click(
      within(stackSection).getByRole("button", { name: "Delete Active" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Delete Active" });
    await user.click(
      within(dialog).getByRole("button", { name: "Delete state" }),
    );

    await waitFor(() => {
      expect(within(stackSection).queryByText("Active")).not
        .toBeInTheDocument();
      expect(
        within(stackSection).getByRole("button", { name: "Move Done down" }),
      ).toBeDisabled();
      expect(
        within(stackSection).getByRole("button", { name: "Move Done up" }),
      ).toBeEnabled();
    });
  });

  it.each(
    [
      [
        "STATE_IS_DEFAULT",
        "This State is the current default for its scope.",
        "00000000-0000-4000-8000-000000000001",
        "Delete Planned",
      ],
      [
        "STATE_IN_USE",
        "This State is assigned to existing Stacks or Drafts.",
        "00000000-0000-4000-8000-000000000002",
        "Delete Active",
      ],
      [
        "LAST_STATE_IN_SCOPE",
        "At least one State must remain in each scope.",
        "00000000-0000-4000-8000-000000000001",
        "Delete Planned",
      ],
    ] as const,
  )(
    "keeps the state visible and shows the server message for %s",
    async (_code, message, stateId, deleteButtonName) => {
      mockFetch((input, init) => {
        const url = new URL(String(input), "http://stackdraft.local");
        const method = init?.method ?? "GET";

        if (url.pathname === `/api/states/${stateId}` && method === "DELETE") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                error: {
                  code: _code,
                  message,
                  details: {},
                },
              }),
              {
                status: 409,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        return Promise.resolve(
          defaultStatesHandler({
            stackStates: _code === "LAST_STATE_IN_SCOPE"
              ? [stackStates[0]!]
              : stackStates,
          })(input, init),
        );
      });

      const user = userEvent.setup();
      renderStatesPage();

      const stackSection = screen.getByRole("region", { name: "Stack states" });
      await waitFor(() => {
        expect(within(stackSection).getByText("Planned")).toBeInTheDocument();
      });

      await user.click(
        within(stackSection).getByRole("button", { name: deleteButtonName }),
      );

      const dialog = screen.getByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", { name: "Delete state" }),
      );

      await waitFor(() => {
        expect(within(stackSection).getByRole("alert")).toHaveTextContent(
          message,
        );
        expect(within(stackSection).getByText("Planned")).toBeInTheDocument();
      });
    },
  );
});
