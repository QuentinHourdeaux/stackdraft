import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router";
import type { RenderResult } from "@testing-library/react";
import { App } from "../src/app/app.tsx";
import type { Draft } from "../src/api/drafts.ts";
import { insertDraftInOrder } from "../src/features/draft/draft-order.ts";
import type { Stack } from "../src/api/stacks.ts";
import type { State } from "../src/api/states.ts";

function LocationProbe() {
  const location = useLocation();

  return (
    <div
      data-testid="location-probe"
      data-pathname={location.pathname}
      data-search={location.search}
      hidden
    />
  );
}

const readLocationPathname = () =>
  screen.getByTestId("location-probe").getAttribute("data-pathname") ?? "";

const readLocationSearch = () =>
  screen.getByTestId("location-probe").getAttribute("data-search") ?? "";

const healthResponse = () =>
  new Response(JSON.stringify({ status: "ok", database: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

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
];

const existingStack: Stack = {
  id: "00000000-0000-4000-8000-000000000010",
  title: "Stackdraft",
  description: "Track personal engineering work.",
  stateId: stackStates[0]!.id,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const secondStack: Stack = {
  id: "00000000-0000-4000-8000-000000000011",
  title: "Side project",
  description: "",
  stateId: stackStates[0]!.id,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const standaloneDraft: Draft = {
  id: "00000000-0000-4000-8000-000000000020",
  stackId: null,
  title: "Standalone note",
  description: "",
  stateId: draftStates[0]!.id,
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const stackedDraft: Draft = {
  id: "00000000-0000-4000-8000-000000000021",
  stackId: existingStack.id,
  title: "Stack-linked note",
  description: "",
  stateId: draftStates[1]!.id,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const olderDraft: Draft = {
  id: "00000000-0000-4000-8000-000000000030",
  stackId: null,
  title: "Older note",
  description: "",
  stateId: draftStates[0]!.id,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const newerDraft: Draft = {
  id: "00000000-0000-4000-8000-000000000031",
  stackId: null,
  title: "Newer note",
  description: "",
  stateId: draftStates[0]!.id,
  createdAt: "2026-01-03T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
};

const tiedDraftA: Draft = {
  id: "00000000-0000-4000-8000-000000000040",
  stackId: null,
  title: "Tied A",
  description: "",
  stateId: draftStates[0]!.id,
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const tiedDraftB: Draft = {
  id: "00000000-0000-4000-8000-000000000041",
  stackId: null,
  title: "Tied B",
  description: "",
  stateId: draftStates[0]!.id,
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const existingDraftsForInsertion = [
  olderDraft,
  tiedDraftB,
  newerDraft,
  tiedDraftA,
];

const readDraftListTitles = () => {
  const draftList = screen.getByRole("list");

  return within(draftList).getAllByRole("link").map((link) => {
    const title = link.querySelector(".draft-list__title");
    expect(title).not.toBeNull();
    return title!.textContent;
  });
};

type FetchHandler = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Response | Promise<Response>;

const renderApp = (initialEntry: string): RenderResult =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
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

const defaultDraftHandler = (options?: {
  drafts?: Draft[];
  stacks?: Stack[];
  delayStacks?: boolean;
}): FetchHandler => {
  let resolveDelayedStacks: ((response: Response) => void) | undefined;
  const delayedStacks = options?.delayStacks
    ? new Promise<Response>((resolve) => {
      resolveDelayedStacks = resolve;
    })
    : undefined;

  const handler: FetchHandler = (input, init) => {
    const url = new URL(String(input), "http://stackdraft.local");
    const method = init?.method ?? "GET";

    if (url.pathname === "/api/health") {
      return healthResponse();
    }

    if (url.pathname === "/api/states" && method === "GET") {
      const scope = url.searchParams.get("scope");

      if (scope === "draft") {
        return new Response(JSON.stringify({ states: draftStates }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (scope === "stack") {
        return new Response(JSON.stringify({ states: stackStates }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not found", { status: 404 });
    }

    if (url.pathname === "/api/drafts" && method === "GET") {
      const stackId = url.searchParams.get("stackId");
      const stateId = url.searchParams.get("stateId");
      const drafts = options?.drafts ?? [];
      let filteredDrafts = drafts;

      if (stackId !== null) {
        filteredDrafts = filteredDrafts.filter((draft) =>
          draft.stackId === stackId
        );
      }

      if (stateId !== null) {
        filteredDrafts = filteredDrafts.filter((draft) =>
          draft.stateId === stateId
        );
      }

      return new Response(JSON.stringify({ drafts: filteredDrafts }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.startsWith("/api/drafts/") && method === "PATCH") {
      const draftId = url.pathname.split("/").pop();
      const draft = (options?.drafts ?? []).find((entry) =>
        entry.id === draftId
      );

      if (draft === undefined) {
        return new Response(
          JSON.stringify({
            error: {
              code: "DRAFT_NOT_FOUND",
              message: "The requested Draft does not exist.",
              details: {},
            },
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const body = JSON.parse(String(init?.body)) as {
        title?: string;
        description?: string;
        stateId?: string;
        stackId?: string | null;
      };

      const updatedDraft: Draft = {
        ...draft,
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.stateId !== undefined ? { stateId: body.stateId } : {}),
        ...(body.stackId !== undefined ? { stackId: body.stackId } : {}),
        updatedAt: "2026-01-03T00:00:00.000Z",
      };

      return new Response(JSON.stringify(updatedDraft), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.startsWith("/api/drafts/") && method === "GET") {
      const draftId = url.pathname.split("/").pop();
      const draft = (options?.drafts ?? []).find((entry) =>
        entry.id === draftId
      );

      if (draft === undefined) {
        return new Response(
          JSON.stringify({
            error: {
              code: "DRAFT_NOT_FOUND",
              message: "The requested Draft does not exist.",
              details: {},
            },
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify(draft), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/api/stacks" && method === "GET") {
      if (delayedStacks !== undefined) {
        return delayedStacks;
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

    if (
      url.pathname === `/api/stacks/${secondStack.id}` &&
      method === "GET"
    ) {
      return new Response(JSON.stringify(secondStack), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  };

  return Object.assign(handler, {
    resolveDelayedStacks: () => resolveDelayedStacks,
  });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("draft list screen", () => {
  it("shows a zero-draft empty state with quick-create on the home route", async () => {
    mockFetch(defaultDraftHandler());

    renderApp("/");

    await waitFor(() => {
      expect(
        screen.getByText(
          "Record work in seconds without creating a Stack first.",
        ),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("form", { name: "Capture your first Draft" }),
    ).toBeInTheDocument();
  });

  it("creates a standalone draft from the global home without stack input", async () => {
    const createdDraft: Draft = {
      id: "00000000-0000-4000-8000-000000000039",
      stackId: null,
      title: "Quick capture",
      description: "",
      stateId: draftStates[0]!.id,
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };

    let createBody: unknown;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/drafts" && method === "POST") {
        createBody = JSON.parse(String(init?.body));
        return Promise.resolve(
          new Response(JSON.stringify(createdDraft), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        defaultDraftHandler({ drafts: existingDraftsForInsertion })(
          input,
          init,
        ),
      );
    });

    const user = userEvent.setup();
    renderApp("/");

    await waitFor(() => {
      expect(readDraftListTitles()).toEqual([
        "Older note",
        "Tied B",
        "Newer note",
        "Tied A",
      ]);
    });

    const createForm = await screen.findByRole("form", {
      name: "Capture Draft",
    });
    const titleInput = within(createForm).getByLabelText("Title");

    await user.type(titleInput, "Quick capture");
    await user.click(
      within(createForm).getByRole("button", { name: "Add Draft" }),
    );

    await waitFor(() => {
      expect(readDraftListTitles()).toEqual([
        "Newer note",
        "Quick capture",
        "Tied A",
        "Tied B",
        "Older note",
      ]);

      const input = screen.getByLabelText("Title");
      expect(input).toHaveValue("");
      expect(input).toHaveFocus();
    });

    expect(createBody).toEqual({ title: "Quick capture" });
  });

  it("shows a field error for a whitespace-only quick-create title", async () => {
    let createCount = 0;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/drafts" && method === "POST") {
        createCount += 1;
      }

      return Promise.resolve(defaultDraftHandler()(input, init));
    });

    const user = userEvent.setup();
    renderApp("/");

    const createForm = await screen.findByRole("form", {
      name: "Capture your first Draft",
    });
    const titleInput = within(createForm).getByLabelText("Title");

    await user.type(titleInput, "   ");
    await user.click(
      within(createForm).getByRole("button", { name: "Add Draft" }),
    );

    expect(within(createForm).getByText("Title is required."))
      .toBeInTheDocument();
    expect(titleInput).toHaveAttribute("aria-invalid", "true");
    expect(titleInput).toHaveFocus();
    expect(createCount).toBe(0);
  });

  it("submits on Enter and prevents duplicate submissions", async () => {
    let createCount = 0;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/drafts" && method === "POST") {
        createCount += 1;

        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              new Response(
                JSON.stringify({
                  id: `00000000-0000-4000-8000-00000000009${createCount}`,
                  stackId: null,
                  title: "Entered draft",
                  description: "",
                  stateId: draftStates[0]!.id,
                  createdAt: "2026-01-03T00:00:00.000Z",
                  updatedAt: "2026-01-03T00:00:00.000Z",
                }),
                {
                  status: 201,
                  headers: { "Content-Type": "application/json" },
                },
              ),
            );
          }, 50);
        });
      }

      return Promise.resolve(defaultDraftHandler()(input, init));
    });

    const user = userEvent.setup();
    renderApp("/");

    const createForm = await screen.findByRole("form", {
      name: "Capture your first Draft",
    });
    const titleInput = within(createForm).getByLabelText("Title");
    const submitButton = within(createForm).getByRole("button", {
      name: "Add Draft",
    });

    await user.type(titleInput, "Entered draft{Enter}");
    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    expect(createCount).toBe(1);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Entered draft/ }))
        .toBeInTheDocument();
    });
  });

  it("retains the title when quick-create fails", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/drafts" && method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "UNKNOWN_ERROR",
                message: "Could not create Draft.",
                details: {},
              },
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.resolve(defaultDraftHandler()(input, init));
    });

    const user = userEvent.setup();
    renderApp("/");

    const createForm = await screen.findByRole("form", {
      name: "Capture your first Draft",
    });
    const titleInput = within(createForm).getByLabelText("Title");

    await user.type(titleInput, "Retry me");
    await user.click(
      within(createForm).getByRole("button", { name: "Add Draft" }),
    );

    await waitFor(() => {
      expect(within(createForm).getByRole("alert")).toHaveTextContent(
        "Could not create Draft.",
      );
    });

    expect(titleInput).toHaveValue("Retry me");
  });

  it("renders mixed standalone and stacked drafts with optional stack labels", async () => {
    mockFetch(
      defaultDraftHandler({
        drafts: [standaloneDraft, stackedDraft],
        stacks: [existingStack],
      }),
    );

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("list")).toBeInTheDocument();
    });

    const draftList = screen.getByRole("list");
    const standaloneLink = within(draftList).getByRole("link", {
      name: /Standalone note/,
    });
    expect(within(standaloneLink).getByText("Backlog")).toBeInTheDocument();
    expect(
      within(standaloneLink.closest("li")!).queryByText("Stack"),
    ).not.toBeInTheDocument();

    const stackedLink = within(draftList).getByRole("link", {
      name: /Stack-linked note/,
    });
    expect(within(stackedLink).getByText("Todo")).toBeInTheDocument();
    expect(
      within(draftList).getByRole("link", { name: "Stackdraft" }),
    ).toHaveAttribute("href", `/stacks/${existingStack.id}`);
  });

  it("shows a recoverable stack-label error without clearing loaded drafts", async () => {
    let stackRequests = 0;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/stacks" && method === "GET") {
        stackRequests += 1;

        if (stackRequests === 1) {
          return Promise.resolve(new Response("Server error", { status: 500 }));
        }

        return Promise.resolve(
          new Response(JSON.stringify({ stacks: [existingStack] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [stackedDraft],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Stack-linked note/ }))
        .toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Request failed with status 500",
      );
    });

    expect(
      within(screen.getByRole("list")).queryByRole("link", {
        name: "Stackdraft",
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Retry loading Stack labels" }),
    );

    await waitFor(() => {
      expect(
        within(screen.getByRole("list")).getByRole("link", {
          name: "Stackdraft",
        }),
      ).toHaveAttribute("href", `/stacks/${existingStack.id}`);
    });

    expect(stackRequests).toBe(2);
    expect(screen.getByRole("link", { name: /Stack-linked note/ }))
      .toBeInTheDocument();
  });

  it("shows a recoverable draft-state error without clearing loaded drafts", async () => {
    let stateRequests = 0;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/states" && method === "GET") {
        stateRequests += 1;

        if (stateRequests === 1) {
          return Promise.resolve(new Response("Server error", { status: 500 }));
        }

        return Promise.resolve(
          new Response(JSON.stringify({ states: draftStates }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [standaloneDraft],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Standalone note/ }))
        .toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Request failed with status 500",
      );
    });

    expect(
      within(screen.getByRole("list")).queryByText("Backlog"),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Retry loading Draft States" }),
    );

    await waitFor(() => {
      expect(
        within(screen.getByRole("list")).getByText("Backlog"),
      ).toBeInTheDocument();
    });

    expect(stateRequests).toBe(2);
  });

  it("keeps draft capture available when the draft list fails to load", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/drafts" && method === "GET") {
        return Promise.resolve(new Response("Server error", { status: 500 }));
      }

      return Promise.resolve(defaultDraftHandler()(input, init));
    });

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Request failed with status 500",
      );
    });

    expect(
      screen.getByRole("form", { name: "Capture Draft" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Record work in seconds without creating a Stack first.",
      ),
    ).not.toBeInTheDocument();
  });

  it("keeps the draft list error visible after creating during a list failure", async () => {
    let draftListRequests = 0;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/drafts" && method === "GET") {
        draftListRequests += 1;
        return Promise.resolve(new Response("Server error", { status: 500 }));
      }

      if (url.pathname === "/api/drafts" && method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "00000000-0000-4000-8000-000000000099",
              stackId: null,
              title: "Captured during list failure",
              description: "",
              stateId: draftStates[0]!.id,
              createdAt: "2026-01-03T00:00:00.000Z",
              updatedAt: "2026-01-03T00:00:00.000Z",
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.resolve(defaultDraftHandler()(input, init));
    });

    const user = userEvent.setup();
    renderApp("/");

    const createForm = await screen.findByRole("form", {
      name: "Capture Draft",
    });

    await user.type(
      within(createForm).getByLabelText("Title"),
      "Captured during list failure",
    );
    await user.click(
      within(createForm).getByRole("button", { name: "Add Draft" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Captured during list failure/ }),
      ).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Request failed with status 500",
      );
    });

    expect(draftListRequests).toBeGreaterThanOrEqual(2);
  });

  it("preserves title edits made during a slow submission", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/drafts" && method === "POST") {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              new Response(
                JSON.stringify({
                  id: "00000000-0000-4000-8000-000000000099",
                  stackId: null,
                  title: "First draft",
                  description: "",
                  stateId: draftStates[0]!.id,
                  createdAt: "2026-01-03T00:00:00.000Z",
                  updatedAt: "2026-01-03T00:00:00.000Z",
                }),
                {
                  status: 201,
                  headers: { "Content-Type": "application/json" },
                },
              ),
            );
          }, 50);
        });
      }

      return Promise.resolve(defaultDraftHandler()(input, init));
    });

    const user = userEvent.setup();
    renderApp("/");

    const createForm = await screen.findByRole("form", {
      name: "Capture your first Draft",
    });
    const titleInput = within(createForm).getByLabelText("Title");

    await user.type(titleInput, "First draft");
    await user.click(
      within(createForm).getByRole("button", { name: "Add Draft" }),
    );
    await user.clear(titleInput);
    await user.type(titleInput, "Second draft");

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /First draft/ }))
        .toBeInTheDocument();
    });

    expect(titleInput).toHaveValue("Second draft");
  });

  it("does not block draft capture while stack labels are still loading", async () => {
    const handler = defaultDraftHandler({ delayStacks: true }) as
      & FetchHandler
      & {
        resolveDelayedStacks?: (response: Response) => void;
      };

    let createBody: unknown;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/drafts" && method === "POST") {
        createBody = JSON.parse(String(init?.body));
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "00000000-0000-4000-8000-000000000099",
              stackId: null,
              title: "Before stacks",
              description: "",
              stateId: draftStates[0]!.id,
              createdAt: "2026-01-03T00:00:00.000Z",
              updatedAt: "2026-01-03T00:00:00.000Z",
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.resolve(handler(input, init));
    });

    const user = userEvent.setup();
    renderApp("/");

    const createForm = await screen.findByRole("form", {
      name: "Capture your first Draft",
    });

    await user.type(
      within(createForm).getByLabelText("Title"),
      "Before stacks",
    );
    await user.click(
      within(createForm).getByRole("button", { name: "Add Draft" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Before stacks/ }))
        .toBeInTheDocument();
    });

    expect(createBody).toEqual({ title: "Before stacks" });

    handler.resolveDelayedStacks?.(
      new Response(JSON.stringify({ stacks: [existingStack] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("navigates to draft detail from the global list", async () => {
    mockFetch(
      defaultDraftHandler({
        drafts: [standaloneDraft],
      }),
    );

    const user = userEvent.setup();
    renderApp("/");

    const draftLink = await screen.findByRole("link", {
      name: /Standalone note/,
    });
    await user.click(draftLink);

    await waitFor(() => {
      expect(readLocationPathname()).toBe(`/drafts/${standaloneDraft.id}`);
      expect(
        screen.getByRole("heading", { name: "Standalone note", level: 1 }),
      ).toHaveFocus();
    });

    const editForm = screen.getByRole("form", { name: "Edit Draft" });
    expect(within(editForm).getByLabelText("State")).toHaveValue(
      draftStates[0]!.id,
    );

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Drafts" }))
      .toHaveAttribute("href", "/");
  });
});

describe("stack detail draft capture", () => {
  it("creates a draft assigned to the current stack", async () => {
    let createBody: unknown;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/drafts" && method === "POST") {
        createBody = JSON.parse(String(init?.body));
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "00000000-0000-4000-8000-000000000099",
              stackId: existingStack.id,
              title: "Stack draft",
              description: "",
              stateId: draftStates[0]!.id,
              createdAt: "2026-01-03T00:00:00.000Z",
              updatedAt: "2026-01-03T00:00:00.000Z",
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [stackedDraft, standaloneDraft],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(`/stacks/${existingStack.id}`);

    await screen.findByRole("heading", { name: "Stackdraft", level: 1 });

    const draftsSection = screen.getByRole("region", { name: "Drafts" });

    await waitFor(() => {
      expect(
        within(draftsSection).getByRole("link", { name: /Stack-linked note/ }),
      ).toBeInTheDocument();
    });

    expect(
      within(draftsSection).queryByRole("link", { name: /Standalone note/ }),
    ).not.toBeInTheDocument();

    const createForm = await within(draftsSection).findByRole("form", {
      name: "Capture Draft",
    });

    await user.type(within(createForm).getByLabelText("Title"), "Stack draft");
    await user.click(
      within(createForm).getByRole("button", { name: "Add Draft" }),
    );

    await waitFor(() => {
      expect(readDraftListTitles()).toEqual([
        "Stack draft",
        "Stack-linked note",
      ]);
    });

    expect(createBody).toEqual({
      title: "Stack draft",
      stackId: existingStack.id,
    });
    expect(within(draftsSection).queryByText("Stack")).not.toBeInTheDocument();
    expect(
      within(draftsSection).queryByRole("link", { name: /Standalone note/ }),
    ).not.toBeInTheDocument();
  });

  it("submits on Enter and prevents duplicate submissions", async () => {
    let createCount = 0;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/drafts" && method === "POST") {
        createCount += 1;

        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              new Response(
                JSON.stringify({
                  id: `00000000-0000-4000-8000-00000000009${createCount}`,
                  stackId: existingStack.id,
                  title: "Entered stack draft",
                  description: "",
                  stateId: draftStates[0]!.id,
                  createdAt: "2026-01-03T00:00:00.000Z",
                  updatedAt: "2026-01-03T00:00:00.000Z",
                }),
                {
                  status: 201,
                  headers: { "Content-Type": "application/json" },
                },
              ),
            );
          }, 50);
        });
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [stackedDraft],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(`/stacks/${existingStack.id}`);

    await screen.findByRole("heading", { name: "Stackdraft", level: 1 });

    const draftsSection = screen.getByRole("region", { name: "Drafts" });
    const createForm = await within(draftsSection).findByRole("form", {
      name: "Capture Draft",
    });
    const titleInput = within(createForm).getByLabelText("Title");
    const submitButton = within(createForm).getByRole("button", {
      name: "Add Draft",
    });

    await user.type(titleInput, "Entered stack draft{Enter}");
    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    expect(createCount).toBe(1);

    await waitFor(() => {
      expect(
        within(draftsSection).getByRole("link", {
          name: /Entered stack draft/,
        }),
      ).toBeInTheDocument();
    });
  });

  it("restores focus to the title input after a successful create", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/drafts" && method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "00000000-0000-4000-8000-000000000099",
              stackId: existingStack.id,
              title: "Focused stack draft",
              description: "",
              stateId: draftStates[0]!.id,
              createdAt: "2026-01-03T00:00:00.000Z",
              updatedAt: "2026-01-03T00:00:00.000Z",
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [stackedDraft],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(`/stacks/${existingStack.id}`);

    await screen.findByRole("heading", { name: "Stackdraft", level: 1 });

    const draftsSection = screen.getByRole("region", { name: "Drafts" });
    const createForm = await within(draftsSection).findByRole("form", {
      name: "Capture Draft",
    });
    const titleInput = within(createForm).getByLabelText("Title");

    await user.type(titleInput, "Focused stack draft");
    await user.click(
      within(createForm).getByRole("button", { name: "Add Draft" }),
    );

    await waitFor(() => {
      expect(titleInput).toHaveValue("");
      expect(titleInput).toHaveFocus();
    });
  });

  it("keeps stack capture available when the draft list fails to load", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/drafts" && method === "GET") {
        return Promise.resolve(new Response("Server error", { status: 500 }));
      }

      if (url.pathname === "/api/drafts" && method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "00000000-0000-4000-8000-000000000099",
              stackId: existingStack.id,
              title: "Stack capture during failure",
              description: "",
              stateId: draftStates[0]!.id,
              createdAt: "2026-01-03T00:00:00.000Z",
              updatedAt: "2026-01-03T00:00:00.000Z",
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [stackedDraft],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(`/stacks/${existingStack.id}`);

    await screen.findByRole("heading", { name: "Stackdraft", level: 1 });

    const draftsSection = screen.getByRole("region", { name: "Drafts" });
    const createForm = await within(draftsSection).findByRole("form", {
      name: "Capture Draft",
    });
    expect(
      within(draftsSection).queryByText(
        "Capture the first Draft for this Stack.",
      ),
    ).not.toBeInTheDocument();

    await user.type(
      within(createForm).getByLabelText("Title"),
      "Stack capture during failure",
    );
    await user.click(
      within(createForm).getByRole("button", { name: "Add Draft" }),
    );

    await waitFor(() => {
      expect(
        within(draftsSection).getByRole("link", {
          name: /Stack capture during failure/,
        }),
      ).toBeInTheDocument();
      expect(
        within(draftsSection).getByRole("alert"),
      ).toHaveTextContent("Request failed with status 500");
    });
  });
});

