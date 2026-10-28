require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const db = require("./db");

const SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? null : "dev-only-secret");
if (!SECRET) throw new Error("Set JWT_SECRET in production");
const CATS = ["Environment", "Health", "Education", "Community", "Safety"];
const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: "20kb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }));

// ---- helpers
const wrap = fn => (req, res, next) => { try { fn(req, res, next); } catch (e) { next(e); } };
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const str = (v, max, min = 1) => typeof v === "string" && v.trim().length >= min && v.trim().length <= max ? v.trim() : null;
const emailOk = e => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 120;
const sign = u => jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: "8h" });
const pub = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, bio: u.bio });
function auth(req, res, next) {
  const t = (req.headers.authorization || "").replace("Bearer ", "");
  try {
    const p = jwt.verify(t, SECRET);
    const u = db.prepare("SELECT * FROM users WHERE id=?").get(p.id);
    if (!u) return bad(res, "Account no longer exists", 401);
    req.user = u; next();
  } catch { bad(res, "Please log in", 401); }
}
const need = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : bad(res, "Not allowed", 403);

// ---- auth
app.post("/api/auth/register", wrap((req, res) => {
  const name = str(req.body.name, 80), email = emailOk(req.body.email) ? req.body.email.toLowerCase() : null;
  const pw = str(req.body.password, 100, 6), role = req.body.role === "business" ? "business" : "user";
  if (!name || !email || !pw) return bad(res, "Name, valid email and a password of 6+ characters are required");
  if (db.prepare("SELECT 1 FROM users WHERE email=?").get(email)) return bad(res, "Email already registered", 409);
  const id = db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)").run(name, email, bcrypt.hashSync(pw, 10), role).lastInsertRowid;
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  res.status(201).json({ token: sign(u), user: pub(u) });
}));
app.post("/api/auth/login", wrap((req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE email=?").get(String(req.body.email || "").toLowerCase());
  if (!u || !bcrypt.compareSync(String(req.body.password || ""), u.password_hash)) return bad(res, "Wrong email or password", 401);
  res.json({ token: sign(u), user: pub(u) });
}));
app.get("/api/me", auth, (req, res) => res.json(pub(req.user)));
app.put("/api/me", auth, wrap((req, res) => {
  const name = str(req.body.name, 80); if (!name) return bad(res, "Name required");
  db.prepare("UPDATE users SET name=?, bio=? WHERE id=?").run(name, String(req.body.bio || "").slice(0, 300), req.user.id);
  res.json(pub(db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id)));
}));

// ---- causes
const causeSql = `SELECT c.id,c.title,c.category,c.description,c.status,u.name AS owner,
  (SELECT COUNT(*) FROM supporters s WHERE s.cause_id=c.id) AS supporters,
  EXISTS(SELECT 1 FROM supporters s WHERE s.cause_id=c.id AND s.user_id=?) AS supported
  FROM causes c JOIN users u ON u.id=c.owner_id`;
function optionalUser(req) { try { return jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), SECRET).id; } catch { return 0; } }
app.get("/api/causes", wrap((req, res) => {
  const q = `%${String(req.query.q || "").toLowerCase()}%`, cat = CATS.includes(req.query.category) ? req.query.category : null;
  const rows = db.prepare(causeSql + ` WHERE c.status='approved' AND (lower(c.title)||lower(c.description)) LIKE ? AND (? IS NULL OR c.category=?) ORDER BY c.id DESC`)
    .all(optionalUser(req), q, cat, cat);
  res.json(rows.map(r => ({ ...r, supported: !!r.supported })));
}));
app.post("/api/causes", auth, wrap((req, res) => {
  const title = str(req.body.title, 80), description = str(req.body.description, 400), category = req.body.category;
  if (!title || !description || !CATS.includes(category)) return bad(res, "Title, description and a valid category are required");
  const id = db.prepare("INSERT INTO causes(title,category,description,owner_id) VALUES(?,?,?,?)").run(title, category, description, req.user.id).lastInsertRowid;
  res.status(201).json({ id, status: "pending", message: "Submitted for admin approval" });
}));
app.get("/api/my/causes", auth, (req, res) =>
  res.json(db.prepare(causeSql + " WHERE c.owner_id=? ORDER BY c.id DESC").all(req.user.id, req.user.id)));
