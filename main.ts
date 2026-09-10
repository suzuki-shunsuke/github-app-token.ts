/**
 * This module contains functions to create and revoke GitHub App installation access tokens.
 *
 * @example
 * ```ts
 * import { create, revoke, hasExpired } from "@suzuki-shunsuke/github-app-token";
 *
 * // Create a GitHub App installation access token.
 * const token = await create({
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
 * @example
 * ```ts
 * // Instead of a private key, you can pass a callback signing a JSON Web Token.
 * // This is useful when the private key is stored in a KMS or a HSM and can't be exported.
 * import { create } from "@suzuki-shunsuke/github-app-token";
 * import { createJwt } from "@suzuki-shunsuke/github-app-jwt-aws-kms";
 *
 * const token = await create({
 *   appId: "123456",
 *   createJwt: createJwt({
 *     keyId: "arn:aws:kms:us-east-1:123456789012:key/00000000-0000-0000-0000-000000000000",
 *   }),
 *   owner: "suzuki-shunsuke",
 * });
 * ```
 *
 * @module
 */

import { createAppAuth } from "@octokit/auth-app";
import type { AppAuthOptions } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

/**
 * A callback creating a JSON Web Token to authenticate as a GitHub App.
 *
 * It's useful when the private key is stored in a KMS or a HSM and can't be
 * exported.
 * The callback takes an app id and returns a signed JSON Web Token and its
 * expiration date.
 */
export type CreateJwt = NonNullable<AppAuthOptions["createJwt"]>;

/** Inputs which are common to all authentication methods. */
export type CommonInputs = {
  appId: string;
  owner: string;
  repositories?: string[];
  permissions?: Permissions;
};

/** Inputs authenticating as a GitHub App with a private key. */
export type PrivateKeyInputs = CommonInputs & {
  privateKey: string;
  createJwt?: never;
};

/** Inputs authenticating as a GitHub App with a createJwt callback. */
export type CreateJwtInputs = CommonInputs & {
  createJwt: CreateJwt;
  privateKey?: never;
};

/**
 * Inputs of the create function.
 *
 * privateKey and createJwt are mutually exclusive.
 * Either of them must be set.
 */
export type Inputs = PrivateKeyInputs | CreateJwtInputs;

export type Permissions =
  RestEndpointMethodTypes["apps"]["createInstallationAccessToken"][
    "parameters"
  ]["permissions"];

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
export const create = async (
  inputs: Inputs,
): Promise<Token> => {
  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: inputs.appId,
      privateKey: inputs.privateKey,
      createJwt: inputs.createJwt,
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
export const revoke = async (
  token: string,
): Promise<void> => {
  const octokit = new Octokit({
    auth: token,
  });
  await octokit.rest.apps.revokeInstallationAccessToken();
};
