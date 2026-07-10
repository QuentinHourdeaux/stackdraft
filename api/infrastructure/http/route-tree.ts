export interface RegisteredRoute {
  readonly methods: readonly string[];
  readonly path: string;
}

interface RouteTreeNode {
  readonly children: Map<string, RouteTreeNode>;
  readonly methods: string[];
}

const createNode = (): RouteTreeNode => ({
  children: new Map(),
  methods: [],
});

const declaredMethods = ({ methods }: RegisteredRoute): readonly string[] =>
  // Oak automatically adds HEAD to every GET route. Suppressing it keeps the
  // tree focused on routes declared by application code; explicit HEAD-only
  // routes remain visible.
  methods.includes("GET")
    ? methods.filter((method) => method !== "HEAD")
    : methods;

const renderNode = (
  node: RouteTreeNode,
  prefix: string,
  lines: string[],
): void => {
  const entries: Array<
    | { readonly kind: "method"; readonly label: string }
    | {
      readonly kind: "path";
      readonly label: string;
      readonly node: RouteTreeNode;
    }
  > = [
    ...node.methods.map((label) => ({ kind: "method" as const, label })),
    ...[...node.children.entries()].map(([segment, child]) => ({
      kind: "path" as const,
      label: `/${segment}`,
      node: child,
    })),
  ];

  entries.forEach((entry, index) => {
    const isLast = index === entries.length - 1;
    lines.push(`${prefix}${isLast ? "└──" : "├──"} ${entry.label}`);

    if (entry.kind === "path") {
      renderNode(entry.node, `${prefix}${isLast ? "    " : "│   "}`, lines);
    }
  });
};

/**
 * Formats the API routes actually registered with Oak as a compact tree for
 * local developer startup output. Non-API middleware and routes are omitted.
 */
export const formatApiRouteTree = (
  routes: Iterable<RegisteredRoute>,
): string => {
  const root = createNode();
  let routeCount = 0;

  for (const route of routes) {
    if (route.path !== "/api" && !route.path.startsWith("/api/")) {
      continue;
    }

    const methods = declaredMethods(route);
    if (methods.length === 0) {
      continue;
    }

    let node = root;
    // `/api` is common to every API route, so the visible hierarchy starts at
    // the first meaningful group such as health, states, or drafts.
    const relativePath = route.path.slice("/api".length);
    for (const segment of relativePath.split("/").filter(Boolean)) {
      let child = node.children.get(segment);
      if (child === undefined) {
        child = createNode();
        node.children.set(segment, child);
      }
      node = child;
    }

    node.methods.push(...methods);
    routeCount += methods.length;
  }

  const apiCount = root.children.size;
  const lines = [
    `${routeCount} ${
      routeCount === 1 ? "route" : "routes"
    } registered across ${apiCount} ${apiCount === 1 ? "API" : "APIs"}`,
  ];
  renderNode(root, "", lines);
  return lines.join("\n");
};
