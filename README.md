# github-app-token.ts

[![JSR](https://jsr.io/badges/@suzuki-shunsuke/github-app-token)](https://jsr.io/@suzuki-shunsuke/github-app-token)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/suzuki-shunsuke/github-app-token.ts)
[![License](http://img.shields.io/badge/license-mit-blue.svg?style=flat-square)](https://raw.githubusercontent.com/suzuki-shunsuke/github-app-token.ts/main/LICENSE)

github-app-token.ts is a JSR package to create and revoke GitHub App
installation access tokens.

## Example

```ts
import { create, hasExpired, revoke } from "@suzuki-shunsuke/github-app-token";

// Create a GitHub App installation access token.
const token = await create({
  appId: "123456",
  privateKey,
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

## Private keys in a KMS or a HSM

Sometimes a GitHub App private key is stored in a KMS or a HSM such as AWS KMS
and can never be exported. In that case you can't pass `privateKey`. Instead,
you can pass a `createJwt` callback, which signs a JSON Web Token with the key
and returns it.

`privateKey` and `createJwt` are mutually exclusive. You must set either of
them.

```ts
export type CreateJwt = (
  appId: string | number,
  timeDifference?: number,
) => Promise<{ jwt: string; expiresAt: string }>;
```

[@suzuki-shunsuke/github-app-jwt-aws-kms](https://jsr.io/@suzuki-shunsuke/github-app-jwt-aws-kms)
is a JSR package signing JSON Web Tokens with AWS KMS.

```ts
import { create } from "@suzuki-shunsuke/github-app-token";
import { createJwt } from "@suzuki-shunsuke/github-app-jwt-aws-kms";

const token = await create({
  appId: "123456",
  createJwt: createJwt({
    keyId:
      "arn:aws:kms:us-east-1:123456789012:key/00000000-0000-0000-0000-000000000000",
  }),
  owner: "suzuki-shunsuke",
});
```
