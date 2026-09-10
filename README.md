# github-app-token.ts

[![JSR](https://jsr.io/badges/@suzuki-shunsuke/github-app-token)](https://jsr.io/@suzuki-shunsuke/github-app-token)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/suzuki-shunsuke/github-app-token.ts)
[![License](http://img.shields.io/badge/license-mit-blue.svg?style=flat-square)](https://raw.githubusercontent.com/suzuki-shunsuke/github-app-token.ts/main/LICENSE)

github-app-token.ts is a JSR package to create and revoke GitHub App
installation access tokens.

It doesn't authenticate as a GitHub App itself. You build an Octokit client
authenticated as the app and pass it in, so this package has no runtime
dependency and you keep one Octokit in your dependency tree instead of two.

## Example

```ts
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { create, hasExpired, revoke } from "@suzuki-shunsuke/github-app-token";

// Create a GitHub App installation access token.
const appOctokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: "123456",
    privateKey,
  },
});
const token = await create({
  octokit: appOctokit,
  owner: "suzuki-shunsuke",
  repositories: ["tfcmt"],
  permissions: {
    issues: "write",
  },
});

const octokit = github.getOctokit(token.token);
// Use octokit...

if (!hasExpired(token.expiresAt)) { // Check if the token has expired.
  await revoke(token.token); // Revoke the token.
}
```

`create` takes a client authenticated as the app. `revoke` doesn't need one,
because the token is the only credential it requires.

## The client

`Client` is declared structurally, covering only the `request` method this
package calls.

```ts
export type Client = {
  request: (
    route: string,
    parameters?: Record<string, unknown>,
  ) => Promise<{ data: unknown }>;
};
```

Clients from `@octokit/rest`, `@octokit/core` and `@actions/github` all satisfy
it, so you can pass whichever you already have. On GitHub Enterprise Server the
base URL of `create` comes from the client you pass; `revoke` takes it as an
optional second argument.

```ts
await revoke(token.token, "https://github.example.com/api/v3");
```

## Private keys in a KMS or a HSM

Sometimes a GitHub App private key is stored in a KMS or a HSM such as AWS KMS
and can never be exported. In that case you can't pass `privateKey` to
`@octokit/auth-app`. Instead, pass a `createJwt` callback, which signs a JSON
Web Token with the key and returns it.

[@suzuki-shunsuke/github-app-jwt-aws-kms](https://jsr.io/@suzuki-shunsuke/github-app-jwt-aws-kms)
is a JSR package signing JSON Web Tokens with AWS KMS.

```ts
import { createJwt } from "@suzuki-shunsuke/github-app-jwt-aws-kms";

const appOctokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: "123456",
    createJwt: createJwt({
      keyId:
        "arn:aws:kms:us-east-1:123456789012:key/00000000-0000-0000-0000-000000000000",
    }),
  },
});
```

## Migrating from 0.1.0

`create` no longer takes `appId`, `privateKey` or `createJwt`. Authentication
moved to the caller, which is what removes `@octokit/auth-app` and
`@octokit/rest` from this package's dependencies. `revoke` is unchanged.

```ts
// 0.1.0
const token = await create({ appId, privateKey, owner });

// 0.2.0
const appOctokit = new Octokit({
  authStrategy: createAppAuth,
  auth: { appId, privateKey },
});
const token = await create({ octokit: appOctokit, owner });
```

`Permissions` is now derived from `@octokit/openapi-types` rather than
`@octokit/plugin-rest-endpoint-methods`. The two differ only by the
openapi-types version they track.
