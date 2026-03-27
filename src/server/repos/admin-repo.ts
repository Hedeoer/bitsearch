import bcrypt from "bcryptjs";
import type { AdminProfile } from "../../shared/contracts.js";
import type { AppDatabase } from "../db/database.js";

interface AdminRow {
  id: string;
  username: string;
  password_hash: string;
  created_at?: string;
  password_updated_at?: string | null;
}

export function verifyAdminCredentials(
  db: AppDatabase,
  username: string,
  password: string,
): { id: string; username: string } | null {
  const row = db.sqlite
    .prepare("SELECT id, username, password_hash FROM admin_users WHERE username = ?")
    .get(username) as AdminRow | undefined;

  if (!row) {
    return null;
  }
  if (!bcrypt.compareSync(password, row.password_hash)) {
    return null;
  }
  return { id: row.id, username: row.username };
}

export function getAdminUsername(db: AppDatabase, id: string): string | null {
  const row = db.sqlite
    .prepare("SELECT username FROM admin_users WHERE id = ?")
    .get(id) as { username: string } | undefined;
  return row?.username ?? null;
}

export function getAdminProfile(
  db: AppDatabase,
  id: string,
): AdminProfile | null {
  const row = db.sqlite
    .prepare(
      "SELECT username, created_at, password_updated_at FROM admin_users WHERE id = ?",
    )
    .get(id) as AdminRow | undefined;
  if (!row?.username || !row.created_at) {
    return null;
  }
  return {
    username: row.username,
    createdAt: row.created_at,
    passwordUpdatedAt: row.password_updated_at ?? null,
  };
}

export function updateAdminPassword(
  db: AppDatabase,
  id: string,
  currentPassword: string,
  nextPassword: string,
): { ok: boolean; error?: string } {
  const row = db.sqlite
    .prepare("SELECT password_hash FROM admin_users WHERE id = ?")
    .get(id) as { password_hash: string } | undefined;

  if (!row) {
    return { ok: false, error: "admin_not_found" };
  }
  if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
    return { ok: false, error: "current_password_incorrect" };
  }
  if (nextPassword.length < 8) {
    return { ok: false, error: "password_too_short" };
  }

  db.sqlite
    .prepare(
      "UPDATE admin_users SET password_hash = ?, password_updated_at = ? WHERE id = ?",
    )
    .run(bcrypt.hashSync(nextPassword, 10), db.now(), id);
  return { ok: true };
}
