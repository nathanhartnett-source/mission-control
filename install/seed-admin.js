#!/usr/bin/env node
// Idempotently seed an admin user into data/users.json.
// Usage: node install/seed-admin.js <username> <email> <password>
// If the username/email already exists, it's promoted to active admin and
// the password is reset to the supplied one.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const [, , username, email, password] = process.argv;
if (!username || !email || !password) {
  console.error("usage: seed-admin.js <username> <email> <password>");
  process.exit(1);
}

const FILE = path.join(process.cwd(), "data", "users.json");
fs.mkdirSync(path.dirname(FILE), { recursive: true });

let store = { users: [], tokens: [] };
if (fs.existsSync(FILE)) {
  try { store = JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch { /* corrupt, overwrite */ }
}
store.users = Array.isArray(store.users) ? store.users : [];
store.tokens = Array.isArray(store.tokens) ? store.tokens : [];

const u = username.toLowerCase();
const e = email.toLowerCase();
const passwordHash = bcrypt.hashSync(password, 12);
const now = new Date().toISOString();

let user = store.users.find(x => x.username === u || x.email === e);
if (user) {
  user.username = u;
  user.email = e;
  user.passwordHash = passwordHash;
  user.status = "active";
  user.isAdmin = true;
  user.role = "admin";
  user.approvedAt = user.approvedAt || now;
  user.approvedBy = user.approvedBy || "seed-admin";
  console.log("updated existing user to active admin:", u);
} else {
  user = {
    id: crypto.randomUUID(),
    username: u,
    email: e,
    passwordHash,
    status: "active",
    isAdmin: true,
    role: "admin",
    createdAt: now,
    approvedAt: now,
    approvedBy: "seed-admin",
    personaCompleted: true,
  };
  store.users.push(user);
  console.log("created new admin user:", u);
}

const tmp = FILE + ".tmp";
fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
fs.renameSync(tmp, FILE);
try { fs.chmodSync(FILE, 0o600); } catch {}
console.log("done. login with", u, "/", "(supplied password)");
