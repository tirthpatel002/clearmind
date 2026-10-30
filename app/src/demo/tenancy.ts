// Workspace sign-in: a "Continue as" picker (no OAuth) and a top-bar user switcher.
// Only active when the server has workspace users configured (GET /api/session -> workspace: true).
type U = { id: string; name: string; role: "admin" | "member" | "guest"; title?: string; org?: string };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
const sub = (u: U) => [u.title, u.org].filter(Boolean).join(" · ");

export async function initTenancy(base: string, forcePicker = false): Promise<void> {
  const cred: RequestCredentials = base ? "include" : "same-origin";
  const get = async (p: string) => (await fetch(base + p, { credentials: cred })).json();
  let s: any;
  try { s = await get("/api/session"); } catch { return; }
  if (!s?.workspace) return;
  const users: U[] = (await get("/api/workspace/users")).users ?? [];
  const pick = async (id: string) => {
    const r = await fetch(base + "/api/session", { method: "POST", credentials: cred, headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: id }) });
    if (r.ok) location.reload();
  };
  const signOut = async () => { await fetch(base + "/api/session", { method: "DELETE", credentials: cred }); location.reload(); };

  const picker = (dismissable: boolean) => new Promise<void>(() => {
    const admin = users.filter((u) => u.role === "admin"), guest = users.filter((u) => u.role === "guest"), people = users.filter((u) => u.role === "member");
    const card = (u: U, cls = "") => `<button class="wsu ${cls}" data-uid="${esc(u.id)}" data-k="${esc(`${u.name} ${u.title ?? ""} ${u.org ?? ""}`.toLowerCase())}"><span class="av">${esc(initials(u.name))}</span><span class="t"><b>${esc(u.name)}</b>${sub(u) ? `<small>${esc(sub(u))}</small>` : ""}</span></button>`;
    const m = document.createElement("div");
    m.className = "wsmodal";
    m.innerHTML = `<div class="wsbox" role="dialog" aria-modal="true" aria-labelledby="wsh"><h2 id="wsh">Continue as</h2><p class="lead">Pick who you are. What you see depends on who it is shared with.</p>
      ${admin.map((u) => card(u, "adm")).join("")}
      <input class="wsq" type="search" placeholder="Search judges by name, title or company" aria-label="Search people" />
      <div class="wslist" role="list">${people.map((u) => card(u)).join("")}<p class="wsnone" hidden>No match.</p></div>
      <button class="wsu gst" data-new="1"><span class="av">?</span><span class="t"><b>Not on the list?</b><small>Tell us your name; you will see workspace items plus your own</small></span></button>
      <form class="wsnew" hidden><label>Your name <input class="wsname" maxlength="60" required autocomplete="name" /></label><button type="submit">Continue</button>${guest.map((u) => ` <button type="button" class="wslink" data-uid="${esc(u.id)}">or browse as ${esc(u.name)}</button>`).join("")}<p class="wserr" role="alert" hidden></p></form>
    </div>`;
    document.body.append(m);
    const q = m.querySelector<HTMLInputElement>(".wsq")!;
    q.addEventListener("input", () => {
      const v = q.value.trim().toLowerCase(); let n = 0;
      m.querySelectorAll<HTMLElement>(".wslist .wsu").forEach((b) => { const ok = !v || b.dataset.k!.includes(v); b.hidden = !ok; if (ok) n++; });
      m.querySelector<HTMLElement>(".wsnone")!.hidden = n > 0;
    });
    const form = m.querySelector<HTMLFormElement>(".wsnew")!, nameIn = m.querySelector<HTMLInputElement>(".wsname")!, err = m.querySelector<HTMLElement>(".wserr")!;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = nameIn.value.trim();
      if (!name || name.length > 60) { err.textContent = "Enter a name (1-60 characters)."; err.hidden = false; return; }
      const r = await fetch(base + "/api/workspace/users", { method: "POST", credentials: cred, headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { err.textContent = j.error ?? "Could not add you"; err.hidden = false; return; }
      await pick(j.id);
    });
    m.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-new]")) { form.hidden = false; nameIn.focus(); return; }
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-uid]");
      if (b) void pick(b.dataset.uid!);
      else if (dismissable && e.target === m) m.remove();
    });
    m.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); if (dismissable) m.remove(); return; }
      if (e.key === "Tab") { // keep focus inside the dialog
        const f = [...m.querySelectorAll<HTMLElement>("button:not([hidden]),input")].filter((x) => !x.closest("[hidden]"));
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f.at(-1)!.focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0]!.focus(); }
      }
    });
    (m.querySelector<HTMLElement>(".wsu.adm") ?? q).focus();
  });

  if (!s.viewer || forcePicker) { if (!document.querySelector(".wsmodal")) void picker(false); return; } // never resolves: the page reloads after a pick

  const me: U = s.profile ?? { id: s.viewer.id, name: s.viewer.id, role: s.viewer.admin ? "admin" : "member" };
  const top = document.querySelector(".topbar")!;
  const w = document.createElement("div");
  w.className = "wsme";
  w.innerHTML = `<button class="wsbtn" aria-haspopup="menu" aria-expanded="false" title="${esc(sub(me) || me.name)}"><span class="av">${me.role === "guest" ? "?" : esc(initials(me.name))}</span>${esc(me.name)} <span aria-hidden="true">▾</span></button>
    <div class="wsmenu" role="menu" hidden><div class="wsr">${esc(me.role === "admin" ? "Sees everything" : me.role === "guest" ? "Sees workspace-shared items" : "Sees workspace items + shared with you")}</div><button role="menuitem" data-ws="switch">Switch user</button><button role="menuitem" data-ws="out">Sign out</button></div>`;
  top.append(w);
  const btn = w.querySelector<HTMLButtonElement>(".wsbtn")!, menu = w.querySelector<HTMLElement>(".wsmenu")!;
  const set = (on: boolean) => { menu.hidden = !on; btn.setAttribute("aria-expanded", String(on)); if (on) menu.querySelector<HTMLElement>("button")!.focus(); };
  btn.addEventListener("click", () => set(menu.hidden === true));
  w.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) { set(false); btn.focus(); }
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !menu.hidden) {
      e.preventDefault(); const it = [...menu.querySelectorAll<HTMLElement>("button")]; const i = it.indexOf(document.activeElement as HTMLElement);
      it[(i + (e.key === "ArrowDown" ? 1 : it.length - 1)) % it.length]!.focus();
    }
  });
  document.addEventListener("click", (e) => { if (!w.contains(e.target as Node)) set(false); });
  menu.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>("[data-ws]")?.dataset.ws;
    if (a === "out") void signOut();
    if (a === "switch") { set(false); void picker(true); }
  });
}
