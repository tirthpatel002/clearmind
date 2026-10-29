// Single-page web app for Clearmind (served locally). No external assets.
export const PAGE = String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Clearmind</title>
<style>
:root{--bg:#f6f7fb;--card:#fff;--ink:#141824;--mute:#6b7280;--line:#e6e8ef;--brand:#4f46e5;--brand2:#eef2ff;--ok:#059669;--okbg:#ecfdf5;--no:#dc2626;--nobg:#fef2f2;--warn:#b45309;--warnbg:#fffbeb;--r:14px}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink)}
header{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.9);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.bar{max-width:1280px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:16px}
.logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px}.logo i{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#22d3ee);display:inline-block}
.tag{color:var(--mute);font-size:13px}.sp{flex:1}
.pill{font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--mute);white-space:nowrap}
.pill.on{color:var(--ok);border-color:#a7f3d0;background:var(--okbg)}
nav.steps{max-width:1280px;margin:0 auto;padding:0 24px 10px;display:flex;gap:6px;flex-wrap:wrap}
nav.steps a{font-size:12px;text-decoration:none;color:var(--mute);padding:4px 10px;border-radius:999px;background:#f1f2f6}
nav.steps a.done{background:var(--brand2);color:var(--brand)}nav.steps a b{margin-right:4px}
main{max-width:1280px;margin:0 auto;padding:20px 24px 60px;display:grid;grid-template-columns:1.15fr 1fr;gap:20px}
@media(max-width:1000px){main{grid-template-columns:1fr}}
section{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:18px 20px;box-shadow:0 1px 2px rgba(16,24,40,.04)}
section h2{margin:0 0 2px;font-size:16px;display:flex;align-items:center;gap:8px}.num{width:22px;height:22px;border-radius:50%;background:var(--brand);color:#fff;font-size:12px;display:inline-flex;align-items:center;justify-content:center}
section .sub{color:var(--mute);margin:0 0 14px;font-size:13px}.col{display:flex;flex-direction:column;gap:20px}
.mem{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start}
.mem.replaced{opacity:.55;background:#fafafa}.mem .t{flex:1}.mem .meta{font-size:12px;color:var(--mute);margin-top:2px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.chip{font-size:11px;padding:1px 8px;border-radius:999px;background:#f1f2f6;color:#374151}.chip.work{background:#eef2ff;color:#4338ca}.chip.health{background:#fef2f2;color:#b91c1c}.chip.food{background:#fff7ed;color:#c2410c}.chip.travel{background:#ecfeff;color:#0e7490}.chip.family{background:#fdf4ff;color:#a21caf}
.conf{width:56px;height:6px;border-radius:9px;background:#eef0f4;overflow:hidden;display:inline-block;vertical-align:middle}.conf>i{display:block;height:100%;background:linear-gradient(90deg,#818cf8,#4f46e5)}
button{font:inherit;font-size:13px;border:1px solid var(--line);background:#fff;border-radius:9px;padding:6px 12px;cursor:pointer;color:var(--ink)}button:hover{border-color:#c7cbe0}
button.p{background:var(--brand);border-color:var(--brand);color:#fff}button.p:hover{background:#4338ca}button.d{color:var(--no)}button.s{padding:3px 9px;font-size:12px}
input,select,textarea{font:inherit;font-size:13px;border:1px solid var(--line);border-radius:9px;padding:7px 10px;background:#fff;width:100%}textarea{resize:vertical}
.row{display:flex;gap:8px;align-items:center}.row>*{flex:1}.row>button,.row>.fit{flex:0 0 auto}
label.l{font-size:12px;color:var(--mute);display:block;margin:8px 0 4px}
.result{margin-top:12px;border-radius:12px;padding:12px 14px;border:1px solid var(--line)}.result.allowed{background:var(--okbg);border-color:#a7f3d0}.result.denied{background:var(--nobg);border-color:#fecaca}
.badge{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:2px 8px;border-radius:6px}.badge.allowed{background:var(--ok);color:#fff}.badge.denied{background:var(--no);color:#fff}
.log{max-height:260px;overflow:auto;font-size:12.5px}.log div{display:grid;grid-template-columns:62px 90px 1fr;gap:8px;padding:6px 0;border-bottom:1px dashed var(--line)}.log .ts{color:var(--mute)}
.grant{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:8px;display:flex;gap:10px;align-items:center}.grant .t{flex:1;font-size:13px}.grant.off{opacity:.55}
.scopes{display:flex;gap:6px;flex-wrap:wrap}.scopes label{display:flex;gap:4px;align-items:center;font-size:12px;border:1px solid var(--line);border-radius:999px;padding:3px 10px;cursor:pointer}.scopes input{width:auto;margin:0}
.consent{display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px}.consent input{width:auto}
.card2{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:8px}.card2 h4{margin:0 0 4px;font-size:13px;display:flex;gap:8px;align-items:center}
.k{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:2px 7px;border-radius:6px}.k.c{background:var(--warnbg);color:var(--warn)}.k.p{background:var(--brand2);color:var(--brand)}.k.l{background:var(--okbg);color:var(--ok)}
.ev{font-size:12px;color:var(--mute);margin:2px 0 0 0;padding-left:16px}.empty{color:var(--mute);font-size:13px;padding:8px 0}
.hist{margin:6px 0 0;padding:8px 10px;background:#f8f9fc;border-radius:8px;font-size:12px}.hist div{padding:2px 0}.hist s{color:var(--mute)}
.answer{font-size:14px;margin-top:6px}.cite{font-family:ui-monospace,monospace;font-size:11px;background:#fff;border:1px solid var(--line);border-radius:5px;padding:0 4px}
.tabs{display:flex;gap:4px;margin-bottom:10px}.tabs button{border-radius:999px;font-size:12px}.tabs button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
footer{max-width:1280px;margin:0 auto;padding:0 24px 30px;color:var(--mute);font-size:12px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;padding:8px 16px;border-radius:10px;font-size:13px;opacity:0;transition:opacity .2s;pointer-events:none}.toast.on{opacity:1}
</style></head><body>
<header><div class="bar"><div class="logo"><i></i>Clearmind</div><div class="tag">The memory layer you can see, correct and trust</div><div class="sp"></div>
<span class="pill" id="model">offline</span><span class="pill" id="spend">$0.0000</span><span class="pill" id="who">owner</span></div>
<nav class="steps" id="steps"></nav></header>
<main>
<div class="col">
<section id="s-mem"><h2><span class="num">1</span>Your memory</h2><p class="sub">Everything your agents can know about you. Correct a memory and the old version is kept as history, never silently returned.</p>
<div class="row"><input id="newText" placeholder="Remember something… e.g. Dentist appointment on Nov 8 at 17:00"><select id="newTag" class="fit" style="width:110px"><option>work</option><option>health</option><option>food</option><option>travel</option><option>family</option></select><button class="p" onclick="addMem()">Remember</button></div>
<div class="tabs" style="margin-top:12px" id="memTabs"></div><div id="mems" style="max-height:540px;overflow:auto;padding-right:4px"></div></section>
<section id="s-learn"><h2><span class="num">5</span>What Clearmind learned</h2><p class="sub">Conflicts to resolve, patterns from repeated facts (3+ facts over 2+ days, with evidence), and lessons agents distilled with Nemotron from their own failures.</p><div id="learn"></div></section>
</div>
<div class="col">
<section id="s-agent"><h2><span class="num">2</span>An agent asks</h2><p class="sub">Agents must say why they want to read. Nemotron answers only from memories the policy allows and cites them.</p>
<div class="row"><div><label class="l">Agent</label><select id="aAgent"><option value="calendar-agent">calendar-agent</option><option value="shopping-agent">shopping-agent</option><option value="owner">me (owner)</option></select></div>
<div><label class="l">Purpose</label><input id="aPurpose" placeholder="(none)"></div><div><label class="l">Scope asked</label><select id="aTags"><option value="">any granted</option><option>work</option><option>health</option><option>food</option><option>travel</option><option>family</option></select></div></div>
<label class="l">Question</label><div class="row"><input id="aQ" value="When is my team standup?"><button class="p" id="askBtn" onclick="ask()">Ask</button></div><div id="aOut"></div></section>
<section id="s-grant"><h2><span class="num">3</span>Grant access</h2><p class="sub">Consent is explicit: which agent, which scopes, for what purpose, until when. Revoke any time.</p>
<div class="row"><div><label class="l">Agent</label><select id="gAgent"><option>calendar-agent</option><option>shopping-agent</option></select></div><div><label class="l">Purpose</label><input id="gPurpose" value="schedule-meetings"></div><div><label class="l">Expires</label><select id="gTtl"><option value="60">in 1 hour</option><option value="1440">in 1 day</option><option value="10080">in 7 days</option><option value="">never</option></select></div></div>
<label class="l">Scopes</label><div class="scopes" id="gScopes"></div>
<div class="row" style="margin-top:6px"><label class="consent fit"><input type="checkbox" id="gConsent"> I consent to this agent reading these memories for this purpose</label><button class="p" onclick="grant()">Grant</button></div>
<div id="grants" style="margin-top:12px"></div></section>
<section id="s-log"><h2><span class="num">4</span>Access log</h2><p class="sub">Every read attempt, allowed or denied, with purpose and the memories it saw.</p><div class="log" id="log"></div></section>
</div></main>
<footer>Runs locally · answers by NVIDIA Nemotron on Nebius Token Factory · recall by Qwen3-Embedding-8B hybrid search · built on agentmemory</footer>
<div class="toast" id="toast"></div>
<script>
const $=id=>document.getElementById(id);const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const SCOPES=["work","health","food","travel","family"];let S=null,tab="active",editing=null,openHist={};
$("gScopes").innerHTML=SCOPES.map(t=>'<label><input type="checkbox" value="'+t+'"'+(t==="work"?" checked":"")+'>'+t+'</label>').join("");
const toast=m=>{const t=$("toast");t.textContent=m;t.classList.add("on");setTimeout(()=>t.classList.remove("on"),1800)};
async function api(p,b){const r=await fetch(p,b===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});const j=await r.json();if(!r.ok)throw new Error(j.error||r.status);return j}
const ago=iso=>{const d=(Date.now()-Date.parse(iso))/1000;if(d<60)return"just now";if(d<3600)return Math.floor(d/60)+"m ago";if(d<86400)return Math.floor(d/3600)+"h ago";return Math.floor(d/86400)+"d ago"};
const hm=iso=>new Date(iso).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
const chip=t=>'<span class="chip '+esc(t)+'">'+esc(t)+'</span>';const short=id=>esc(String(id).slice(-6));
function memText(id){const m=S.memories.find(x=>x.id===id);return m?m.text:id}
function renderMems(){const all=S.memories,act=all.filter(m=>m.status==="active"),rep=all.filter(m=>m.status!=="active");
 $("memTabs").innerHTML=[["active","Current ("+act.length+")"],["replaced","Corrected history ("+rep.length+")"]].map(([k,l])=>'<button class="'+(tab===k?"on":"")+'" onclick="tab=\''+k+'\';renderMems()">'+l+'</button>').join("");
 const list=(tab==="active"?act:rep).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 $("mems").innerHTML=list.map(m=>{const ed=editing===m.id;return '<div class="mem '+(m.status!=="active"?"replaced":"")+'"><div class="t">'+(ed?'<div class="row"><input id="ed-'+m.id+'" value="'+esc(m.text)+'"><button class="p s" onclick="saveEdit(\''+m.id+'\')">Save correction</button><button class="s" onclick="editing=null;renderMems()">Cancel</button></div>':esc(m.text))+
 '<div class="meta">'+m.tags.map(chip).join("")+'<span>'+ago(m.createdAt)+'</span><span title="confidence (rises when confirmed, decays over time)"><span class="conf"><i style="width:'+Math.round(m.confidence*100)+'%"></i></span> '+m.confidence.toFixed(2)+'</span>'+(m.confirmations?'<span>✓ confirmed '+m.confirmations+'×</span>':'')+(m.supersedes.length?'<a href="#" onclick="return toggleHist(\''+m.id+'\')">corrected · history</a>':'')+(m.status!=="active"?'<span>replaced</span>':'')+'</div>'+
 (openHist[m.id]?'<div class="hist">'+openHist[m.id].map((h,i)=>'<div>'+(i===0?'<b>now</b> ':'<s>')+esc(h.text)+(i===0?'':'</s>')+' <span style="color:var(--mute)">· '+ago(h.createdAt)+'</span></div>').join("")+'</div>':'')+
 '</div>'+(m.status==="active"&&!ed?'<div class="row fit" style="flex:0 0 auto"><button class="s" onclick="confirmMem(\''+m.id+'\')" title="Still true: raises confidence">Still true</button><button class="s" onclick="editing=\''+m.id+'\';renderMems()">Correct</button></div>':'')+'</div>'}).join("")||'<div class="empty">Nothing here yet.</div>'}
async function toggleHist(id){if(openHist[id]){delete openHist[id]}else{openHist[id]=await api("/api/memories/"+id+"/history")}renderMems();return false}
function renderGrants(){const g=S.grants.slice().reverse();$("grants").innerHTML=g.map(x=>{const off=x.revokedAt||(x.expiresAt&&Date.parse(x.expiresAt)<Date.now());return '<div class="grant '+(off?"off":"")+'"><div class="t"><b>'+esc(x.agentId)+'</b> may read '+x.tags.map(chip).join(" ")+' for <b>'+esc(x.purposes.join(", "))+'</b><div class="meta" style="font-size:12px;color:var(--mute)">consent by '+esc(x.consentBy)+' · '+(x.revokedAt?'revoked '+ago(x.revokedAt):x.expiresAt?(off?'expired':'expires '+new Date(x.expiresAt).toLocaleString()):'no expiry')+'</div></div>'+(off?'':'<button class="d s" onclick="revoke(\''+x.grantId+'\')">Revoke</button>')+'</div>'}).join("")||'<div class="empty">No agent has access yet.</div>'}
function renderLog(){$("log").innerHTML=S.log.slice(0,60).map(e=>'<div><span class="ts">'+hm(e.at)+'</span><span><span class="badge '+(e.decision==="denied"?"denied":"allowed")+'">'+(e.action==="read"?e.decision:e.action)+'</span></span><span><b>'+esc(e.agentId)+'</b> '+(e.action==="read"?'read'+(e.purpose?' for <i>'+esc(e.purpose)+'</i>':' <i>with no purpose</i>')+(e.memoryIds.length?' · saw '+e.memoryIds.length+' memor'+(e.memoryIds.length>1?'ies':'y'):''):'')+' <span style="color:var(--mute)">— '+esc(e.reason)+'</span></span></div>').join("")||'<div class="empty">No access yet.</div>'}
function renderLearn(){let h="";
 for(const c of S.conflicts)h+='<div class="card2"><h4><span class="k c">Conflict</span>'+esc(c.reason)+'</h4><div class="ev">A: '+esc(memText(c.a))+' <button class="s" onclick="tab=\'active\';editing=\''+c.a+'\';renderMems();location.hash=\'s-mem\'">Correct</button></div><div class="ev">B: '+esc(memText(c.b))+' <button class="s" onclick="tab=\'active\';editing=\''+c.b+'\';renderMems();location.hash=\'s-mem\'">Correct</button></div></div>';
 for(const p of S.patterns)h+='<div class="card2"><h4><span class="k p">Pattern</span>'+esc(p.terms.join(" · "))+' <span style="color:var(--mute);font-weight:400">'+p.support+' facts over '+p.distinctDays+' days · confidence '+p.confidence.toFixed(2)+'</span></h4><ul class="ev">'+p.evidence.map(id=>'<li>'+esc(memText(id))+'</li>').join("")+'</ul></div>';
 for(const [a,ls] of Object.entries(S.lessons))for(const l of ls)h+='<div class="card2"><h4><span class="k l">Lesson</span>'+esc(a)+' learned from a failed run</h4><div>'+esc(l.text)+'</div><div class="ev">when: '+esc(l.trigger)+' · '+esc(l.status)+'</div></div>';
 $("learn").innerHTML=h||'<div class="empty">Nothing learned yet.</div>'}
function renderSteps(){const reads=S.log.filter(e=>e.action==="read"&&e.agentId!=="owner");const corrected=S.memories.some(m=>m.status!=="active");
 const st=[["s-mem","Correct a memory",corrected],["s-agent","Agent asks without purpose → denied",reads.some(e=>e.decision==="denied")],["s-grant","Grant with consent, scope, expiry",S.grants.length>0],["s-log","Allowed and logged",reads.some(e=>e.decision==="allowed")],["s-grant","Revoke → denied again",S.grants.some(g=>g.revokedAt)],["s-learn","Conflicts, patterns, lessons",S.conflicts.length+S.patterns.length>0]];
 $("steps").innerHTML=st.map((s,i)=>'<a href="#'+s[0]+'" class="'+(s[2]?"done":"")+'"><b>'+(s[2]?"✓":(i+1))+'</b>'+s[1]+'</a>').join("")}
async function load(){if(editing)return;S=await api("/api/state");$("model").textContent=S.online?"Nemotron-3 Ultra · Token Factory":"offline";$("model").classList.toggle("on",S.online);$("spend").textContent="Nebius spend $"+S.spendUsd.toFixed(4);$("who").textContent="signed in as "+S.owner;renderMems();renderGrants();renderLog();renderLearn();renderSteps()}
async function addMem(){const t=$("newText").value.trim();if(!t)return;const m=await api("/api/memories",{text:t,tags:[$("newTag").value]});$("newText").value="";toast(m.confirmed?"Already known: confirmed":"Remembered");load()}
async function saveEdit(id){const t=$("ed-"+id).value.trim();editing=null;await api("/api/memories/"+id+"/update",{text:t});toast("Corrected; old version kept in history");tab="active";load()}
async function confirmMem(id){await api("/api/memories/"+id+"/confirm",{});toast("Confirmed: confidence up");load()}
async function grant(){if(!$("gConsent").checked){toast("Tick the consent box first");return}const tags=[...document.querySelectorAll("#gScopes input:checked")].map(i=>i.value);if(!tags.length){toast("Pick at least one scope");return}
 await api("/api/grants",{agentId:$("gAgent").value,tags,purposes:[$("gPurpose").value.trim()||"*"],ttlMin:$("gTtl").value||null});$("gConsent").checked=false;toast("Access granted");load()}
async function revoke(id){await api("/api/grants/"+id+"/revoke",{});toast("Access revoked");load()}
async function ask(){const b=$("askBtn");b.disabled=true;b.textContent="Asking…";$("aOut").innerHTML="";
 try{const agentId=$("aAgent").value,r=await api("/api/ask",{question:$("aQ").value,agentId,purpose:$("aPurpose").value.trim()||null,tags:$("aTags").value?[$("aTags").value]:[]});
 const ans=esc(r.answer).replace(/\[([0-9A-Z]{10,})\]/g,(_,id)=>'<span class="cite" title="'+esc(memText(id))+'">'+id.slice(-6)+'</span>');
 $("aOut").innerHTML='<div class="result '+r.decision+'"><span class="badge '+r.decision+'">'+r.decision+'</span> <span style="color:var(--mute);font-size:12px">'+esc(r.reason)+'</span>'+(r.decision==="allowed"?'<div class="answer">'+ans+'</div>'+(r.memories.length?'<div class="ev" style="padding:0;margin-top:6px">Saw: '+r.memories.map(m=>esc(m.text)).join(" · ")+'</div>':'')+(r.usage?'<div class="ev" style="padding:0">'+esc(r.usage.model)+' · '+r.usage.ms+' ms · $'+r.usage.usd.toFixed(5)+'</div>':''):'')+'</div>'}
 catch(e){$("aOut").innerHTML='<div class="result denied">'+esc(e.message)+'</div>'}finally{b.disabled=false;b.textContent="Ask";load()}}
$("aQ").addEventListener("keydown",e=>{if(e.key==="Enter")ask()});$("newText").addEventListener("keydown",e=>{if(e.key==="Enter")addMem()});
load();setInterval(()=>{if(document.activeElement?.tagName!=="INPUT")load()},5000);
</script></body></html>`;
