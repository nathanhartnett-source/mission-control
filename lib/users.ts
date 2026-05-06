/**
 * User store backed by data/users.json. Atomic writes via temp+rename.
 * Bcrypt cost 12. Approval tokens are stored hashed (sha256) so a file
 * leak doesn't grant self-approval.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { provisionWorkspace } from "./workspace";

export type UserStatus = "pending" | "active" | "denied";
export type UserRole = "admin" | "staff" | "client";

export function userRole(u: { role?: UserRole; isAdmin?: boolean }): UserRole {
  if (u.role) return u.role;
  return u.isAdmin ? "admin" : "staff";
}

export type User = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  isAdmin: boolean;
  role?: UserRole;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  deniedAt?: string;
  ip?: string;
  ua?: string;
  personaCompleted?: boolean;
  personaCompletedAt?: string;
  avatarSeed?: string;
  agentAvatarSeeds?: Record<string, string>;
};

export type ApprovalToken = {
  tokenHash: string;
  userId: string;
  kind: "approval";
  expiresAt: string;
  used: boolean;
};

type Store = { users: User[]; tokens: ApprovalToken[] };

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "users.json");

const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "system", "support", "api", "mc",
  "claude", "ava", "mia", "overseer", "nobody", "anonymous", "test",
  "register", "login", "logout", "auth",
]);

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function read(): Store {
  ensureDir();
  if (!fs.existsSync(FILE)) return { users: [], tokens: [] };
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
    };
  } catch {
    return { users: [], tokens: [] };
  }
}

function write(store: Store) {
  ensureDir();
  const tmp = FILE + ".tmp." + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
  try { fs.chmodSync(FILE, 0o600); } catch {}
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function validateRegistration(input: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}): string | null {
  const u = (input.username || "").trim().toLowerCase();
  const e = (input.email || "").trim().toLowerCase();
  const p = input.password || "";
  if (!USERNAME_RE.test(u)) return "Username must be 3–20 chars, lowercase letters/numbers/underscore.";
  if (RESERVED_USERNAMES.has(u)) return "That username is reserved.";
  if (!EMAIL_RE.test(e)) return "Please enter a valid email address.";
  if (p.length < 8) return "Password must be at least 8 characters.";
  if (p !== input.confirmPassword) return "Passwords don't match.";
  return null;
}

export function findByUsername(username: string): User | undefined {
  const u = username.trim().toLowerCase();
  return read().users.find(x => x.username === u);
}

export function findByEmail(email: string): User | undefined {
  const e = email.trim().toLowerCase();
  return read().users.find(x => x.email === e);
}

export function findById(id: string): User | undefined {
  return read().users.find(x => x.id === id);
}

export function listUsers(): User[] {
  return read().users;
}

/**
 * Create a pending user. Returns { user, rawApprovalToken } so the caller
 * can email the raw token (only stored hashed at rest).
 */
export async function createPending(input: {
  username: string;
  email: string;
  password: string;
  avatarSeed?: string;
  ip?: string;
  ua?: string;
}): Promise<{ user: User; rawToken: string }> {
  const store = read();
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();

  if (store.users.some(u => u.username === username)) {
    throw new Error("USERNAME_TAKEN");
  }
  if (store.users.some(u => u.email === email)) {
    throw new Error("EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user: User = {
    id: crypto.randomUUID(),
    username,
    email,
    passwordHash,
    status: "pending",
    isAdmin: false,
    createdAt: new Date().toISOString(),
    ip: input.ip,
    ua: input.ua,
    avatarSeed: input.avatarSeed,
  };

  const raw = crypto.randomBytes(32).toString("base64url");
  const token: ApprovalToken = {
    tokenHash: hashToken(raw),
    userId: user.id,
    kind: "approval",
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    used: false,
  };

  store.users.push(user);
  store.tokens.push(token);
  write(store);
  return { user, rawToken: raw };
}

export type TokenLookup =
  | { ok: true; user: User; token: ApprovalToken }
  | { ok: false; reason: "not_found" | "expired" | "used" | "user_missing" };

export function lookupToken(rawToken: string): TokenLookup {
  const store = read();
  const tokenHash = hashToken(rawToken);
  // Constant-time-ish scan (still O(n) but n is small).
  let match: ApprovalToken | undefined;
  for (const t of store.tokens) {
    // crypto.timingSafeEqual on equal-length buffers
    const a = Buffer.from(t.tokenHash, "hex");
    const b = Buffer.from(tokenHash, "hex");
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      match = t;
      // don't break — keep timing constant-ish
    }
  }
  if (!match) return { ok: false, reason: "not_found" };
  if (match.used) return { ok: false, reason: "used" };
  if (Date.parse(match.expiresAt) < Date.now()) return { ok: false, reason: "expired" };
  const user = store.users.find(u => u.id === match!.userId);
  if (!user) return { ok: false, reason: "user_missing" };
  return { ok: true, user, token: match };
}

