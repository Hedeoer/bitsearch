import type { AdminAccessInfo } from "../../shared/contracts.js";
import type { AppContext } from "../app-context.js";

const TOKEN_PREVIEW_SUFFIX_LENGTH = 4;
const TOKEN_PREVIEW_MASK = "********";

function createTokenPreview(token: string): string {
  return `${TOKEN_PREVIEW_MASK}${token.slice(-TOKEN_PREVIEW_SUFFIX_LENGTH)}`;
}

export function getAdminAccessInfo(context: AppContext): AdminAccessInfo {
  const authKey = context.bootstrap.runtimeSecrets.values.adminAuthKey.trim();
  return {
    hasAuthKey: Boolean(authKey),
    authKeyPreview: authKey ? createTokenPreview(authKey) : null,
  };
}

export function getAdminAuthKey(context: AppContext): string {
  return context.bootstrap.runtimeSecrets.values.adminAuthKey;
}
