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

export type Permissions =
  RestEndpointMethodTypes["apps"]["createInstallationAccessToken"][
    "parameters"
  ]["permissions"];

export const create = async (
  inputs: Inputs,
): Promise<string> => {
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
  return token.data.token;
};

export const revoke = async (
  token: string,
): Promise<void> => {
  const octokit = new Octokit({
    auth: token,
  });
  await octokit.rest.apps.revokeInstallationAccessToken();
};
