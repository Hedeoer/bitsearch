import type { AdminAccessInfo } from "../../shared/contracts.js";
import type { AppContext } from "../app-context.js";
import { AppHttpError } from "../lib/http.js";
import { persistRuntimeSecrets, setRuntimeSecret } from "../lib/runtime-secrets.js";

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

export function saveAdminAuthKey(context: AppContext, authKey: string): void {
  if (context.bootstrap.runtimeSecrets.sources.adminAuthKey === "env") {
    throw new AppHttpError(409, "admin_auth_key_env_locked");
  }
  const nextKey = authKey.trim();
  if (!nextKey) {
    throw new Error("Admin auth key cannot be empty.");
  }
  context.bootstrap.adminAuthKey = nextKey;
  setRuntimeSecret(context.bootstrap.runtimeSecrets, "adminAuthKey", nextKey);
  persistRuntimeSecrets(context.bootstrap.runtimeSecrets);
}
