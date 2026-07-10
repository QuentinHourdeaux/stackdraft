import { assertMatch } from "@std/assert";
import { DEFAULT_DEV_DATABASE_PATH } from "../api/config.ts";

function readTask(name: string): string {
  const denoJson = JSON.parse(Deno.readTextFileSync("deno.json"));
  return denoJson.tasks[name] as string;
}

function assertTaskUsesDevDatabase(taskName: string): void {
  const task = readTask(taskName);

  assertMatch(
    task,
    new RegExp(
      `STACKDRAFT_DATABASE_PATH=${
        DEFAULT_DEV_DATABASE_PATH.replaceAll(
          ".",
          "\\.",
        )
      }`,
    ),
  );
}

Deno.test("dev:api task uses the development database path", () => {
  const task = readTask("dev:api");

  assertTaskUsesDevDatabase("dev:api");
  assertMatch(task, /STACKDRAFT_PRINT_ROUTES=true/);
  assertMatch(task, /api\/main\.ts/);
});

Deno.test("compose bind-mounts production-style data to /data", async () => {
  const compose = await Deno.readTextFile("compose.yaml");

  assertMatch(compose, /\.\/data\/prod:\/data/);
  assertMatch(compose, /STACKDRAFT_DATABASE_PATH: \/data\/stackdraft\.sqlite/);
});

Deno.test(".env.example documents the development database path", async () => {
  const envExample = await Deno.readTextFile(".env.example");

  assertMatch(
    envExample,
    new RegExp(
      `STACKDRAFT_DATABASE_PATH=${
        DEFAULT_DEV_DATABASE_PATH.replaceAll(
          ".",
          "\\.",
        )
      }`,
    ),
  );
});
