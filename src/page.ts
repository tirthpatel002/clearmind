export const PAGE = String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Clearmind</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#0f1115;--card:#171a21;--line:#262a33;--fg:#e6e8ec;--mute:#8b93a1;--acc:#7cc4ff;--ok:#5fd38d;--bad:#ff6b6b;--warn:#ffc65c}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--fg)}
header{display:flex;align-items:center;gap:12px;padding:14px 22px;border-bottom:1px solid var(--line)}
header h1{font-size:18px;margin:0}header .tag{color:var(--mute)}header .sp{margin-left:auto;color:var(--mute);font-size:12px}
main{display:grid;grid-template-columns:1.3fr 1fr;gap:16px;padding:16px 22px}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute);margin:0 0 10px}
.mem{border-top:1px solid var(--line);padding:8px 0}.mem:first-of-type{border-top:0}
.mem.replaced{opacity:.5}.mem.replaced .t{text-decoration:line-through}
.meta{color:var(--mute);font-size:12px}.pill{display:inline-block;padding:0 7px;border-radius:9px;background:#222733;margin-right:4px;font-size:11px}
.bar{height:4px;background:#222733;border-radius:2px;width:80px;display:inline-block;vertical-align:middle}.bar i{display:block;height:4px;border-radius:2px;background:var(--acc)}
button{background:#232836;color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 9px;cursor:pointer;font-size:12px}button:hover{border-color:var(--acc)}
input{background:#0f1218;color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:6px 8px;font-size:13px}
.row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.row input{flex:1;min-width:90px}
.ALLOWED,.allowed{color:var(--ok)}.DENIED,.denied{color:var(--bad)}.warn{color:var(--warn)}
.log{font-family:ui-monospace,monospace;font-size:12px;max-height:260px;overflow:auto}
.ans{background:#10141b;border:1px solid var(--line);border-radius:8px;padding:10px;margin-top:8px;white-space:pre-wrap}
.hist{margin:6px 0 0 14px;border-left:2px solid var(--line);padding-left:8px}
</style></head><body>
<header><h1>Clearmind</h1><span class="tag">memory you can see, correct and trust</span><span class="sp" id="sp"></span></header>
<main>
<div>
<section><h2>Memories</h2>
<div class="row"><input id="mt" placeholder="Remember something…"><input id="mtags" placeholder="tags (work,health)" style="max-width:150px"><input id="mkey" placeholder="key (optional)" style="max-width:130px"><button onclick="remember()">Remember</button></div>
<div id="mems"></div></section>
<section style="margin-top:16px"><h2>Ask (Nemotron, policy enforced)</h2>
<div class="row"><input id="q" placeholder="Ask a question…"></div>
<div class="row"><input id="qa" placeholder="as agent (empty = me)"><input id="qp" placeholder="purpose"><input id="qt" placeholder="scope tags"><button onclick="ask()">Ask</button></div>
<div id="ans"></div></section>
</div>
<div>
<section><h2>Access grants</h2>
<div class="row"><input id="ga" placeholder="agent"><input id="gt" placeholder="scope tags"><input id="gp" placeholder="purposes"><input id="gm" placeholder="minutes" style="max-width:80px"><button onclick="grant()">Grant</button></div>
<div id="grants"></div></section>
<section style="margin-top:16px"><h2>Access log</h2><div class="log" id="log"></div></section>
<section style="margin-top:16px"><h2>Learning</h2><div id="learn"></div></section>
</div></main>
<script>
const $=id=>document.getElementById(id), esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tags=s=>s.split(",").map(x=>x.trim()).filter(Boolean);
async function api(p,b){const r=await fetch(p,b===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});const j=await r.json();if(!r.ok)throw new Error(j.error);return j}
const bar=c=>'<span class="bar"><i style="width:'+Math.round(c*100)+'%"></i></span> '+c.toFixed(2);
async function load(){const s=await api("/api/state");
 $("sp").textContent=(s.online?"Nebius online":"offline")+" · spend $"+s.spendUsd.toFixed(4)+" · owner "+s.owner;
 const act=s.memories.filter(m=>m.status==="active");
 $("mems").innerHTML=act.map(m=>'<div class="mem" id="m-'+m.id+'"><div class="t">'+esc(m.text)+'</div><div class="meta">'+m.tags.map(t=>'<span class="pill">#'+esc(t)+'</span>').join("")+(m.key?'<span class="pill">key '+esc(m.key)+'</span>':'')+' conf '+bar(m.confidence)+(m.confirmations?' · confirmed ×'+m.confirmations:'')+(m.supersedes.length?' · <a href="#" onclick="hist(\''+m.id+'\');return false" style="color:var(--acc)">history</a>':'')+' · <button onclick="confirmM(\''+m.id+'\')">Still true</button> <button onclick="edit(\''+m.id+'\')">Correct</button></div><div id="h-'+m.id+'"></div></div>').join("")||'<div class="meta">No memories yet.</div>';
 $("grants").innerHTML=s.grants.map(g=>{const st=g.revokedAt?'<span class="denied">revoked</span>':(g.expiresAt&&Date.parse(g.expiresAt)<Date.now()?'<span class="warn">expired</span>':'<span class="allowed">active</span>');
  return '<div class="mem"><b>'+esc(g.agentId)+'</b> '+st+' <span class="meta">scope '+g.tags.map(esc).join(",")+' · purposes '+g.purposes.map(esc).join(",")+(g.expiresAt?' · until '+new Date(g.expiresAt).toLocaleString():'')+'</span> '+(g.revokedAt?'':'<button onclick="revoke(\''+g.grantId+'\')">Revoke</button>')+'</div>'}).join("")||'<div class="meta">No grants.</div>';
 $("log").innerHTML=s.log.map(e=>'<div>#'+e.seq+' '+new Date(e.at).toLocaleTimeString()+' '+e.action+' <b>'+esc(e.agentId)+'</b> <span class="'+e.decision+'">'+e.decision+'</span> purpose='+esc(e.purpose??"-")+' — '+esc(e.reason)+'</div>').join("");
 let L="";
 L+='<div class="meta">Conflicts</div>'+(s.conflicts.map(c=>'<div class="mem warn">⚠ '+esc(txt(s,c.a))+' <br>vs '+esc(txt(s,c.b))+'<div class="meta">'+esc(c.reason)+'</div></div>').join("")||'<div class="mem meta">none</div>');
 L+='<div class="meta" style="margin-top:8px">Patterns</div>'+(s.patterns.map(p=>'<div class="mem">'+esc(p.label)+' <span class="meta">support '+p.support+' · conf '+bar(p.confidence)+'</span><div class="meta">evidence: '+p.evidence.map(id=>esc(txt(s,id))).join(" | ")+'</div></div>').join("")||'<div class="mem meta">none yet</div>');
 L+='<div class="meta" style="margin-top:8px">Agent lessons</div>'+(Object.entries(s.lessons).flatMap(([a,ls])=>ls.map(l=>'<div class="mem"><b>'+esc(a)+'</b> <span class="pill">'+esc(l.status)+'</span> '+esc(l.text)+'<div class="meta">when: '+esc(l.trigger)+'</div></div>')).join("")||'<div class="mem meta">none</div>');
 $("learn").innerHTML=L;}
const txt=(s,id)=>(s.memories.find(m=>m.id===id)||{text:id}).text;
async function remember(){await api("/api/memories",{text:$("mt").value,tags:tags($("mtags").value),key:$("mkey").value});$("mt").value="";load()}
async function confirmM(id){await api("/api/memories/"+id+"/confirm",{});load()}
async function edit(id){const t=prompt("Corrected text:");if(t){await api("/api/memories/"+id+"/update",{text:t});load()}}
async function hist(id){const h=await api("/api/memories/"+id+"/history");$("h-"+id).innerHTML='<div class="hist">'+h.map(m=>'<div class="mem '+m.status+'"><span class="t">'+esc(m.text)+'</span> <span class="meta">'+m.status+' · '+new Date(m.createdAt).toLocaleString()+'</span></div>').join("")+'</div>'}
async function grant(){await api("/api/grants",{agentId:$("ga").value,tags:tags($("gt").value),purposes:tags($("gp").value),ttlMin:$("gm").value});load()}
async function revoke(id){await api("/api/grants/"+id+"/revoke",{});load()}
async function ask(){$("ans").innerHTML='<div class="ans meta">thinking…</div>';try{const r=await api("/api/ask",{question:$("q").value,agentId:$("qa").value,purpose:$("qp").value,tags:tags($("qt").value)});
 $("ans").innerHTML='<div class="ans"><span class="'+r.decision+'">'+r.decision+'</span> '+esc(r.answer)+(r.usage?'<div class="meta">'+esc(r.usage.model)+' · '+r.usage.ms+' ms · $'+r.usage.usd.toFixed(5)+'</div>':'')+'</div>'}catch(e){$("ans").innerHTML='<div class="ans denied">'+esc(e.message)+'</div>'}load()}
load();setInterval(load,4000);
</script></body></html>`;
