"use strict";
// Front-end logic. All data comes from the REST API (see ../backend).
const API = window.API_BASE || "/api";
const CATS = ["Environment", "Health", "Education", "Community", "Safety"];
let token = null, me = null, view = "home", note = "", q = "", fc = "All";
try { token = localStorage.getItem("acs_token"); } catch (e) {}

async function api(method, path, body) {
  let r;
  try {
    r = await fetch(API + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token && { Authorization: "Bearer " + token }) },
      body: body && JSON.stringify(body)
    });
  } catch (e) { throw new Error("Cannot reach the server. Is the backend running?"); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && token) setSession(null, null);
    throw new Error(j.error || "Request failed");
  }
  return j;
}
function setSession(t, u) {
  token = t; me = u;
  try { t ? localStorage.setItem("acs_token", t) : localStorage.removeItem("acs_token"); } catch (e) {}
}
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = id => document.getElementById(id);
function go(v, n) { view = v; note = n || ""; render(); }

function nav() {
  const items = [["home", "Home"], ["causes", "Causes"], ["biz", "Businesses"]];
  if (me) {
    items.push(["create", "New campaign"], ["dash", "My dashboard"]);
    if (me.role === "business") items.push(["bizform", "My business"]);
    if (me.role === "admin") items.push(["admin", "Admin"]);
  }
  let h = items.map(([v, t]) => `<button class="${view === v ? "on" : ""}" data-go="${v}">${t}</button>`).join("");
  h += me
    ? `<button data-act="logout">Log out (${esc(me.name.split(" ")[0])})</button>`
    : `<button data-go="login">Log in</button><button class="pri" data-go="register">Register</button>`;
  $("nav").innerHTML = h;
}

function causeCard(c, adm) {
  const actions = adm
    ? `<button class="pri" data-act="approve" data-id="${c.id}">Approve</button><button class="bad" data-act="reject" data-id="${c.id}">Reject</button>`
    : c.status === "approved"
      ? `<button class="${c.supported ? "" : "pri"}" data-act="support" data-id="${c.id}">${c.supported ? "Supporting ✓" : "Support this cause"}</button>`
      : "";
  return `<article class="card"><span class="tag">${esc(c.category)}${c.status !== "approved" ? " · " + esc(c.status) : ""}</span><strong>${esc(c.title)}</strong><span class="mute">${esc(c.description)}</span><span class="mute">By ${esc(c.owner)} · ${c.supporters} supporter${c.supporters === 1 ? "" : "s"}</span><div class="row">${actions}</div></article>`;
}
const bizCard = b => `<article class="card"><span class="tag">${esc(b.category)}</span><strong>${esc(b.name)}</strong><span class="mute">${esc(b.description)}</span><div class="row"><button data-act="enquire" data-id="${b.id}">Send enquiry</button></div></article>`;
const grid = (items, fn, empty) => `<div class="grid">${items.map(fn).join("") || `<p class="mute">${empty}</p>`}</div>`;
const causeQuery = () => `/causes?q=${encodeURIComponent(q)}${fc !== "All" ? "&category=" + encodeURIComponent(fc) : ""}`;

