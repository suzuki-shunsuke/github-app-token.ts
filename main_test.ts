import { assertEquals } from "@std/assert";
import {
  create,
  type CreateJwt,
  hasExpired,
  type Inputs,
  revoke,
} from "./main.ts";

type RequestLog = {
  url: string;
  method: string;
  authorization: string | null;
  body: string | null;
};

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });

/** This function replaces globalThis.fetch with a fake one and records requests. */
const withFakeFetch = async (
  handler: (url: string) => Response,
  fn: (requests: RequestLog[]) => Promise<void>,
): Promise<void> => {
  const requests: RequestLog[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((url: string | URL | Request, init: RequestInit = {}) => {
    const u = String(url);
    requests.push({
      url: u,
      method: init.method ?? "GET",
      authorization: new Headers(init.headers).get("authorization"),
      body: typeof init.body === "string" ? init.body : null,
    });
    return Promise.resolve(handler(u));
  }) as typeof fetch;
  try {
    await fn(requests);
  } finally {
    globalThis.fetch = original;
  }
};

Deno.test("hasExpired", () => {
  assertEquals(hasExpired("2000-01-01T00:00:00Z"), true);
  assertEquals(hasExpired(new Date(Date.now() + 60_000).toISOString()), false);
});

Deno.test("create authenticates with the JWT returned by createJwt", async () => {
  const appIds: (string | number)[] = [];
  const createJwt: CreateJwt = (appId) => {
    appIds.push(appId);
    return Promise.resolve({
      jwt: "fake-jwt",
      expiresAt: "2100-01-01T00:00:00Z",
    });
  };

  await withFakeFetch((url) => {
    switch (url) {
      case "https://api.github.com/users/suzuki-shunsuke/installation":
        return jsonResponse({ id: 12345 });
      case "https://api.github.com/app/installations/12345/access_tokens":
        return jsonResponse({
          token: "ghs_test",
          expires_at: "2100-01-01T00:00:00Z",
        });
      default:
        throw new Error(`unexpected request: ${url}`);
    }
  }, async (requests) => {
    const token = await create({
      appId: "123456",
      owner: "suzuki-shunsuke",
      repositories: ["tfcmt"],
      permissions: {
        issues: "write",
      },
      createJwt,
    });

    assertEquals(token, {
      token: "ghs_test",
      expiresAt: "2100-01-01T00:00:00Z",
      installationId: 12345,
    });
    assertEquals(appIds[0], "123456");
    assertEquals(requests.length, 2);
    assertEquals(
      requests.map((request) => request.authorization),
      ["bearer fake-jwt", "bearer fake-jwt"],
    );
    assertEquals(JSON.parse(requests[1].body ?? "{}"), {
      permissions: {
        issues: "write",
      },
      repositories: ["tfcmt"],
    });
  });
});

Deno.test("revoke revokes the installation access token", async () => {
  await withFakeFetch(() => new Response(null, { status: 204 }), (requests) => {
    return revoke("ghs_test").then(() => {
      assertEquals(requests, [{
        url: "https://api.github.com/installation/token",
        method: "DELETE",
        authorization: "token ghs_test",
        body: null,
      }]);
    });
  });
});

Deno.test("Inputs requires either privateKey or createJwt", () => {
  const createJwt: CreateJwt = () =>
    Promise.resolve({
      jwt: "fake-jwt",
      expiresAt: "2100-01-01T00:00:00Z",
    });

  const withPrivateKey: Inputs = {
    appId: "123456",
    owner: "suzuki-shunsuke",
    privateKey: "private-key",
  };
  const withCreateJwt: Inputs = {
    appId: "123456",
    owner: "suzuki-shunsuke",
    createJwt,
  };
  // @ts-expect-error privateKey and createJwt are mutually exclusive.
  const withBoth: Inputs = {
    appId: "123456",
    owner: "suzuki-shunsuke",
    privateKey: "private-key",
    createJwt,
  };
  // @ts-expect-error Either privateKey or createJwt is required.
  const withNeither: Inputs = {
    appId: "123456",
    owner: "suzuki-shunsuke",
  };

  assertEquals(
    [withPrivateKey, withCreateJwt, withBoth, withNeither].length,
    4,
  );
});
