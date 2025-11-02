# github-app-token.ts

[![JSR](https://jsr.io/badges/@suzuki-shunsuke/github-app-token)](https://jsr.io/@suzuki-shunsuke/github-app-token)
[![License](http://img.shields.io/badge/license-mit-blue.svg?style=flat-square)](https://raw.githubusercontent.com/suzuki-shunsuke/github-app-token.ts/main/LICENSE)

github-app-token.ts is a JSR package to create and revoke GitHub App installation access tokens.

## Example

```ts
import { create, revoke, hasExpired } from "@suzuki-shunsuke/github-app-token";

// Create a GitHub App installation access token.
const token = await githubAppToken.create({
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
