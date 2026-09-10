import { assertEquals, assertRejects } from "@std/assert";
import { Octokit } from "@octokit/rest";
import { type Client, create, hasExpired, revoke } from "./main.ts";

type RequestLog = {
  route: string;
  parameters?: Record<string, unknown>;
};

/** This class records requests and returns canned responses. */
class FakeClient implements Client {
  readonly requests: RequestLog[] = [];

  constructor(private readonly responses: Record<string, unknown> = {}) {}

  request(
    route: string,
    parameters?: Record<string, unknown>,
  ): Promise<{ data: unknown }> {
    this.requests.push({ route, parameters });
    return Promise.resolve({ data: this.responses[route] });
  }
}

Deno.test("hasExpired", () => {
  assertEquals(hasExpired("2000-01-01T00:00:00Z"), true);
  assertEquals(hasExpired(new Date(Date.now() + 60_000).toISOString()), false);
});

Deno.test("create generates an installation access token", async () => {
  const octokit = new FakeClient({
    "GET /users/{username}/installation": { id: 12345 },
    "POST /app/installations/{installation_id}/access_tokens": {
      token: "ghs_test",
      expires_at: "2100-01-01T00:00:00Z",
    },
  });

  const token = await create({
    octokit,
    owner: "suzuki-shunsuke",
    repositories: ["tfcmt"],
    permissions: {
      issues: "write",
    },
  });

  assertEquals(token, {
    token: "ghs_test",
    expiresAt: "2100-01-01T00:00:00Z",
    installationId: 12345,
  });
  assertEquals(octokit.requests, [
    {
      route: "GET /users/{username}/installation",
      parameters: { username: "suzuki-shunsuke" },
    },
    {
      route: "POST /app/installations/{installation_id}/access_tokens",
      parameters: {
        installation_id: 12345,
        permissions: { issues: "write" },
        repositories: ["tfcmt"],
      },
    },
  ]);
});

Deno.test("create omits permissions and repositories if they aren't set", async () => {
  const octokit = new FakeClient({
    "GET /users/{username}/installation": { id: 12345 },
    "POST /app/installations/{installation_id}/access_tokens": {
      token: "ghs_test",
      expires_at: "2100-01-01T00:00:00Z",
    },
  });

  await create({ octokit, owner: "suzuki-shunsuke" });

  assertEquals(octokit.requests[1].parameters, {
    installation_id: 12345,
    permissions: undefined,
    repositories: undefined,
  });
});

/** This function creates a fake fetch which records requests. */
const fakeFetch = (
  requests: Request[],
  response: Response,
): typeof globalThis.fetch =>
  ((url: string | URL | Request, init?: RequestInit) => {
    requests.push(new Request(String(url), init));
    return Promise.resolve(response);
  }) as typeof globalThis.fetch;

Deno.test("revoke revokes the installation access token", async () => {
  const requests: Request[] = [];

  await revoke("ghs_test", {
    fetch: fakeFetch(requests, new Response(null, { status: 204 })),
  });

  assertEquals(requests.length, 1);
  assertEquals(requests[0].url, "https://api.github.com/installation/token");
  assertEquals(requests[0].method, "DELETE");
  assertEquals(requests[0].headers.get("authorization"), "Bearer ghs_test");
});

Deno.test("revoke honours a GitHub Enterprise Server base URL", async () => {
  const requests: Request[] = [];

  await revoke("ghs_test", {
    baseUrl: "https://github.example.com/api/v3/",
    fetch: fakeFetch(requests, new Response(null, { status: 204 })),
  });

  assertEquals(
    requests[0].url,
    "https://github.example.com/api/v3/installation/token",
  );
});

Deno.test("revoke fails if GitHub rejects the request", async () => {
  await assertRejects(
    () =>
      revoke("ghs_test", {
        fetch: fakeFetch(
          [],
          new Response(null, { status: 401, statusText: "Unauthorized" }),
        ),
      }),
    Error,
    "failed to revoke the installation access token: 401",
  );
});

Deno.test("real Octokit clients satisfy the Client type", () => {
  // This module declares Client structurally so that it has no runtime
  // dependency. These assignments are the guarantee that real clients fit.
  const rest: Client = new Octokit();

  assertEquals(typeof rest.request, "function");
});
