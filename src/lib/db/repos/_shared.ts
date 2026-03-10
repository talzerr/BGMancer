import type Database from "better-sqlite3";
import { getDB } from "@/lib/db";

// Prepared statements cached by SQL string — avoids recompiling on every call.
export const _stmts = new Map<string, Database.Statement<unknown[]>>();
export function stmt(sql: string): Database.Statement<unknown[]> {
  let s = _stmts.get(sql);
  if (!s) {
    s = getDB().prepare(sql);
    _stmts.set(sql, s);
  }
  return s;
}

// Parameterized subquery templates (userId bound as '?' at call time).
export const LIBRARY_SQ = "(SELECT id FROM libraries WHERE user_id = ? LIMIT 1)";
export const ACTIVE_SESSION_SQ =
  "(SELECT id FROM playlists WHERE user_id = ? AND is_archived = 0 ORDER BY created_at DESC LIMIT 1)";
