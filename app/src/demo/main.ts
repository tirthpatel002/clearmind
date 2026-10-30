// Clearmind hackathon demo UI: chat composer docked at the bottom, feature tabs in the top notch.
import "./demo.css";

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const usd = (n: number) => (n === 0 ? "$0" : n < 0.0001 ? `$${n.toFixed(8)}` : n < 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(4)}`);
const short = (id: string) => id.slice(-6);
async function api(path: string, body?: unknown): Promise<any> {
  const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j;
}

const TABS = [
  ["chat", "Chat"], ["inspect", "Recall inspector"], ["timeline", "Changed facts"], ["learning", "Learning"],
  ["privacy", "Privacy"], ["numbers", "Numbers"], ["credits", "Credits"],
] as const;
type Tab = (typeof TABS)[number][0];
const S = { tab: "chat" as Tab, chat: [] as any[], cfg: null as any, lastQ: "", session: `s-${Date.now().toString(36)}`, busy: false, texts: new Map<string, string>(), flash: new Set<string>() };

function renderTabs() {
  $("#tabs").innerHTML = TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" class="${S.tab === k ? "on" : ""}">${l}${k === "learning" ? '<span class="exp"> exp</span>' : ""}</button>`).join("");
}
function renderWallet(w = S.cfg?.wallet) {
  if (!w) return;
  const p = $("#creditsPill");
  p.innerHTML = `Demo credits <b>$${w.balanceUsd.toFixed(4)}</b>`;
  p.classList.toggle("low", w.balanceUsd < (S.cfg?.minBalance ?? 0.005));
}
function go(t: Tab) { S.tab = t; renderTabs(); void render(); }

const cites = (s: string) => esc(s).replace(/\[([0-9A-Z]{10,})\]/g, (_, id) => `<span class="cite" data-mem="${id}" title="Open memory">${short(id)}</span>`);

function chatItem(m: any): string {
  if (m.role === "user") return `<div class="msg user"><span>${esc(m.q)}</span></div>`;
  if (m.pending) return `<div class="msg"><div class="card spin">Recalling memories and asking Nemotron...</div></div>`;
  if (m.error) return `<div class="msg"><div class="card refused">${esc(m.error)}</div></div>`;
  const r = m.r;
  if (r.refused) return `<div class="msg"><div class="card refused"><h3>Not enough demo credits</h3><p>${esc(r.reason)}</p><button class="btn dark" data-act="topup">Top up $5.00 demo credits</button></div></div>`;
  const pctSent = r.tokens.fullHistory ? Math.min(100, (r.tokens.sent / r.tokens.fullHistory) * 100) : 0;
  const learn = (r.learning ?? []).filter((x: any) => x.after).map((x: any) => `<span class="chip lilac" title="experimental">helpfulness ${x.before?.helpMean ?? 0.5} &rarr; <b>${x.after.helpMean}</b> (n=${x.after.count}) &middot; ${short(x.after.id)}</span>`).join("");
  const body = r.abstained
    ? `<div class="card abstain"><div class="big">I don't know.</div><p style="margin:4px 0 0">${esc(r.reason)}</p><div class="metrics"><span class="chip">evidence <b>${r.evidence.toFixed(2)}</b> / threshold ${r.threshold}</span><span class="chip">memories cited: 0</span></div>`
    : `<div class="card"><p class="ans">${cites(r.answer)}</p>
       <div class="k">Memories used:</div>${r.cited.map((c: any) => `<div><span class="cite" data-mem="${c.id}">${short(c.id)}</span> ${esc(c.text)}</div>`).join("") || '<div class="k">none cited</div>'}`;
  return `<div class="msg">${body}
    <div class="metrics" style="margin-top:10px">
      <span class="chip sky">recall <b>${r.recallMs} ms</b></span><span class="chip">reader ${r.answerMs} ms</span>
      <span class="chip">tokens sent <b>${r.tokens.sent.toLocaleString()}</b> vs full history ${r.tokens.fullHistory.toLocaleString()} <span class="k">(${r.tokens.memories} memories)</span></span>
      <span class="chip good">cost <b>${usd(r.cost.usd)}</b> vs ${usd(r.cost.fullUsd)} full history</span>
      <span class="chip">balance ${usd(r.wallet.balanceUsd)}</span>
      <button class="chip" data-act="inspectq" data-q="${esc(r.q)}">inspect recall &rarr;</button>
    </div>
    <div class="bar" title="share of full history sent"><i style="width:${pctSent.toFixed(1)}%"></i></div>
    ${learn ? `<div class="metrics">${learn}<span class="chip warn">learning: experimental</span></div>` : ""}
  </div></div>`;
}

