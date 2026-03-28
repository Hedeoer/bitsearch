import { Router } from "express";
import type { AppContext } from "../app-context.js";
import { hasMatchingSecret } from "../lib/auth.js";

export function createAuthRouter(context: AppContext): Router {
  const router = Router();

  router.get("/session", (req, res) => {
    res.json({
      loggedIn: context.adminSessions.hasSession(req.header("cookie")),
    });
  });

  router.post("/login", (req, res) => {
    const authKey = String(req.body?.authKey ?? "");
    if (!hasMatchingSecret(authKey, context.bootstrap.adminAuthKey)) {
      res.status(401).json({ error: "invalid_auth_key" });
      return;
    }
    context.adminSessions.createSession(res);
    res.json({ loggedIn: true });
  });

  router.post("/logout", (req, res) => {
    context.adminSessions.destroySession(req.header("cookie"), res);
    res.json({ loggedIn: false });
  });

  return router;
}
