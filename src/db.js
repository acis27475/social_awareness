const { DatabaseSync } = require("node:sqlite"); // built into Node 22.13+, no native build needed
const bcrypt = require("bcryptjs");
const path = require("path");
const db = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, "..", "data.db"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','business','admin')),
  bio TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS causes(
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS supporters(
  cause_id INTEGER REFERENCES causes(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(cause_id,user_id));
CREATE TABLE IF NOT EXISTS businesses(
  id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, contact TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS enquiries(
  id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  from_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, message TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
// Seed an admin and sample data on first run
if (!db.prepare("SELECT 1 FROM users LIMIT 1").get()) {
  const pw = process.env.ADMIN_PASSWORD || "admin123";
  const a = db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')")
    .run("ACS Admin", process.env.ADMIN_EMAIL || "admin@acs.test", bcrypt.hashSync(pw, 10)).lastInsertRowid;
  const c = db.prepare("INSERT INTO causes(title,category,description,owner_id,status) VALUES(?,?,?,?,'approved')");
  c.run("Clean Creek Weekend", "Environment", "Volunteers clear litter along the local creek and plant native grasses.", a);
  c.run("Mental Health Check-In Week", "Health", "Share simple ways to check in on friends and find local support services.", a);
  c.run("Study Buddy for Newcomers", "Education", "Pairing new arrivals with volunteers for English practice and homework help.", a);
}
module.exports = db;