async function viewChat() {
  if (!S.chat.length) return `<div class="empty"><h1>Chat with your <b>memory</b></h1><p>Every answer shows the memories it used, recall latency, tokens sent vs full history, and its real cost in demo credits.</p>
    <p>${["What time is my standup?", "When does my Goa flight leave?", "Who is my manager?", "What is my passport number?", "How do I reach my dentist?"].map((q) => `<button class="btn" data-act="ask" data-q="${q}">${q}</button>`).join(" ")}</p></div>`;
  return S.chat.map(chatItem).join("");
}

async function viewInspect() {
  const q = S.lastQ;
  const head = `<h1>Recall <b>inspector</b></h1><p class="lead">How one question is answered: keyword (BM25) hits, vector (Qwen3) hits, Reciprocal Rank Fusion, then what the engine kept and cut.</p>
    <form class="row" id="inspForm"><input id="iq" value="${esc(q)}" placeholder="Question to inspect"/><button class="btn dark">Inspect</button></form>`;
  if (!q) return head + `<div class="empty">Ask something in the composer, or type a question above.</div>`;
  const r = await api(`/api/demo/inspect?q=${encodeURIComponent(q)}`);
  const tbl = (xs: any[], cols: string) => `<table><tr><th>#</th><th>memory</th><th>${cols}</th></tr>${xs.map((x, i) => `<tr><td class="n">${i + 1}</td><td>${esc(x.text)} <span class="id">${short(x.id)}</span></td><td class="n">${x.score}</td></tr>`).join("") || '<tr><td colspan=3 class="k">no hits</td></tr>'}</table>`;
  return head + `<div class="metrics" style="margin-bottom:10px"><span class="chip sky">recall <b>${r.recallMs} ms</b></span><span class="chip">fusion ${r.fusion}, rrfK ${r.rrfK}</span><span class="chip">k = ${r.k}</span><span class="chip">evidence ${r.evidence} ${r.abstained ? "(abstain)" : ""}</span></div>
    <div class="grid3"><div class="card"><h3>Keyword hits (BM25)</h3>${tbl(r.keyword, "bm25")}</div>
    <div class="card"><h3>Vector hits (cosine)</h3>${tbl(r.vector, "cos")}</div>
    <div class="card"><h3>RRF fused</h3><table><tr><th>#</th><th>memory</th><th>kw</th><th>vec</th><th>rrf</th></tr>${r.fused.map((x: any, i: number) => `<tr class="${x.inFinal ? "kept" : "cut"}"><td class="n">${i + 1}</td><td>${esc(x.text)}</td><td class="n">${x.kwRank ?? "-"}</td><td class="n">${x.vecRank ?? "-"}</td><td class="n">${x.score}</td></tr>`).join("")}</table></div></div>
    <div class="grid2"><div class="card"><h3>Engine's final ranking (sent to reader)</h3><table><tr><th>#</th><th>memory</th><th>score</th></tr>${r.final.map((x: any) => `<tr class="${x.kept ? "kept" : "cut"}"><td class="n">${x.rank}</td><td>${esc(x.text)}</td><td class="n">${x.score?.toFixed?.(3) ?? "-"}</td></tr>`).join("")}</table></div>
    <div class="card"><h3>Cut</h3><table>${r.cut.map((x: any) => `<tr class="cut"><td>${esc(x.text)}</td><td class="n">${x.score}</td><td class="k">${esc(x.why)}</td></tr>`).join("") || '<tr><td class="k">nothing cut</td></tr>'}</table></div></div>
    <p class="k">${esc(r.note)}</p>`;
}

