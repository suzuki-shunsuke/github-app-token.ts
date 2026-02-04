/**
 * This module contains functions to create and revoke GitHub App installation access tokens.
 *
 * @example
 * ```ts
 * import { create, revoke, hasExpired } from "@suzuki-shunsuke/github-app-token";
 *
 * // Create a GitHub App installation access token.
 * const token = await githubAppToken.create({
 *   appId: "123456",
 *   privateKey,
 *   owner: "suzuki-shunsuke",
 *   repositories: ["tfcmt"],
 *   permissions: {
 *     issues: "write",
 *   },
 * });
 * const octokit = github.getOctokit(token.token);
 * // Use octokit...
 * if (!hasExpired(token.expiresAt)) { // Check if the token has expired.
 *   await revoke(token.token); // Revoke the token.
 * }
 * ```
 *
 * @module
 */

import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

export type Inputs = {
  appId: string;
  privateKey: string;
  owner: string;
  repositories?: string[];
  permissions?: Permissions;
};

export interface Logger {
  info(m: string): void;
}

export class Tokens {
  tokens: Token[];
  logger: Logger;
  constructor(logger?: Logger) {
    this.tokens = [];
    this.logger = logger || console;
  }
  push(token: Token): void {
    this.tokens.push(token);
  }
  async revokes(): Promise<void> {
    for (const token of this.tokens) {
      if (hasExpired(token.expiresAt)) {
        this.logger.info(
          "skip revoking GitHub App token as it has already expired",
        );
        continue;
      }
      this.logger.info("revoking GitHub App token");
      await revoke(token.token);
    }
  }
}

export type Permissions =
  RestEndpointMethodTypes["apps"]["createInstallationAccessToken"]["parameters"]["permissions"];

export type Token = {
  token: string;
  expiresAt: string;
  installationId: number;
};

/** This function returns true if the token has expired. */
export const hasExpired = (expiresAt: string): boolean => {
  const expires = new Date(expiresAt).getTime();
  const now = Date.now();
  return now >= expires;
};

/** This function generates a new installation access token. */
export const create = async (inputs: Inputs): Promise<Token> => {
  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: inputs.appId,
      privateKey: inputs.privateKey,
    },
  });

  const installation = await appOctokit.rest.apps.getUserInstallation({
    username: inputs.owner,
  });
  const token = await appOctokit.rest.apps.createInstallationAccessToken({
    installation_id: installation.data.id,
    permissions: inputs.permissions,
    repositories: inputs.repositories,
  });
  return {
    token: token.data.token,
    expiresAt: token.data.expires_at,
    installationId: installation.data.id,
  };
};

/** This function revokes the installation access token. */
export const revoke = async (token: string): Promise<void> => {
  const octokit = new Octokit({
    auth: token,
  });
  await octokit.rest.apps.revokeInstallationAccessToken();
};
