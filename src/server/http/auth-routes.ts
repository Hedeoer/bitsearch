import { Router } from "express";
import type { AppContext } from "../app-context.js";
import { getAdminUsername, verifyAdminCredentials } from "../repos/admin-repo.js";

export function createAuthRouter(context: AppContext): Router {
  const router = Router();

  router.get("/session", (req, res) => {
    const userId = req.session.adminUserId;
    res.json({
      loggedIn: Boolean(userId),
      username: userId ? getAdminUsername(context.db, userId) : null,
    });
  });

  router.post("/login", (req, res) => {
    const username = String(req.body?.username ?? "");
    const password = String(req.body?.password ?? "");
    const admin = verifyAdminCredentials(context.db, username, password);
    if (!admin) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    req.session.adminUserId = admin.id;
    req.session.save(() => {
      res.json({ loggedIn: true, username: admin.username });
    });
  });

  router.post("/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ loggedIn: false, username: null });
    });
  });

  return router;
}