async function viewTimeline() {
  const r = await api("/api/demo/timeline");
  const items = [...r.items].reverse();
  return `<h1>Changed <b>facts</b></h1><p class="lead">When a fact changes, the old memory is superseded: struck through, linked to its replacement, and never returned by recall again. ${r.superseded} superseded so far.</p>
    <div class="card"><h3>What changed</h3>${r.changed.filter((i: any) => i.status === "replaced").map((i: any) => `<div style="margin-bottom:8px"><span class="old"><span class="t">${esc(i.text)}</span></span> <span class="arrow">&rarr;</span> <a href="#" data-jump="${i.replacedBy}"><b>${esc(i.replacedByText)}</b></a></div>`).join("") || '<div class="k">No corrections yet.</div>'}</div>
    <div class="card"><h3>All memories, newest first</h3><div class="tl">${items.map((i: any) => `<div class="it ${i.status === "replaced" ? "old" : ""}" id="tl-${i.id}">
      <span class="k">${i.createdAt.slice(0, 16).replace("T", " ")} UTC</span> <span class="id">${short(i.id)}</span>${i.key ? ` <span class="chip">${esc(i.key)}</span>` : ""}
      <div class="t">${esc(i.text)}</div>
      ${i.replacedBy ? `<div><span class="arrow">&rarr; replaced by</span> <a href="#" class="cite" data-jump="${i.replacedBy}">${short(i.replacedBy)}</a> ${esc(i.replacedByText)}</div>` : ""}
      ${i.supersedes.length ? `<div class="k">supersedes ${i.supersedes.map((s: string) => `<a href="#" class="cite" data-jump="${s}">${short(s)}</a>`).join(" ")}</div>` : ""}
    </div>`).join("")}</div></div>`;
}

async function viewLearning() {
  if (!S.cfg.learning) return `<h1>Learning <b>from use</b></h1><div class="card">retrieval.learning is off in this config.</div>`;
  const r = await api("/api/demo/learning");
  return `<h1>Learning <b>from use</b> <span class="note">experimental</span></h1><p class="lead">Each time an answer cites a memory, its helpfulness (Beta mean) rises, its recency activation (ACT-R) is refreshed, and memories cited together get a co-use link. Shown memories that are not cited count as not used.</p>
    <div class="card"><table><tr><th>memory</th><th>helpfulness (Beta mean)</th><th>used / not used</th><th>recency activation</th><th>co-use links</th></tr>
    ${r.items.map((x: any) => `<tr class="${S.flash.has(x.id) ? "flash" : ""}"><td>${esc(x.text)} <span class="id">${short(x.id)}</span></td><td><b>${x.helpMean}</b><div class="bar"><i style="width:${x.helpMean * 100}%;background:var(--lilacInk)"></i></div></td><td class="n">${x.used} / ${Number(x.notUsed).toFixed(2)}</td><td class="n">${x.activation ?? "-"} <span class="k">(${x.accesses} uses)</span></td><td>${x.links.map((l: any) => `<div class="k">${esc(l.text.slice(0, 40))} <b>${l.w}</b></div>`).join("") || "-"}</td></tr>`).join("") || '<tr><td colspan=5 class="k">No usage yet. Ask a question in the composer.</td></tr>'}</table></div>`;
}