const views = {
  async home() {
    const [c, b] = await Promise.all([api("GET", "/causes"), api("GET", "/businesses")]);
    return `<div class="hero"><h1>Create, discover and support social causes</h1><p>Join community campaigns, and find small local businesses that give back.</p><div class="row" style="margin-top:12px"><button data-go="causes">Browse causes</button>${me ? "" : `<button data-go="register">Join now</button>`}</div></div>
    <h2>Featured campaigns</h2>${grid(c.slice(0, 3), x => causeCard(x), "No campaigns yet.")}
    <h2>Local business promotions</h2>${grid(b.slice(0, 3), bizCard, "No listings yet.")}`;
  },
  async causes() {
    const c = await api("GET", causeQuery());
    return `<h1>Causes</h1><div class="row"><div style="flex:2;min-width:180px"><input id="q" placeholder="Search causes" aria-label="Search causes" value="${esc(q)}"></div><div style="flex:1;min-width:140px"><select id="fc" aria-label="Category">${["All", ...CATS].map(x => `<option ${x === fc ? "selected" : ""}>${x}</option>`).join("")}</select></div></div>
    <div id="clist" style="margin-top:14px">${grid(c, x => causeCard(x), "No causes match.")}</div>`;
  },
  async biz() { return `<h1>Business listings</h1>${grid(await api("GET", "/businesses"), bizCard, "No listings yet.")}`; },
  async login() {
    return `<h1>Log in</h1><form data-form="login"><label>Email<input name="email" type="email" required></label><label>Password<input name="password" type="password" required></label><p><button class="pri">Log in</button></p></form>`;
  },
  async register() {
    return `<h1>Create an account</h1><form data-form="register"><label>Full name<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Password (min 6)<input name="password" type="password" minlength="6" required></label><label>I am a<select name="role"><option value="user">Registered user</option><option value="business">Business owner</option></select></label><p><button class="pri">Register</button></p></form>`;
  },
  async create() {
    return `<h1>Create a campaign</h1><p class="mute">New campaigns are reviewed by an administrator before they are published.</p><form data-form="cause"><label>Title<input name="title" required maxlength="80"></label><label>Category<select name="category">${CATS.map(c => `<option>${c}</option>`).join("")}</select></label><label>Description<textarea name="description" rows="4" required maxlength="400"></textarea></label><p><button class="pri">Submit for approval</button></p></form>`;
  },
  async bizform() {
    const b = (await api("GET", "/my/business")) || {};
    const v = k => esc(b[k] || "");
    return `<h1>${b.id ? "Edit" : "Create"} business profile</h1><form data-form="biz"><label>Business name<input name="name" required value="${v("name")}"></label><label>Type<input name="category" required value="${v("category")}"></label><label>What you offer<textarea name="description" rows="3" required>${v("description")}</textarea></label><label>Contact email<input name="contact" type="email" required value="${v("contact") || esc(me.email)}"></label><p><button class="pri">Save listing</button></p></form>`;
  },
  async dash() {
    const [mine, leads] = await Promise.all([api("GET", "/my/causes"), me.role === "business" ? api("GET", "/my/leads") : []]);
    return `<h1>Hi, ${esc(me.name)}</h1><p class="mute">${esc(me.email)} · role: ${esc(me.role)}</p>
    <h2>Profile</h2><form data-form="profile"><label>Display name<input name="name" value="${esc(me.name)}" required></label><label>Bio<textarea name="bio" rows="2">${esc(me.bio)}</textarea></label><p><button>Save profile</button></p></form>
    <h2>My campaigns</h2>${grid(mine, x => causeCard(x), "None yet.")}
    ${me.role === "business" ? `<h2>Leads from enquiries</h2>${leads.length ? `<div class="tbl"><table><tr><th>From</th><th>Message</th></tr>${leads.map(l => `<tr><td>${esc(l.from_name)} (${esc(l.from_email)})</td><td>${esc(l.message)}</td></tr>`).join("")}</table></div>` : "<p class='mute'>No enquiries yet.</p>"}` : ""}`;
  },
  async admin() {
    const [p, users] = await Promise.all([api("GET", "/admin/causes/pending"), api("GET", "/admin/users")]);
    return `<h1>Administration</h1><h2>Campaigns awaiting review (${p.length})</h2>${grid(p, x => causeCard(x, true), "Nothing to review.")}
    <h2>Users</h2><div class="tbl"><table><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr>${users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${u.role === "admin" ? "" : `<button class="bad" data-act="deluser" data-id="${u.id}">Remove</button>`}</td></tr>`).join("")}</table></div>`;
  }
};

async function render() {
  if (["create", "dash", "bizform"].includes(view) && !me) { view = "login"; note = note || "Please log in first."; }
  if (view === "admin" && (!me || me.role !== "admin")) view = "home";
  nav();
  let html;
  try { html = await views[view](); } catch (e) { html = `<div class="msg" role="alert">${esc(e.message)}</div>`; }
  nav(); // session may have been cleared by an expired token
  $("app").innerHTML = (note ? `<div class="msg" role="status">${esc(note)}</div>` : "") + html;
  window.scrollTo(0, 0);
}
// Run an action, then move to a view with a message (or show the error)
async function act(fn, nextView, okMsg) {
  try { await fn(); go(nextView || view, okMsg); } catch (e) { go(view, e.message); }
}

document.addEventListener("click", e => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.go) return go(t.dataset.go);
  const a = t.dataset.act, id = t.dataset.id;
  if (a === "logout") { setSession(null, null); return go("home", "You have been logged out."); }
  if (["support", "enquire"].includes(a) && !me) return go("login", "Please log in first.");
  if (a === "support") act(() => api("POST", `/causes/${id}/support`));
  if (a === "enquire") {
    const m = prompt("Your message to this business:");
    if (m) act(() => api("POST", `/businesses/${id}/enquiries`, { message: m }), view, "Enquiry sent.");
  }
  if (a === "approve" || a === "reject") act(() => api("POST", `/admin/causes/${id}/${a}`), "admin", a === "approve" ? "Campaign published." : "Campaign rejected.");
  if (a === "deluser") act(() => api("DELETE", `/admin/users/${id}`), "admin", "User removed.");
});

let timer;
document.addEventListener("input", e => {
  if (e.target.id === "q") { q = e.target.value; clearTimeout(timer); timer = setTimeout(refreshList, 250); }
  if (e.target.id === "fc") { fc = e.target.value; refreshList(); }
});
async function refreshList() {
  try { $("clist").innerHTML = grid(await api("GET", causeQuery()), x => causeCard(x), "No causes match."); } catch (e) {}
}

document.addEventListener("submit", e => {
  e.preventDefault();
  const k = e.target.dataset.form, d = Object.fromEntries(new FormData(e.target));
  if (k === "login") act(async () => { const r = await api("POST", "/auth/login", d); setSession(r.token, r.user); }, "home", "Welcome back.");
  if (k === "register") act(async () => { const r = await api("POST", "/auth/register", d); setSession(r.token, r.user); }, d.role === "business" ? "bizform" : "home", "Account created. You are logged in.");
  if (k === "cause") act(() => api("POST", "/causes", d), "dash", "Campaign submitted. An admin will review it before it goes live.");
  if (k === "biz") act(() => api("PUT", "/my/business", d), "biz", "Business listing saved.");
  if (k === "profile") act(async () => { me = await api("PUT", "/me", d); }, "dash", "Profile updated.");
});

(async () => {
  if (token) { try { me = await api("GET", "/me"); } catch (e) { token = null; } }
  render();
})();
