import bcrypt from "bcryptjs";
import type { AppDatabase } from "../db/database.js";

interface AdminRow {
  id: string;
  username: string;
  password_hash: string;
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