async function viewPrivacy() {
  const [p, a] = await Promise.all([api("/api/demo/privacy"), api("/api/demo/audit")]);
  return `<h1>Privacy <b>controls</b></h1><p class="lead">Redact replaces detected emails, phones, cards and keys with a tag and hard-deletes the original. Hard forget deletes the row and its vector; recall can never return it. Every action is audited.</p>
    <div class="grid2"><div class="card"><h3>Memories</h3><table>${p.items.map((m: any) => `<tr id="pv-${m.id}"><td>${esc(m.text)} ${m.sensitive.length ? `<span class="chip warn">${m.sensitive.join(", ")}</span>` : ""}</td><td style="white-space:nowrap">${m.sensitive.length ? `<button class="btn" data-act="redact" data-id="${m.id}">Redact</button> ` : ""}<button class="btn red" data-act="forget" data-id="${m.id}">Hard forget</button></td></tr>`).join("")}</table></div>
    <div class="card"><h3>Audit log</h3><p class="k">Privacy actions plus the hash-chained store log (writes, updates, deletes; recall reads hidden here).</p><table><tr><th>when (IST)</th><th>action</th><th>ids</th><th>detail</th></tr>${a.items.filter((e: any) => e.op !== "recall").slice(0, 40).map((e: any) => `<tr><td class="n">${new Date(e.at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}</td><td><b>${esc(e.op)}</b> <span class="k">${e.source}</span></td><td class="id">${e.ids.slice(0, 4).map(short).join(" ")}${e.ids.length > 4 ? ` +${e.ids.length - 4}` : ""}</td><td class="k">${esc(e.detail)}</td></tr>`).join("") || '<tr><td colspan=4 class="k">empty</td></tr>'}</table></div></div>`;
}

async function viewNumbers() {
  const r = await api("/api/demo/numbers");
  if (!r.available) return `<h1>Numbers</h1><div class="card">No eval report found.</div>`;
  const pc = (x: number) => `${(x * 100).toFixed(1)}%`;
  return `<h1>LongMemEval-S <b>numbers</b></h1><p class="lead">Latest run, ${r.scored}/${r.total} questions scored (updated ${new Date(r.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST). Reader ${esc(r.reader)}, judge ${esc(r.judge)}.</p>
    <p><span class="note">${esc(r.note)}</span></p>
    <div class="grid3">
      <div class="card"><div class="k">QA accuracy</div><div class="big">${pc(r.accuracy)}</div></div>
      <div class="card"><div class="k">Abstention</div><div class="big">${r.abstention.absCorrect}/${r.abstention.absQuestions}</div><div class="k">correct abstentions; false abstain ${r.abstention.falseAbstain}/${r.abstention.answerable}</div></div>
      <div class="card"><div class="k">Tokens to reader / question</div><div class="big">${r.tokens.meanIn.toLocaleString()}</div><div class="k">vs ${r.tokens.meanFull.toLocaleString()} full history (${pc(r.tokens.meanIn / r.tokens.meanFull)})</div><div class="bar"><i style="width:${(r.tokens.meanIn / r.tokens.meanFull) * 100}%"></i></div></div>
      <div class="card"><div class="k">Recall latency p50 / p95</div><div class="big">${r.latency.recallP50} ms</div><div class="k">p95 ${r.latency.recallP95} ms; answer p50 ${(r.latency.answerP50 / 1000).toFixed(1)} s</div></div>
      <div class="card"><div class="k">Reader cost / question</div><div class="big">${usd(r.cost.perQuestionUsd)}</div><div class="k">total ${usd(r.cost.totalUsd)} so far</div></div>
      <div class="card"><div class="k">By type</div>${Object.entries(r.types).map(([t, v]: any) => `<div>${esc(t)}: <b>${v.ok}/${v.n}</b></div>`).join("")}</div>
    </div>`;
}

async function viewCredits() {
  const c = (S.cfg = await api("/api/demo/config")), w = c.wallet, s = w.sessions[S.session] ?? { usd: 0, fullUsd: 0, answers: 0 };
  renderWallet(w);
  return `<h1>Cost &amp; <b>credits</b></h1><p class="lead">Demo credits only: stored locally in the app's data folder, no real payments. Each answer deducts its real computed cost: Qwen3 embedding tokens + Nemotron reader tokens at the configured prices.</p>
    <div class="grid3">
      <div class="card"><div class="k">Demo credit balance</div><div class="big">$${w.balanceUsd.toFixed(4)}</div><div class="k">started at $${c.startCredit.toFixed(2)}; ${w.answers} answers</div><p><button class="btn dark" data-act="topup">Top up $5.00 (demo)</button> <button class="btn" data-act="drain">Set to $0.001 (test refusal)</button></p></div>
      <div class="card"><div class="k">This session</div><div class="big">${usd(s.usd)}</div><div class="k">${s.answers} answers; full history would have cost ${usd(s.fullUsd)}</div><div class="bar"><i style="width:${s.fullUsd ? Math.min(100, (s.usd / s.fullUsd) * 100) : 0}%"></i></div></div>
      <div class="card"><div class="k">Prices (USD / 1M tokens)</div><div>Reader <b>${esc(c.reader)}</b>: in $${c.prices.reader.in}, out $${c.prices.reader.out}</div><div>Embeddings <b>${esc(c.embed)}</b>: in $${c.prices.embed.in}</div></div>
    </div>
    ${S.chat.filter((m) => m.r && !m.r.refused).slice(-1).map((m) => `<div class="card"><h3>Last answer, cost breakdown</h3><table><tr><th>call</th><th>model</th><th>tokens in / out</th><th>cost</th></tr>${m.r.cost.lines.map((l: any) => `<tr><td>${l.kind}</td><td>${esc(l.model)}</td><td class="n">${l.promptTokens} / ${l.completionTokens}</td><td class="n">${usd(l.usd)}</td></tr>`).join("")}<tr><td colspan=3><b>total</b></td><td class="n"><b>${usd(m.r.cost.usd)}</b></td></tr></table></div>`).join("")}`;
}

const VIEWS: Record<Tab, () => Promise<string>> = { chat: viewChat, inspect: viewInspect, timeline: viewTimeline, learning: viewLearning, privacy: viewPrivacy, numbers: viewNumbers, credits: viewCredits };

async function render() {
  const el = $("#content"), t = S.tab;
  try {
    const html = await VIEWS[t]();
    if (S.tab !== t) return;
    el.innerHTML = html;
    if (t === "chat") el.scrollTop = el.scrollHeight;
  } catch (e) { el.innerHTML = `<div class="card refused">${esc((e as Error).message)}</div>`; }
}

async function ask(q: string) {
  if (S.busy || !q.trim()) return;
  S.busy = true; S.lastQ = q; ($("#q") as HTMLInputElement).value = "";
  const btn = $<HTMLButtonElement>(".send"); btn.disabled = true;
  S.chat.push({ role: "user", q }, { role: "bot", pending: true });
  if (S.tab !== "chat") go("chat"); else void render();
  const slot = S.chat[S.chat.length - 1];
  try {
    slot.r = await api("/api/demo/ask", { q, session: S.session });
    if (S.cfg) S.cfg.wallet = slot.r.wallet; renderWallet(slot.r.wallet);
    for (const x of slot.r.learning ?? []) S.flash.add(x.after?.id);
    for (const m of slot.r.shown ?? []) S.texts.set(m.id, m.text);
  } catch (e) { slot.error = (e as Error).message; }
  slot.pending = false; S.busy = false; btn.disabled = false;
  if (S.tab === "chat") void render();
}

function openMem(id: string) {
  const d = $("#drawer");
  d.innerHTML = `<button class="btn" style="float:right" data-act="close">close</button><h3>Memory <span class="id">${esc(id)}</span></h3><p>${esc(S.texts.get(id) ?? "")}</p><p><button class="btn" data-act="jump" data-id="${id}">Show in timeline</button></p>`;
  d.classList.add("on");
}

document.addEventListener("click", async (ev) => {
  const t = ev.target as HTMLElement;
  const tab = t.closest<HTMLElement>("[data-tab]"); if (tab) return go(tab.dataset.tab as Tab);
  const mem = t.closest<HTMLElement>("[data-mem]"); if (mem) return openMem(mem.dataset.mem!);
  const jump = t.closest<HTMLElement>("[data-jump]");
  const a = t.closest<HTMLElement>("[data-act]");
  if (jump || a?.dataset.act === "jump") {
    ev.preventDefault(); const id = jump?.dataset.jump ?? a!.dataset.id!; $("#drawer").classList.remove("on");
    if (S.tab !== "timeline") { S.tab = "timeline"; renderTabs(); await render(); }
    const n = document.getElementById(`tl-${id}`); n?.scrollIntoView({ block: "center" }); n?.classList.add("flash"); return;
  }
  if (!a) return;
  const act = a.dataset.act;
  if (act === "close") $("#drawer").classList.remove("on");
  if (act === "ask") void ask(a.dataset.q!);
  if (act === "inspectq") { S.lastQ = a.dataset.q!; go("inspect"); }
  if (act === "topup") { const w = await api("/api/demo/topup", { usd: 5 }); S.cfg.wallet = w; renderWallet(w); void render(); }
  if (act === "drain") { const w = await api("/api/demo/set-balance", { usd: 0.001 }); S.cfg.wallet = w; renderWallet(w); void render(); }
  if (act === "forget" || act === "redact") {
    if (act === "forget" && !confirm("Hard-delete this memory permanently?")) return;
    a.textContent = "..."; await api(`/api/demo/${act}`, { id: a.dataset.id }); void render();
  }
});
document.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const f = ev.target as HTMLElement;
  if (f.id === "composer") void ask(($("#q") as HTMLInputElement).value);
  if (f.id === "inspForm") { S.lastQ = ($("#iq") as HTMLInputElement).value; void render(); }
});

(async () => {
  renderTabs();
  S.cfg = await api("/api/demo/config");
  $("#model").textContent = `reader ${S.cfg.reader} · embeddings ${S.cfg.embed} · on Nebius`;
  renderWallet();
  for (const m of (await api("/api/demo/timeline")).items) S.texts.set(m.id, m.text);
  void render();
})();
