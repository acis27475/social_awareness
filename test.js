// Smoke test: runs the API on a temporary database and checks the main flows
process.env.DB_FILE = ":memory:";
const app = require("./src/server");
const assert = require("assert");
const srv = app.listen(0, async () => {
  const base = `http://localhost:${srv.address().port}/api`;
  const call = async (m, p, b, t) => { const r = await fetch(base + p, { method: m, headers: { "Content-Type": "application/json", ...(t && { Authorization: "Bearer " + t }) }, body: b && JSON.stringify(b) }); return { s: r.status, j: await r.json() }; };
  try {
    let r = await call("POST", "/auth/login", { email: "admin@acs.test", password: "admin123" }); assert.equal(r.s, 200); const admin = r.j.token;
    r = await call("POST", "/auth/register", { name: "Sam", email: "sam@x.test", password: "secret1" }); assert.equal(r.s, 201); const sam = r.j.token;
    r = await call("POST", "/auth/register", { name: "Sam", email: "sam@x.test", password: "secret1" }); assert.equal(r.s, 409);
    r = await call("POST", "/causes", { title: "Test", category: "Health", description: "d" }, sam); assert.equal(r.s, 201); const id = r.j.id;
    r = await call("GET", "/causes"); assert.equal(r.j.length, 3);
    r = await call("GET", "/admin/causes/pending", null, sam); assert.equal(r.s, 403);
    r = await call("POST", `/admin/causes/${id}/approve`, null, admin); assert.equal(r.s, 200);
    r = await call("POST", `/causes/${id}/support`, null, sam); assert.equal(r.j.supported, true);
    r = await call("GET", "/causes?q=test", null, sam); assert.equal(r.j[0].supporters, 1);
    r = await call("POST", "/auth/register", { name: "Biz", email: "b@x.test", password: "secret1", role: "business" }); const biz = r.j.token;
    r = await call("GET", "/my/business", null, biz); assert.equal(r.j, null);
    r = await call("PUT", "/my/business", { name: "Shop", category: "Retail", description: "Stuff", contact: "s@x.test" }, biz); assert.equal(r.s, 200);
    r = await call("POST", `/businesses/${r.j.id}/enquiries`, { message: "Hi" }, sam); assert.equal(r.s, 201);
    r = await call("GET", "/my/leads", null, biz); assert.equal(r.j[0].from_name, "Sam");
    r = await call("GET", "/me"); assert.equal(r.s, 401);
    console.log("All API checks passed");
  } catch (e) { console.error("FAILED", e); process.exitCode = 1; }
  srv.close();
});