app.post("/api/causes/:id/support", auth, wrap((req, res) => {
  const c = db.prepare("SELECT id FROM causes WHERE id=? AND status='approved'").get(req.params.id);
  if (!c) return bad(res, "Cause not found", 404);
  const has = db.prepare("SELECT 1 FROM supporters WHERE cause_id=? AND user_id=?").get(c.id, req.user.id);
  if (has) db.prepare("DELETE FROM supporters WHERE cause_id=? AND user_id=?").run(c.id, req.user.id);
  else db.prepare("INSERT INTO supporters VALUES(?,?)").run(c.id, req.user.id);
  res.json({ supported: !has });
}));

// ---- businesses and leads
app.get("/api/businesses", (req, res) =>
  res.json(db.prepare("SELECT id,name,category,description,contact FROM businesses ORDER BY id DESC").all()));
app.get("/api/my/business", auth, need("business"), (req, res) =>
  res.json(db.prepare("SELECT id,name,category,description,contact FROM businesses WHERE owner_id=?").get(req.user.id) || null));
app.put("/api/my/business", auth, need("business"), wrap((req, res) => {
  const b = { name: str(req.body.name, 80), category: str(req.body.category, 40), description: str(req.body.description, 300), contact: emailOk(req.body.contact) ? req.body.contact : null };
  if (Object.values(b).some(v => !v)) return bad(res, "Name, type, description and valid contact email are required");
  db.prepare(`INSERT INTO businesses(owner_id,name,category,description,contact) VALUES(?,?,?,?,?)
    ON CONFLICT(owner_id) DO UPDATE SET name=excluded.name,category=excluded.category,description=excluded.description,contact=excluded.contact`)
    .run(req.user.id, b.name, b.category, b.description, b.contact);
  res.json(db.prepare("SELECT * FROM businesses WHERE owner_id=?").get(req.user.id));
}));
app.post("/api/businesses/:id/enquiries", auth, wrap((req, res) => {
  const msg = str(req.body.message, 500);
  if (!msg) return bad(res, "Message required");
  if (!db.prepare("SELECT 1 FROM businesses WHERE id=?").get(req.params.id)) return bad(res, "Business not found", 404);
  db.prepare("INSERT INTO enquiries(business_id,from_user,message) VALUES(?,?,?)").run(req.params.id, req.user.id, msg);
  res.status(201).json({ message: "Enquiry sent" });
}));
app.get("/api/my/leads", auth, need("business"), (req, res) =>
  res.json(db.prepare(`SELECT e.id,e.message,e.created_at,u.name AS from_name,u.email AS from_email FROM enquiries e
    JOIN businesses b ON b.id=e.business_id JOIN users u ON u.id=e.from_user WHERE b.owner_id=? ORDER BY e.id DESC`).all(req.user.id)));

// ---- admin
app.use("/api/admin", auth, need("admin"));
app.get("/api/admin/causes/pending", (req, res) =>
  res.json(db.prepare(causeSql + " WHERE c.status='pending' ORDER BY c.id").all(req.user.id)));
for (const action of ["approve", "reject"]) {
  app.post(`/api/admin/causes/:id/${action}`, wrap((req, res) => {
    const r = db.prepare("UPDATE causes SET status=? WHERE id=?").run(action === "approve" ? "approved" : "rejected", req.params.id);
    r.changes ? res.json({ ok: true }) : bad(res, "Cause not found", 404);
  }));
}
app.get("/api/admin/users", (req, res) =>
  res.json(db.prepare("SELECT id,name,email,role,created_at FROM users ORDER BY id").all()));
app.delete("/api/admin/users/:id", wrap((req, res) => {
  const u = db.prepare("SELECT role FROM users WHERE id=?").get(req.params.id);
  if (!u) return bad(res, "User not found", 404);
  if (u.role === "admin") return bad(res, "Admins cannot be removed", 403);
  db.prepare("DELETE FROM users WHERE id=?").run(req.params.id);
  res.json({ ok: true });
}));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
// Serve the front-end folder (same origin as the API, so no CORS setup needed)
const fe = path.join(__dirname, "..", "..", "frontend");
app.use(express.static(fe));
app.use("/api", (req, res) => bad(res, "Not found", 404));
app.use((err, req, res, next) => { console.error(err); bad(res, "Server error", 500); });

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`ACS Social Awareness API on http://localhost:${port}`));
}
module.exports = app;
