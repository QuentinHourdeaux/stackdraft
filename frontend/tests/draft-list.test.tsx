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
import type { Stack } from "../src/api/stacks.ts";
import type { State } from "../src/api/states.ts";

function LocationProbe() {
  const location = useLocation();

  return (
    <div
      data-testid="location-probe"
      data-pathname={location.pathname}
      hidden
    />
  );
}

const readLocationPathname = () =>
  screen.getByTestId("location-probe").getAttribute("data-pathname") ?? "";

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
      const drafts = options?.drafts ?? [];
      const filteredDrafts = stackId === null
        ? drafts
        : drafts.filter((draft) => draft.stackId === stackId);

      return new Response(JSON.stringify({ drafts: filteredDrafts }), {
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

  it("navigates to read-only draft detail from the global list", async () => {
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

    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Drafts" }),
    ).toHaveAttribute("href", "/");
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
});

describe("draft detail screen", () => {
  it("shows stack context on read-only detail for a stacked draft", async () => {
    mockFetch(
      defaultDraftHandler({
        drafts: [stackedDraft],
        stacks: [existingStack],
      }),
    );

    renderApp(`/drafts/${stackedDraft.id}`);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Stack-linked note", level: 1 }),
      ).toBeInTheDocument();
      expect(screen.getByText("Todo")).toBeInTheDocument();
    });

    const stackLink = document.querySelector(".draft-detail__stack-link");
    expect(stackLink).not.toBeNull();
    expect(stackLink).toHaveAttribute("href", `/stacks/${existingStack.id}`);
    expect(stackLink).toHaveTextContent("Stackdraft");
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
      expect(screen.getByText("Todo")).toBeInTheDocument();
      expect(document.querySelector(".draft-detail__stack-link"))
        .not.toBeInTheDocument();
    });
  });
});