export function approveByToken(rawToken: string, approvedBy: string): TokenLookup {
  const lookup = lookupToken(rawToken);
  if (!lookup.ok) return lookup;
  const store = read();
  const u = store.users.find(x => x.id === lookup.user.id)!;
  const t = store.tokens.find(x => x.tokenHash === lookup.token.tokenHash)!;
  u.status = "active";
  u.approvedAt = new Date().toISOString();
  u.approvedBy = approvedBy;
  t.used = true;
  write(store);
  // Provision per-user workspace (memory dir + agent inbox stub). Idempotent;
  // failures here shouldn't block approval — log and continue.
  try {
    provisionWorkspace(u.username);
  } catch (e) {
    console.error("[users] provisionWorkspace failed for", u.username, e);
  }
  return { ok: true, user: u, token: t };
}

export function setAvatarSeed(userId: string, seed: string): User | null {
  const store = read();
  const u = store.users.find(x => x.id === userId);
  if (!u) return null;
  u.avatarSeed = seed;
  write(store);
  return u;
}

export function setAgentAvatarSeed(userId: string, agent: string, seed: string): User | null {
  const store = read();
  const u = store.users.find(x => x.id === userId);
  if (!u) return null;
  if (!u.agentAvatarSeeds) u.agentAvatarSeeds = {};
  u.agentAvatarSeeds[agent.toLowerCase()] = seed;
  write(store);
  return u;
}

export function markPersonaCompleted(userId: string): User | null {
  const store = read();
  const u = store.users.find(x => x.id === userId);
  if (!u) return null;
  u.personaCompleted = true;
  u.personaCompletedAt = new Date().toISOString();
  write(store);
  return u;
}

export function denyByToken(rawToken: string, deniedBy: string): TokenLookup {
  const lookup = lookupToken(rawToken);
  if (!lookup.ok) return lookup;
  const store = read();
  const u = store.users.find(x => x.id === lookup.user.id)!;
  const t = store.tokens.find(x => x.tokenHash === lookup.token.tokenHash)!;
  u.status = "denied";
  u.deniedAt = new Date().toISOString();
  u.approvedBy = deniedBy;
  t.used = true;
  write(store);
  return { ok: true, user: u, token: t };
}

/**
 * Verify login credentials. Returns the user only if active.
 * Always runs bcrypt.compare even on missing user to avoid timing leaks.
 */
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8kV4mZHkHkqQfLwQXR9o1bV7E7l8qq";
export async function verifyLogin(username: string, password: string): Promise<User | null> {
  const u = (username || "").trim().toLowerCase();
  const user = findByUsername(u);
  const hash = user?.passwordHash || DUMMY_HASH;
  const ok = await bcrypt.compare(password || "", hash);
  if (!user || !ok) return null;
  if (user.status !== "active") return null;
  return user;
}

/**
 * One-time bootstrap: if there are no users yet but MC_USERNAME/MC_PASSWORD
 * env vars are set, create that user as the seed admin.
 */
export async function bootstrapAdminIfEmpty(): Promise<void> {
  const store = read();
  if (store.users.length > 0) return;
  const u = process.env.MC_USERNAME;
  const p = process.env.MC_PASSWORD;
  const e = process.env.MC_ADMIN_EMAIL || "nathanhartnett@allhart.com.au";
  if (!u || !p) return;
  const passwordHash = await bcrypt.hash(p, 12);
  store.users.push({
    id: crypto.randomUUID(),
    username: u.toLowerCase(),
    email: e.toLowerCase(),
    passwordHash,
    status: "active",
    isAdmin: true,
    createdAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    approvedBy: "bootstrap",
    personaCompleted: true,
  });
  write(store);
  try { provisionWorkspace(u.toLowerCase()); } catch (e) { console.error("[users] bootstrap provision failed", e); }
}

export function findAdminEmails(): string[] {
  return read().users.filter(u => u.isAdmin && u.status === "active").map(u => u.email);
}

export function listPending(): User[] {
  return read().users.filter(u => u.status === "pending");
}

export function approveById(userId: string, approvedBy: string): User | null {
  const store = read();
  const u = store.users.find(x => x.id === userId);
  if (!u) return null;
  u.status = "active";
  u.approvedAt = new Date().toISOString();
  u.approvedBy = approvedBy;
  for (const t of store.tokens) if (t.userId === userId) t.used = true;
  write(store);
  try { provisionWorkspace(u.username); } catch (e) { console.error("[users] provisionWorkspace failed", e); }
  return u;
}

export type AssignableRole = UserRole;

export function setUserRole(userId: string, role: AssignableRole): User | null {
  const store = read();
  const u = store.users.find(x => x.id === userId);
  if (!u) return null;
  u.role = role;
  u.isAdmin = role === "admin";
  write(store);
  return u;
}

export function denyById(userId: string, deniedBy: string): User | null {
  const store = read();
  const u = store.users.find(x => x.id === userId);
  if (!u) return null;
  u.status = "denied";
  u.deniedAt = new Date().toISOString();
  u.approvedBy = deniedBy;
  for (const t of store.tokens) if (t.userId === userId) t.used = true;
  write(store);
  return u;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ ok: true } | { ok: false; reason: "wrong_password" | "too_short" | "not_found" }> {
  if ((newPassword || "").length < 8) return { ok: false, reason: "too_short" };
  const store = read();
  const u = store.users.find(x => x.id === userId);
  if (!u) return { ok: false, reason: "not_found" };
  const ok = await bcrypt.compare(currentPassword || "", u.passwordHash);
  if (!ok) return { ok: false, reason: "wrong_password" };
  u.passwordHash = await bcrypt.hash(newPassword, 12);
  write(store);
  return { ok: true };
}