describe("draft detail screen", () => {
  it("loads standalone and stacked drafts with breadcrumbs and edit form", async () => {
    mockFetch(
      defaultDraftHandler({
        drafts: [stackedDraft],
        stacks: [existingStack],
      }),
    );

    renderApp(`/drafts/${stackedDraft.id}`);

    const editForm = await screen.findByRole("form", { name: "Edit Draft" });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Stack-linked note", level: 1 }),
      ).toBeInTheDocument();
      const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
      expect(within(breadcrumb).getByRole("link", { name: "Drafts" }))
        .toHaveAttribute(
          "href",
          "/",
        );
      expect(within(breadcrumb).getByRole("link", { name: "Stackdraft" }))
        .toHaveAttribute(
          "href",
          `/stacks/${existingStack.id}`,
        );
    });

    expect(await within(editForm).findByLabelText("Title")).toHaveValue(
      "Stack-linked note",
    );
    expect(await within(editForm).findByLabelText("State")).toHaveValue(
      draftStates[1]!.id,
    );
    expect(await within(editForm).findByLabelText("Stack")).toHaveValue(
      existingStack.id,
    );
  });

  it("loads a standalone draft without a stack breadcrumb", async () => {
    mockFetch(
      defaultDraftHandler({
        drafts: [standaloneDraft],
      }),
    );

    renderApp(`/drafts/${standaloneDraft.id}`);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Standalone note", level: 1 }),
      ).toBeInTheDocument();
      const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
      expect(within(breadcrumb).getByRole("link", { name: "Drafts" }))
        .toBeInTheDocument();
      expect(within(breadcrumb).queryByRole("link", { name: "Stackdraft" }))
        .not.toBeInTheDocument();
    });

    const editForm = await screen.findByRole("form", { name: "Edit Draft" });
    await waitFor(() => {
      expect(within(editForm).queryByLabelText("Stack")).not
        .toBeInTheDocument();
    });
  });

  it("shows not found when the draft does not exist", async () => {
    mockFetch(defaultDraftHandler());

    renderApp("/drafts/00000000-0000-4000-8000-000000000099");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Draft not found", level: 1 }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Back to Drafts" }),
      ).toHaveAttribute("href", "/");
    });
  });

  it("saves draft edits and updates the detail heading", async () => {
    let updateBody: unknown;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (
        url.pathname === `/api/drafts/${standaloneDraft.id}` &&
        method === "PATCH"
      ) {
        updateBody = JSON.parse(String(init?.body));
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...standaloneDraft,
              title: "Renamed Draft",
              description: "Updated description.",
              stateId: draftStates[1]!.id,
              updatedAt: "2026-01-03T00:00:00.000Z",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [standaloneDraft],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(`/drafts/${standaloneDraft.id}`);

    const editForm = await screen.findByRole("form", { name: "Edit Draft" });

    await user.tripleClick(await within(editForm).findByLabelText("Title"));
    await user.keyboard("Renamed Draft");
    await user.tripleClick(
      await within(editForm).findByLabelText("Description"),
    );
    await user.keyboard("Updated description.");
    await user.selectOptions(
      await within(editForm).findByLabelText("State"),
      draftStates[1]!.id,
    );
    await user.click(
      within(editForm).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Renamed Draft", level: 1 }),
      ).toBeInTheDocument();
    });

    expect(updateBody).toEqual({
      title: "Renamed Draft",
      description: "Updated description.",
      stateId: draftStates[1]!.id,
    });
  });

  it("keeps loaded State and Stack context after a successful edit", async () => {
    const draft = { ...stackedDraft };
    let draftStateRequests = 0;
    let stackCollectionRequests = 0;
    let stackContextRequests = 0;

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (
        url.pathname === "/api/states" &&
        url.searchParams.get("scope") === "draft" &&
        method === "GET"
      ) {
        draftStateRequests += 1;
      }

      if (url.pathname === "/api/stacks" && method === "GET") {
        stackCollectionRequests += 1;
      }

      if (
        url.pathname === `/api/stacks/${existingStack.id}` &&
        method === "GET"
      ) {
        stackContextRequests += 1;
      }

      if (
        url.pathname === `/api/drafts/${draft.id}` &&
        method === "PATCH"
      ) {
        const body = JSON.parse(String(init?.body));
        Object.assign(draft, body, {
          updatedAt: "2026-01-03T00:00:00.000Z",
        });

        return Promise.resolve(
          new Response(JSON.stringify(draft), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [draft],
          stacks: [existingStack],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(`/drafts/${draft.id}`);

    const editForm = await screen.findByRole("form", { name: "Edit Draft" });
    const titleInput = await within(editForm).findByLabelText("Title");

    await within(editForm).findByLabelText("State");
    await within(editForm).findByLabelText("Stack");
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    await within(breadcrumb).findByRole("link", { name: existingStack.title });

    await user.tripleClick(titleInput);
    await user.keyboard("Renamed stacked Draft");
    await user.click(
      within(editForm).getByRole("button", { name: "Save changes" }),
    );

    await screen.findByRole("heading", {
      name: "Renamed stacked Draft",
      level: 1,
    });

    expect(within(editForm).getByLabelText("State")).toBeInTheDocument();
    expect(within(editForm).getByLabelText("Stack")).toBeInTheDocument();
    expect(within(breadcrumb).getByRole("link", { name: existingStack.title }))
      .toBeInTheDocument();
    expect(draftStateRequests).toBe(1);
    expect(stackCollectionRequests).toBe(1);
    expect(stackContextRequests).toBe(1);
  });

  it("assigns, reassigns, and removes stack association from the edit form", async () => {
    const drafts = [standaloneDraft, stackedDraft];
    const updates: unknown[] = [];

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname.startsWith("/api/drafts/") && method === "PATCH") {
        const draftId = url.pathname.split("/").pop();
        const body = JSON.parse(String(init?.body));
        updates.push({ draftId, body });

        const draft = drafts.find((entry) => entry.id === draftId);
        const updatedDraft = {
          ...draft!,
          ...(body.stackId !== undefined ? { stackId: body.stackId } : {}),
          updatedAt: "2026-01-03T00:00:00.000Z",
        };

        if (draftId === standaloneDraft.id) {
          Object.assign(standaloneDraft, updatedDraft);
        }

        if (draftId === stackedDraft.id) {
          Object.assign(stackedDraft, updatedDraft);
        }

        return Promise.resolve(
          new Response(JSON.stringify(updatedDraft), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts,
          stacks: [existingStack, secondStack],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(`/drafts/${standaloneDraft.id}`);

    const editForm = await screen.findByRole("form", { name: "Edit Draft" });
    const stackSelect = await within(editForm).findByLabelText("Stack");

    await user.selectOptions(
      stackSelect,
      existingStack.id,
    );
    await user.click(
      within(editForm).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() => {
      const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
      expect(within(breadcrumb).getByRole("link", { name: "Stackdraft" }))
        .toHaveAttribute(
          "href",
          `/stacks/${existingStack.id}`,
        );
    });

    await user.selectOptions(
      await within(editForm).findByLabelText("Stack"),
      secondStack.id,
    );
    await user.click(
      within(editForm).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() => {
      const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
      expect(within(breadcrumb).getByRole("link", { name: "Side project" }))
        .toHaveAttribute("href", `/stacks/${secondStack.id}`);
    });

    await user.selectOptions(
      await within(editForm).findByLabelText("Stack"),
      "No Stack",
    );
    await user.click(
      within(editForm).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() => {
      const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
      expect(within(breadcrumb).queryByRole("link", { name: "Side project" }))
        .not.toBeInTheDocument();
    });

    expect(updates).toEqual([
      {
        draftId: standaloneDraft.id,
        body: {
          title: standaloneDraft.title,
          description: standaloneDraft.description,
          stackId: existingStack.id,
        },
      },
      {
        draftId: standaloneDraft.id,
        body: {
          title: standaloneDraft.title,
          description: standaloneDraft.description,
          stackId: secondStack.id,
        },
      },
      {
        draftId: standaloneDraft.id,
        body: {
          title: standaloneDraft.title,
          description: standaloneDraft.description,
          stackId: null,
        },
      },
    ]);
  });

  it("remains editable when no stacks exist", async () => {
    let resolveStacks: ((response: Response) => void) | undefined;
    const delayedStacks = new Promise<Response>((resolve) => {
      resolveStacks = resolve;
    });

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/stacks" && method === "GET") {
        return delayedStacks;
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [standaloneDraft],
          stacks: [],
        })(input, init),
      );
    });

    renderApp(`/drafts/${standaloneDraft.id}`);

    const editForm = await screen.findByRole("form", { name: "Edit Draft" });

    expect(await within(editForm).findByLabelText("State")).toBeInTheDocument();
    expect(within(editForm).queryByLabelText("Stack")).not.toBeInTheDocument();

    resolveStacks!(
      new Response(JSON.stringify({ stacks: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await waitFor(() => {
      expect(within(editForm).queryByLabelText("Stack")).not
        .toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Retry loading Stacks" }),
      ).not.toBeInTheDocument();
    });
  });

  it("shows field errors beside the relevant edit input", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (
        url.pathname === `/api/drafts/${standaloneDraft.id}` &&
        method === "PATCH"
      ) {
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

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [standaloneDraft],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(`/drafts/${standaloneDraft.id}`);

    const editForm = await screen.findByRole("form", { name: "Edit Draft" });
    const titleInput = within(editForm).getByLabelText("Title");

    await user.clear(titleInput);
    await user.type(titleInput, " ");
    await user.click(
      within(editForm).getByRole("button", { name: "Save changes" }),
    );

    expect(
      within(editForm).getByText("Title is required."),
    ).toBeInTheDocument();
  });

  it("keeps draft detail visible when stack loading fails", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (
        url.pathname === `/api/stacks/${existingStack.id}` &&
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

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [stackedDraft],
          stacks: [existingStack],
        })(input, init),
      );
    });

    renderApp(`/drafts/${stackedDraft.id}`);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Stack-linked note", level: 1 }),
      ).toBeInTheDocument();
      expect(screen.getByRole("form", { name: "Edit Draft" }))
        .toBeInTheDocument();
      expect(screen.getByText("The requested Stack does not exist."))
        .toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Retry loading Stack context" }),
      ).toBeInTheDocument();
    });
  });

  it("keeps draft detail visible when draft state loading fails", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/states" && method === "GET") {
        const scope = url.searchParams.get("scope");

        if (scope === "draft") {
          return Promise.resolve(new Response("Server error", { status: 500 }));
        }
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [standaloneDraft],
        })(input, init),
      );
    });

    renderApp(`/drafts/${standaloneDraft.id}`);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Standalone note", level: 1 }),
      ).toBeInTheDocument();
      expect(screen.getByRole("form", { name: "Edit Draft" }))
        .toBeInTheDocument();
      expect(screen.getByText("Request failed with status 500"))
        .toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Retry loading Draft States" }),
      ).toBeInTheDocument();
    });
  });

  it("persists edits on the home list after navigating back", async () => {
    const updatedDraft: Draft = {
      ...standaloneDraft,
      title: "Updated Draft",
      description: "Updated from detail.",
      stateId: draftStates[1]!.id,
      updatedAt: "2026-01-03T00:00:00.000Z",
    };

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (
        url.pathname === `/api/drafts/${standaloneDraft.id}` &&
        method === "PATCH"
      ) {
        return Promise.resolve(
          new Response(JSON.stringify(updatedDraft), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (
        url.pathname === `/api/drafts/${standaloneDraft.id}` &&
        method === "GET"
      ) {
        return Promise.resolve(
          new Response(JSON.stringify(updatedDraft), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [updatedDraft],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(`/drafts/${standaloneDraft.id}`);

    const editForm = await screen.findByRole("form", { name: "Edit Draft" });

    await user.clear(await within(editForm).findByLabelText("Title"));
    await user.type(
      await within(editForm).findByLabelText("Title"),
      "Updated Draft",
    );
    await user.clear(await within(editForm).findByLabelText("Description"));
    await user.type(
      await within(editForm).findByLabelText("Description"),
      "Updated from detail.",
    );
    await user.selectOptions(
      await within(editForm).findByLabelText("State"),
      draftStates[1]!.id,
    );
    await user.click(
      within(editForm).getByRole("button", { name: "Save changes" }),
    );

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    await user.click(within(breadcrumb).getByRole("link", { name: "Drafts" }));

    await waitFor(() => {
      const draftList = screen.getByRole("list");
      const updatedLink = within(draftList).getByRole("link", {
        name: /Updated Draft/,
      });
      expect(within(updatedLink).getByText("Todo")).toBeInTheDocument();
    });
  });

  it("propagates stack assignment changes to the old and new stack screens", async () => {
    const drafts = [
      {
        ...standaloneDraft,
        title: "Movable draft",
      },
    ];
    const stackDraftsByStackId = new Map<string, Draft[]>([
      [existingStack.id, []],
      [secondStack.id, []],
    ]);

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname.startsWith("/api/drafts/") && method === "PATCH") {
        const draftId = url.pathname.split("/").pop();
        const body = JSON.parse(String(init?.body));
        const draft = drafts.find((entry) => entry.id === draftId)!;
        const updatedDraft = {
          ...draft,
          ...(body.stackId !== undefined ? { stackId: body.stackId } : {}),
          updatedAt: "2026-01-03T00:00:00.000Z",
        };

        Object.assign(draft, updatedDraft);

        for (const [stackId, entries] of stackDraftsByStackId) {
          stackDraftsByStackId.set(
            stackId,
            entries.filter((entry) => entry.id !== draft.id),
          );
        }

        if (updatedDraft.stackId !== null) {
          const entries = stackDraftsByStackId.get(updatedDraft.stackId) ?? [];
          stackDraftsByStackId.set(
            updatedDraft.stackId,
            insertDraftInOrder(entries, updatedDraft),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify(updatedDraft), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (url.pathname === "/api/drafts" && method === "GET") {
        const stackId = url.searchParams.get("stackId");
        const stateId = url.searchParams.get("stateId");
        let filteredDrafts = [...drafts];

        if (stackId !== null) {
          filteredDrafts = stackDraftsByStackId.get(stackId) ?? [];
        }

        if (stateId !== null) {
          filteredDrafts = filteredDrafts.filter((draft) =>
            draft.stateId === stateId
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ drafts: filteredDrafts }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts,
          stacks: [existingStack, secondStack],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(`/drafts/${drafts[0]!.id}`);

    const editForm = await screen.findByRole("form", { name: "Edit Draft" });

    await user.selectOptions(
      await within(editForm).findByLabelText("Stack"),
      existingStack.id,
    );
    await user.click(
      within(editForm).getByRole("button", { name: "Save changes" }),
    );

    await user.click(
      await within(
        screen.getByRole("navigation", { name: "Breadcrumb" }),
      ).findByRole("link", { name: "Stackdraft" }),
    );

    await waitFor(() => {
      const draftsSection = screen.getByRole("region", { name: "Drafts" });
      expect(
        within(draftsSection).getByRole("link", { name: /Movable draft/ }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("link", { name: "Drafts" }));

    await waitFor(() => {
      expect(screen.getByRole("list")).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("link", { name: /Movable draft/ }),
    );

    const detailForm = await screen.findByRole("form", { name: "Edit Draft" });

    await user.selectOptions(
      await within(detailForm).findByLabelText("Stack"),
      secondStack.id,
    );
    await user.click(
      within(detailForm).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() => {
      const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
      expect(within(breadcrumb).getByRole("link", { name: "Side project" }))
        .toHaveAttribute("href", `/stacks/${secondStack.id}`);
    });

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    await user.click(
      within(breadcrumb).getByRole("link", { name: "Side project" }),
    );

    await waitFor(() => {
      const draftsSection = screen.getByRole("region", { name: "Drafts" });
      expect(
        within(draftsSection).getByRole("link", { name: /Movable draft/ }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("link", { name: /Movable draft/ }));

    const finalForm = await screen.findByRole("form", { name: "Edit Draft" });

    await user.selectOptions(
      await within(finalForm).findByLabelText("Stack"),
      "No Stack",
    );
    await user.click(
      within(finalForm).getByRole("button", { name: "Save changes" }),
    );

    await user.click(
      within(
        screen.getByRole("navigation", { name: "Breadcrumb" }),
      ).getByRole("link", { name: "Drafts" }),
    );

    await user.click(screen.getByRole("link", { name: "Stacks" }));

    const stackList = await screen.findByRole("list");
    await user.click(
      within(stackList).getByRole("link", { name: /Stackdraft/ }),
    );

    await waitFor(() => {
      const draftsSection = screen.getByRole("region", { name: "Drafts" });
      expect(
        within(draftsSection).queryByRole("link", { name: /Movable draft/ }),
      ).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("link", { name: "Stacks" }));

    const stackListAfterMove = await screen.findByRole("list");
    await user.click(
      within(stackListAfterMove).getByRole("link", { name: /Side project/ }),
    );

    await waitFor(() => {
      const draftsSection = screen.getByRole("region", { name: "Drafts" });
      expect(
        within(draftsSection).queryByRole("link", { name: /Movable draft/ }),
      ).not.toBeInTheDocument();
    });
  });

  it("keeps stack assignment editable when the stack collection fails to load", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/stacks" && method === "GET") {
        return Promise.resolve(new Response("Server error", { status: 500 }));
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [standaloneDraft],
        })(input, init),
      );
    });

    renderApp(`/drafts/${standaloneDraft.id}`);

    const editForm = await screen.findByRole("form", { name: "Edit Draft" });

    await waitFor(() => {
      expect(screen.getByText("Request failed with status 500"))
        .toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Retry loading Stacks" }),
      ).toBeInTheDocument();
      expect(within(editForm).queryByLabelText("Stack")).not
        .toBeInTheDocument();
    });

    expect(await within(editForm).findByLabelText("Title")).toBeInTheDocument();
  });

  it("shows a recoverable form error when draft save fails", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (
        url.pathname === `/api/drafts/${standaloneDraft.id}` &&
        method === "PATCH"
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "UNKNOWN_ERROR",
                message: "Could not save Draft changes.",
                details: {},
              },
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [standaloneDraft],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(`/drafts/${standaloneDraft.id}`);

    const editForm = await screen.findByRole("form", { name: "Edit Draft" });

    await user.type(
      await within(editForm).findByLabelText("Description"),
      "Save failure test",
    );
    await user.click(
      within(editForm).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() => {
      expect(within(editForm).getByRole("alert")).toHaveTextContent(
        "Could not save Draft changes.",
      );
    });

    expect(
      screen.getByRole("heading", { name: "Standalone note", level: 1 }),
    ).toBeInTheDocument();
  });
});

describe("draft state filter", () => {
  it("filters drafts by state from the URL on the home route", async () => {
    mockFetch(
      defaultDraftHandler({
        drafts: [standaloneDraft, stackedDraft],
        stacks: [existingStack],
      }),
    );

    renderApp(`/?draftStateId=${draftStates[1]!.id}`);

    await waitFor(() => {
      expect(readLocationSearch()).toBe(
        `?draftStateId=${draftStates[1]!.id}`,
      );

      const draftList = screen.getByRole("list");
      expect(
        within(draftList).getByRole("link", { name: /Stack-linked note/ }),
      ).toBeInTheDocument();
      expect(
        within(draftList).queryByRole("link", { name: /Standalone note/ }),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByRole("radio", { name: "Todo" })).toBeChecked();
  });

  it("updates the URL when the draft state filter changes", async () => {
    mockFetch(
      defaultDraftHandler({
        drafts: [standaloneDraft, stackedDraft],
        stacks: [existingStack],
      }),
    );

    const user = userEvent.setup();
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("list")).toBeInTheDocument();
      expect(readLocationSearch()).toBe("");
    });

    await user.click(screen.getByRole("radio", { name: "Todo" }));

    await waitFor(() => {
      expect(readLocationSearch()).toBe(
        `?draftStateId=${draftStates[1]!.id}`,
      );

      const draftList = screen.getByRole("list");
      expect(
        within(draftList).getByRole("link", { name: /Stack-linked note/ }),
      ).toBeInTheDocument();
      expect(
        within(draftList).queryByRole("link", { name: /Standalone note/ }),
      ).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: "All" }));

    await waitFor(() => {
      expect(readLocationSearch()).toBe("");

      const draftList = screen.getByRole("list");
      expect(
        within(draftList).getByRole("link", { name: /Standalone note/ }),
      ).toBeInTheDocument();
      expect(
        within(draftList).getByRole("link", { name: /Stack-linked note/ }),
      ).toBeInTheDocument();
    });
  });

  it("clears a stale draft state filter from the URL and shows all drafts", async () => {
    mockFetch(
      defaultDraftHandler({
        drafts: [standaloneDraft, stackedDraft],
        stacks: [existingStack],
      }),
    );

    renderApp("/?draftStateId=00000000-0000-4000-8000-000000009999");

    await waitFor(() => {
      expect(readLocationSearch()).toBe("");

      const draftList = screen.getByRole("list");
      expect(
        within(draftList).getByRole("link", { name: /Standalone note/ }),
      ).toBeInTheDocument();
      expect(
        within(draftList).getByRole("link", { name: /Stack-linked note/ }),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("radio", { name: "All" })).toBeChecked();
  });

  it("does not add a default-state draft to a filtered global list after quick-create", async () => {
    const createdDraft: Draft = {
      id: "00000000-0000-4000-8000-000000000039",
      stackId: null,
      title: "Filtered create",
      description: "",
      stateId: draftStates[0]!.id,
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    };

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/drafts" && method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify(createdDraft), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [standaloneDraft, stackedDraft],
          stacks: [existingStack],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(`/?draftStateId=${draftStates[1]!.id}`);

    await waitFor(() => {
      const draftList = screen.getByRole("list");
      expect(
        within(draftList).getByRole("link", { name: /Stack-linked note/ }),
      ).toBeInTheDocument();
      expect(
        within(draftList).queryByRole("link", { name: /Standalone note/ }),
      ).not.toBeInTheDocument();
    });

    const createForm = screen.getByRole("form", { name: "Capture Draft" });
    const titleInput = within(createForm).getByLabelText("Title");

    await user.type(titleInput, "Filtered create");
    await user.click(
      within(createForm).getByRole("button", { name: "Add Draft" }),
    );

    await waitFor(() => {
      expect(titleInput).toHaveValue("");
    });

    const draftList = screen.getByRole("list");
    expect(
      within(draftList).getByRole("link", { name: /Stack-linked note/ }),
    ).toBeInTheDocument();
    expect(
      within(draftList).queryByRole("link", { name: /Filtered create/ }),
    ).not.toBeInTheDocument();
  });

  it("does not add a default-state draft to a filtered stack list after capture", async () => {
    const backlogStackDraft: Draft = {
      ...stackedDraft,
      id: "00000000-0000-4000-8000-000000000022",
      title: "Backlog stack draft",
      stateId: draftStates[0]!.id,
    };
    const createdDraft: Draft = {
      id: "00000000-0000-4000-8000-000000000039",
      stackId: existingStack.id,
      title: "Stack filtered create",
      description: "",
      stateId: draftStates[0]!.id,
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    };

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/drafts" && method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify(createdDraft), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [stackedDraft, backlogStackDraft],
          stacks: [existingStack],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(
      `/stacks/${existingStack.id}?draftStateId=${draftStates[1]!.id}`,
    );

    await screen.findByRole("heading", { name: "Stackdraft", level: 1 });

    const draftsSection = screen.getByRole("region", { name: "Drafts" });

    await waitFor(() => {
      const draftList = within(draftsSection).getByRole("list");
      expect(
        within(draftList).getByRole("link", { name: /Stack-linked note/ }),
      ).toBeInTheDocument();
      expect(
        within(draftList).queryByRole("link", { name: /Backlog stack draft/ }),
      ).not.toBeInTheDocument();
    });

    const createForm = within(draftsSection).getByRole("form", {
      name: "Capture Draft",
    });
    const titleInput = within(createForm).getByLabelText("Title");

    await user.type(titleInput, "Stack filtered create");
    await user.click(
      within(createForm).getByRole("button", { name: "Add Draft" }),
    );

    await waitFor(() => {
      expect(titleInput).toHaveValue("");
    });

    const draftList = within(draftsSection).getByRole("list");
    expect(
      within(draftList).getByRole("link", { name: /Stack-linked note/ }),
    ).toBeInTheDocument();
    expect(
      within(draftList).queryByRole("link", { name: /Stack filtered create/ }),
    ).not.toBeInTheDocument();
  });

  it("adds a matching-state draft to a filtered global list after quick-create", async () => {
    const createdDraft: Draft = {
      id: "00000000-0000-4000-8000-000000000039",
      stackId: null,
      title: "Matching filtered create",
      description: "",
      stateId: draftStates[1]!.id,
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    };

    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/drafts" && method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify(createdDraft), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [stackedDraft],
          stacks: [existingStack],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(`/?draftStateId=${draftStates[1]!.id}`);

    const createForm = await screen.findByRole("form", {
      name: "Capture Draft",
    });

    await user.type(
      within(createForm).getByLabelText("Title"),
      "Matching filtered create",
    );
    await user.click(
      within(createForm).getByRole("button", { name: "Add Draft" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Matching filtered create/ }),
      ).toBeInTheDocument();
    });
  });

  it("filters stack detail drafts by state from the URL", async () => {
    mockFetch(
      defaultDraftHandler({
        drafts: [
          stackedDraft,
          {
            ...stackedDraft,
            id: "00000000-0000-4000-8000-000000000022",
            title: "Backlog stack draft",
            stateId: draftStates[0]!.id,
          },
        ],
        stacks: [existingStack],
      }),
    );

    renderApp(
      `/stacks/${existingStack.id}?draftStateId=${draftStates[1]!.id}`,
    );

    await waitFor(() => {
      expect(readLocationSearch()).toBe(
        `?draftStateId=${draftStates[1]!.id}`,
      );

      const draftsSection = screen.getByRole("region", { name: "Drafts" });
      const draftList = within(draftsSection).getByRole("list");
      expect(
        within(draftList).getByRole("link", { name: /Stack-linked note/ }),
      ).toBeInTheDocument();
      expect(
        within(draftList).queryByRole("link", { name: /Backlog stack draft/ }),
      ).not.toBeInTheDocument();
    });
  });

  it("clears an active home filter when draft states fail to load", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/states" && method === "GET") {
        const scope = url.searchParams.get("scope");

        if (scope === "draft") {
          return Promise.resolve(new Response("Server error", { status: 500 }));
        }
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [standaloneDraft, stackedDraft],
          stacks: [existingStack],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(`/?draftStateId=${draftStates[1]!.id}`);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Show all Drafts" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Request failed with status 500",
      );
    });

    await user.click(screen.getByRole("button", { name: "Show all Drafts" }));

    await waitFor(() => {
      expect(readLocationSearch()).toBe("");

      const draftList = screen.getByRole("list");
      expect(
        within(draftList).getByRole("link", { name: /Standalone note/ }),
      ).toBeInTheDocument();
      expect(
        within(draftList).getByRole("link", { name: /Stack-linked note/ }),
      ).toBeInTheDocument();
    });
  });

  it("updates, clears, and recovers stale filters on stack detail drafts", async () => {
    const backlogStackDraft: Draft = {
      ...stackedDraft,
      id: "00000000-0000-4000-8000-000000000022",
      title: "Backlog stack draft",
      stateId: draftStates[0]!.id,
    };

    mockFetch(
      defaultDraftHandler({
        drafts: [stackedDraft, backlogStackDraft],
        stacks: [existingStack],
      }),
    );

    const user = userEvent.setup();
    renderApp(`/stacks/${existingStack.id}`);

    await waitFor(() => {
      const draftsSection = screen.getByRole("region", { name: "Drafts" });
      expect(within(draftsSection).getByRole("list")).toBeInTheDocument();
      expect(readLocationSearch()).toBe("");
    });

    const draftsSection = screen.getByRole("region", { name: "Drafts" });

    await user.click(
      within(draftsSection).getByRole("radio", { name: "Todo" }),
    );

    await waitFor(() => {
      expect(readLocationSearch()).toBe(
        `?draftStateId=${draftStates[1]!.id}`,
      );

      const draftList = within(draftsSection).getByRole("list");
      expect(
        within(draftList).getByRole("link", { name: /Stack-linked note/ }),
      ).toBeInTheDocument();
      expect(
        within(draftList).queryByRole("link", { name: /Backlog stack draft/ }),
      ).not.toBeInTheDocument();
    });

    await user.click(within(draftsSection).getByRole("radio", { name: "All" }));

    await waitFor(() => {
      expect(readLocationSearch()).toBe("");

      const draftList = within(draftsSection).getByRole("list");
      expect(
        within(draftList).getByRole("link", { name: /Stack-linked note/ }),
      ).toBeInTheDocument();
      expect(
        within(draftList).getByRole("link", { name: /Backlog stack draft/ }),
      ).toBeInTheDocument();
    });
  });

  it("clears a stale stack-detail draft filter from the URL", async () => {
    mockFetch(
      defaultDraftHandler({
        drafts: [stackedDraft],
        stacks: [existingStack],
      }),
    );

    renderApp(
      `/stacks/${existingStack.id}?draftStateId=00000000-0000-4000-8000-000000009999`,
    );

    await waitFor(() => {
      expect(readLocationSearch()).toBe("");

      const draftsSection = screen.getByRole("region", { name: "Drafts" });
      const draftList = within(draftsSection).getByRole("list");
      expect(
        within(draftList).getByRole("link", { name: /Stack-linked note/ }),
      ).toBeInTheDocument();
    });

    expect(
      within(screen.getByRole("region", { name: "Drafts" })).getByRole(
        "radio",
        { name: "All" },
      ),
    ).toBeChecked();
  });

  it("clears an active stack-detail filter when draft states fail to load", async () => {
    mockFetch((input, init) => {
      const url = new URL(String(input), "http://stackdraft.local");
      const method = init?.method ?? "GET";

      if (url.pathname === "/api/states" && method === "GET") {
        const scope = url.searchParams.get("scope");

        if (scope === "draft") {
          return Promise.resolve(new Response("Server error", { status: 500 }));
        }
      }

      return Promise.resolve(
        defaultDraftHandler({
          drafts: [stackedDraft],
          stacks: [existingStack],
        })(input, init),
      );
    });

    const user = userEvent.setup();
    renderApp(
      `/stacks/${existingStack.id}?draftStateId=${draftStates[1]!.id}`,
    );

    await waitFor(() => {
      const draftsSection = screen.getByRole("region", { name: "Drafts" });
      expect(
        within(draftsSection).getByRole("button", { name: "Show all Drafts" }),
      ).toBeInTheDocument();
    });

    await user.click(
      within(screen.getByRole("region", { name: "Drafts" })).getByRole(
        "button",
        { name: "Show all Drafts" },
      ),
    );

    await waitFor(() => {
      expect(readLocationSearch()).toBe("");
    });
  });
});
