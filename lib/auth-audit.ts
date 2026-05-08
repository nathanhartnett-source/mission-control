/**
 * Append-only auth audit log at data/auth-audit.jsonl.
 */
import fs from "fs";
import path from "path";

export type AuditEvent =
  | "register" | "register_blocked" | "register_mail_failed" | "approve" | "deny"
  | "login_ok" | "login_fail" | "logout"
  | "token_invalid" | "onboarding_complete";

const FILE = path.join(process.cwd(), "data", "auth-audit.jsonl");

export function audit(event: AuditEvent, fields: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), event, ...fields }) + "\n";
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.appendFileSync(FILE, line);
  } catch {
    /* best-effort */
  }
}
