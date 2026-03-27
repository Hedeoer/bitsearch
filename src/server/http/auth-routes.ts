import { Router } from "express";
import type { AppContext } from "../app-context.js";
import { hasMatchingBearerToken, hasMatchingSecret } from "../lib/auth.js";

export function createAuthRouter(context: AppContext): Router {
  const router = Router();

  router.get("/session", (req, res) => {
    res.json({
      loggedIn: hasMatchingBearerToken(
        req.header("authorization"),
        context.bootstrap.adminAuthKey,
      ),
    });
  });

  router.post("/login", (req, res) => {
    const authKey = String(req.body?.authKey ?? "");
    if (!hasMatchingSecret(authKey, context.bootstrap.adminAuthKey)) {
      res.status(401).json({ error: "invalid_auth_key" });
      return;
    }
    res.json({ loggedIn: true });
  });

  router.post("/logout", (_req, res) => {
    res.json({ loggedIn: false });
  });

  return router;
}
