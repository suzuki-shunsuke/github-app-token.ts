/**
 * This module contains functions to create and revoke GitHub App installation access tokens.
 *
 * It doesn't authenticate as a GitHub App itself.
 * You build an Octokit client authenticated as the app and pass it in, so this
 * module has no runtime dependency and you keep one Octokit in your dependency
 * tree instead of two.
 *
 * @example
 * ```ts
 * import { Octokit } from "@octokit/rest";
 * import { createAppAuth } from "@octokit/auth-app";
 * import { create, hasExpired, revoke } from "@suzuki-shunsuke/github-app-token";
 *
 * // Create a GitHub App installation access token.
 * const appOctokit = new Octokit({
 *   authStrategy: createAppAuth,
 *   auth: {
 *     appId: "123456",
 *     privateKey,
 *   },
 * });
 * const token = await create({
 *   octokit: appOctokit,
 *   owner: "suzuki-shunsuke",
 *   repositories: ["tfcmt"],
 *   permissions: {
 *     issues: "write",
 *   },
 * });
 *
 * const octokit = github.getOctokit(token.token);
 * // Use octokit...
 * if (!hasExpired(token.expiresAt)) { // Check if the token has expired.
 *   await revoke(octokit); // Revoke the token.
 * }
 * ```
 *
 * @example
 * ```ts
 * // When the private key is stored in a KMS or a HSM and can't be exported,
 * // authenticate the app with a createJwt callback instead of a private key.
 * import { createJwt } from "@suzuki-shunsuke/github-app-jwt-aws-kms";
 *
 * const appOctokit = new Octokit({
 *   authStrategy: createAppAuth,
 *   auth: {
 *     appId: "123456",
 *     createJwt: createJwt({
 *       keyId: "arn:aws:kms:us-east-1:123456789012:key/00000000-0000-0000-0000-000000000000",
 *     }),
 *   },
 * });
 * ```
 *
 * @module
 */

import type { components } from "@octokit/openapi-types";

/**
 * The part of an Octokit client which this module uses.
 *
 * Octokit clients from @octokit/rest, @octokit/core and @actions/github all
 * satisfy this type, so you can simply pass one.
 * It's declared structurally so that this module has no runtime dependency and
 * so that you can pass a stub in tests.
 */
export type Client = {
  request: (
    route: string,
    parameters?: Record<string, unknown>,
  ) => Promise<{ data: unknown }>;
};

/** Permissions of an installation access token. */
export type Permissions = components["schemas"]["app-permissions"];

/** Inputs of the create function. */
export type Inputs = {
  /**
   * An Octokit client authenticated as a GitHub App.
   *
   * Build it with @octokit/auth-app, passing either a private key or a
   * createJwt callback.
   */
  octokit: Client;
  owner: string;
  repositories?: string[];
  permissions?: Permissions;
};

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

const request = async <T>(
  octokit: Client,
  route: string,
  parameters?: Record<string, unknown>,
): Promise<T> => {
  const response = await octokit.request(route, parameters);
  // The route determines the response body, which Octokit types as any.
  return response.data as T;
};

/** This function generates a new installation access token. */
export const create = async (
  inputs: Inputs,
): Promise<Token> => {
  const installation = await request<components["schemas"]["installation"]>(
    inputs.octokit,
    "GET /users/{username}/installation",
    {
      username: inputs.owner,
    },
  );
  const token = await request<components["schemas"]["installation-token"]>(
    inputs.octokit,
    "POST /app/installations/{installation_id}/access_tokens",
    {
      installation_id: installation.id,
      permissions: inputs.permissions,
      repositories: inputs.repositories,
    },
  );
  return {
    token: token.token,
    expiresAt: token.expires_at,
    installationId: installation.id,
  };
};

/**
 * This function revokes the installation access token.
 *
 * Pass an Octokit client authenticated with the installation access token
 * itself, not one authenticated as the app.
 */
export const revoke = async (
  octokit: Client,
): Promise<void> => {
  await octokit.request("DELETE /installation/token");
};
