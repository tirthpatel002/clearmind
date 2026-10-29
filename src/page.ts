// Single-page dashboard for Clearmind (served locally). No external assets.
export const PAGE = String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Clearmind</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Ccircle cx=%278%27 cy=%278%27 r=%276%27 fill=%27%23B8EFA8%27/%3E%3C/svg%3E">
<style>
:root{--shell:#121212;--canvas:#F0F1EF;--card:#fff;--ink:#141414;--ink2:#3E4246;--mute:#8A8F98;--line:#E6E7E4;
--mint:#C9F2C0;--mint2:#B8EFA8;--mintInk:#2F6B2A;--lilac:#E3D6FA;--lilac2:#C9B3F5;--lilacInk:#5B3E96;--sky:#DDEFFB;--skyInk:#245A7A;--butter:#F7E7A6;--butterInk:#7A5B0E;--black:#1A1A1A;--red:#E5533D;--dot:#7BC96F;
--r:28px;--sans:"Manrope","Inter","SF Pro Display",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
*{box-sizing:border-box}html,body{margin:0;background:var(--shell)}body{font:15px/1.55 var(--sans);color:var(--ink);-webkit-font-smoothing:antialiased;padding:0 14px 14px}
:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
button{font:inherit;cursor:pointer;border:none;background:none;color:inherit}
/* ---------- shell + top notch ---------- */
.topbar{height:64px;display:flex;align-items:center;padding:0 18px;color:#fff;position:relative;z-index:3}
.brand{font-weight:800;font-size:21px;letter-spacing:-.02em}.brand i{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--mint2);margin-left:3px}
.user{margin-left:auto;display:flex;align-items:center;gap:10px;font-size:13px;color:#cfd2d6}.user b{color:#fff;font-weight:600;display:block;font-size:13.5px}
.av{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--mint2),var(--lilac2));display:grid;place-items:center;color:var(--ink);font-weight:800;font-size:13px}
.canvas{background:var(--canvas);border-radius:var(--r);min-height:calc(100vh - 78px);position:relative;padding:58px 34px 140px}
.notch{position:absolute;left:50%;transform:translateX(-50%);top:0;height:44px;background:var(--shell);border-radius:0 0 26px 26px;display:flex;align-items:center;gap:4px;padding:0 14px 6px;z-index:2}
.notch::before,.notch::after{content:"";position:absolute;top:0;width:28px;height:28px;background:radial-gradient(circle at 0 100%,transparent 27.5px,var(--shell) 28px)}
.notch::before{left:-27px;background:radial-gradient(circle at 0 100%,transparent 27.5px,var(--shell) 28px)}.notch::after{right:-27px;background:radial-gradient(circle at 100% 100%,transparent 27.5px,var(--shell) 28px)}
.notch a{display:flex;align-items:center;gap:8px;color:#bfc3c8;text-decoration:none;font-size:13.5px;padding:7px 14px;border-radius:999px;transition:background .15s,color .15s}
.notch a:hover{color:#fff}.notch a.on{background:#fff;color:var(--ink)}.notch svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8}
/* bottom dock notch */
body::after{content:"";position:fixed;left:0;right:0;bottom:0;height:14px;background:var(--shell);z-index:3}
.frameL,.frameR{position:fixed;bottom:14px;width:28px;height:28px;z-index:3;pointer-events:none}.frameL{left:14px;background:radial-gradient(circle at 100% 0,transparent 27.5px,var(--shell) 28px)}.frameR{right:14px;background:radial-gradient(circle at 0 0,transparent 27.5px,var(--shell) 28px)}
.dock{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);background:var(--shell);border-radius:26px 26px 0 0;padding:10px 16px 12px;display:flex;gap:10px;z-index:4}
.dock::before,.dock::after{content:"";position:absolute;bottom:0;width:26px;height:26px}
.dock::before{left:-25px;background:radial-gradient(circle at 0 0,transparent 25.5px,var(--shell) 26px)}.dock::after{right:-25px;background:radial-gradient(circle at 100% 0,transparent 25.5px,var(--shell) 26px)}
.dock button{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;color:var(--ink);transition:transform .15s}.dock button:hover{transform:translateY(-2px)}.dock svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.9}
.dock .sep{width:1px;background:#333;margin:6px 2px}
/* ---------- headings / progress ---------- */
.head{display:flex;align-items:flex-end;gap:24px;margin:0 6px 26px}
.head h1{font-size:44px;font-weight:300;letter-spacing:-.03em;line-height:1.05;margin:0}.head h1 b{font-weight:800}
.head .sp{flex:1}.prog{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--mute)}
.ticks{display:flex;gap:4px}.ticks i{width:5px;height:22px;border-radius:3px;background:#D6D8D5}.ticks i.on{background:var(--ink)}.ticks i.next{background:var(--red)}
#nextStep{color:var(--ink2)}
/* ---------- cards with notched pocket ---------- */
.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:18px}
.card{background:var(--card);border-radius:var(--r);padding:24px 26px;position:relative;box-shadow:0 1px 2px rgba(0,0,0,.03),0 10px 30px -18px rgba(0,0,0,.18);animation:fade .2s ease}
.card.pocket{-webkit-mask:radial-gradient(circle 29px at calc(100% - 25px) 25px,#0000 98%,#000 100%);mask:radial-gradient(circle 29px at calc(100% - 25px) 25px,#0000 98%,#000 100%)}
.badge{position:absolute;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;z-index:2}.badge svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.9}
.wrapc{position:relative;animation:fade .2s ease}.wrapc>.badge{top:4px;right:4px}
.card h3{font-size:19px;font-weight:700;letter-spacing:-.01em;margin:0 0 4px}.card .sub{color:var(--mute);font-size:13.5px;margin:0 0 18px;max-width:460px}
.mint{background:var(--mint)}.lilac{background:var(--lilac)}.sky{background:var(--sky)}.butter{background:var(--butter)}.blk{background:var(--black);color:#fff}
.hatch{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.16) 0 2px,transparent 2px 9px)}
.halftone{background:radial-gradient(circle,rgba(20,20,20,.55) 1.1px,transparent 1.6px) 0 0/9px 9px}
@keyframes fade{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
/* stats */
.tw{position:relative;animation:fade .2s ease}.tw .stat{-webkit-mask:radial-gradient(circle 23px at calc(100% - 20px) 20px,#0000 98%,#000 100%);mask:radial-gradient(circle 23px at calc(100% - 20px) 20px,#0000 98%,#000 100%)}
.tw.bl .stat{-webkit-mask:radial-gradient(circle 23px at 20px calc(100% - 20px),#0000 98%,#000 100%);mask:radial-gradient(circle 23px at 20px calc(100% - 20px),#0000 98%,#000 100%)}
.tw .tb{position:absolute;top:3px;right:3px;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;z-index:2}.tw.bl .tb{top:auto;right:auto;bottom:3px;left:3px}.tw.bl .stat .v{align-self:flex-end}
.tb svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2}
.toggles{display:inline-flex;background:#fff;border-radius:999px;padding:4px;box-shadow:0 6px 20px -16px rgba(0,0,0,.3)}.toggles button{padding:7px 16px;border-radius:999px;font-size:13px;font-weight:600;color:var(--mute)}.toggles button.on{background:var(--ink);color:#fff}
.dpill{display:inline-flex;align-items:center;gap:10px;background:var(--black);color:#fff;border-radius:999px;padding:7px 8px 7px 16px;font-size:13px}.dpill .ticks i{background:#3a3a3a;height:16px}.dpill .ticks i.on{background:var(--mint2)}.dpill .ticks i.next{background:var(--red)}
.dpill .nx{background:#fff;color:var(--ink);border-radius:999px;padding:4px 12px;font-weight:600}
.datep{display:inline-flex;align-items:center;gap:8px;background:#fff;border-radius:999px;padding:9px 16px;font-size:13px;font-weight:600;box-shadow:0 6px 20px -16px rgba(0,0,0,.3)}
.hright{display:flex;flex-direction:column;align-items:flex-end;gap:12px}.hright .r1{display:flex;gap:10px;align-items:center}
#constel .nd{cursor:default}#constel .nd text{opacity:0;transition:opacity .15s;pointer-events:none}#constel .nd:hover text,#constel .nd:focus text{opacity:1}#constel .nd:hover .core{stroke:#141414}

.stat{border-radius:22px;padding:16px 18px;min-height:112px;display:flex;flex-direction:column;justify-content:space-between}
.stat .v{font-size:40px;font-weight:800;letter-spacing:-.03em;line-height:1}.stat .k{font-size:13px;opacity:.75}
/* inputs */
input,select{font:inherit;font-size:14.5px;color:var(--ink);background:#F5F6F4;border:1px solid transparent;border-radius:14px;padding:11px 14px;width:100%;transition:border-color .15s,background .15s}
input:focus,select:focus{outline:none;background:#fff;border-color:var(--ink)}
.btn{border-radius:999px;padding:10px 18px;font-size:14px;font-weight:600;background:#F0F1EF;transition:background .15s,transform .15s}.btn:hover{background:#E6E7E4}
.btn.dark{background:var(--ink);color:#fff}.btn.dark:hover{background:#2a2a2a}.btn:disabled{opacity:.5}
.rb{width:34px;height:34px;border-radius:50%;display:inline-grid;place-items:center;background:#F0F1EF;font-size:13px;transition:background .15s}.rb:hover{background:#E3E5E1}.rb.dark{background:var(--ink);color:#fff}.rb svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2}
.row{display:flex;gap:10px;align-items:center}.row>*{flex:1}.row>.fit,.row>button{flex:0 0 auto}
label.l{font-size:12.5px;color:var(--mute);display:block;margin:14px 0 6px}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;padding:5px 12px;border-radius:999px}
/* views */
.view{display:none}.view.on{display:block}
/* memory timeline with dotted connectors */
.tl{position:relative;padding-left:26px}.tl::before{content:"";position:absolute;left:8px;top:18px;bottom:18px;border-left:2px dotted var(--dot)}
.tl .it{position:relative;margin-bottom:12px}.tl .it::before{content:"";position:absolute;left:-23px;top:22px;width:8px;height:8px;border-radius:50%;background:var(--dot);box-shadow:0 0 0 4px var(--canvas)}
.tl .it::after{content:"";position:absolute;left:-15px;top:25px;width:14px;border-top:2px dotted var(--dot)}
/* memory list */
.mem{display:flex;gap:14px;align-items:center;padding:14px 16px;border-radius:18px;background:#fff;margin-bottom:10px;box-shadow:0 8px 24px -20px rgba(0,0,0,.25);animation:fade .18s ease}
.mem .t{flex:1;min-width:0;font-size:15px}.mem .meta{font-size:12.5px;color:var(--mute);margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;opacity:0;max-height:0;overflow:hidden;transition:opacity .18s,max-height .18s}
.mem:hover .meta,.mem:focus-within .meta,.mem.open .meta{opacity:1;max-height:40px}
.mem .acts{display:flex;gap:6px;opacity:0;transition:opacity .15s}.mem:hover .acts,.mem:focus-within .acts{opacity:1}
.mem.replaced{background:transparent;box-shadow:none;border:1px dashed #D6D8D5}.mem.replaced .t>span{color:var(--mute);text-decoration:line-through}
.sw{width:10px;height:10px;border-radius:50%;flex:0 0 auto}.sw.work{background:#9CC7E6}.sw.health{background:#F2A99B}.sw.food{background:#E9CF73}.sw.travel{background:#9BDDB0}.sw.family{background:var(--lilac2)}
.conf{display:inline-block;width:44px;height:4px;border-radius:4px;background:#E6E7E4;overflow:hidden;vertical-align:2px;margin-right:6px}.conf i{display:block;height:100%;background:var(--ink)}
.corr{font-size:12px;font-weight:600;color:var(--lilacInk);background:var(--lilac);border-radius:999px;padding:2px 9px;margin-left:8px}
.tabs{display:inline-flex;background:#F0F1EF;border-radius:999px;padding:4px;margin:20px 0 14px}.tabs button{padding:7px 16px;border-radius:999px;font-size:13.5px;color:var(--mute)}.tabs button.on{background:var(--ink);color:#fff}
.hist{margin:10px 0 0;padding:10px 14px;background:var(--lilac);border-radius:14px;font-size:13.5px}.hist s{color:#7d6aa3}
/* ask result */
.result{margin-top:16px;padding:18px 20px;border-radius:22px;animation:fade .2s ease}.result.allowed{background:var(--mint)}.result.denied{background:var(--black);color:#fff}
.result .st{font-size:12.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.result .answer{font-size:18px;font-weight:600;letter-spacing:-.01em;margin:6px 0}
.cite{font-size:11.5px;font-weight:700;background:#fff;border-radius:999px;padding:1px 8px;cursor:help}.small{font-size:12.5px;color:var(--mute)}.result.denied .small,.result.denied .why{color:#c9cbcf}
.scopes{display:flex;gap:8px;flex-wrap:wrap}.scopes label{display:flex;gap:7px;align-items:center;font-size:13.5px;font-weight:600;border-radius:999px;padding:7px 14px;cursor:pointer;background:#F0F1EF;transition:background .15s}.scopes label:has(input:checked){background:var(--mint)}.scopes input{width:auto;margin:0;accent-color:var(--ink)}
.consent{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--ink2);margin-top:18px;cursor:pointer}.consent input{width:auto;margin-top:4px;accent-color:var(--ink)}
.grant{display:flex;gap:12px;align-items:center;padding:14px 16px;border-radius:18px;background:var(--mint);margin-bottom:10px}.grant .t{flex:1;font-size:14.5px}.grant.off{background:#F0F1EF;color:var(--mute)}
.rv{background:#fff;color:var(--red);font-weight:700;font-size:13px;border-radius:999px;padding:7px 14px}.rv:hover{background:var(--red);color:#fff}
/* log */
.log .e{display:grid;grid-template-columns:54px 92px 1fr;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid var(--line);font-size:14px;animation:fade .18s ease}.log .e:last-child{border:none}
.log .pill{justify-self:start;align-self:center}.log .ts{color:var(--mute);font-variant-numeric:tabular-nums}.w{justify-content:center}.w.allowed,.w.grant{background:var(--mint);color:var(--mintInk)}.w.denied{background:var(--black);color:#fff}.w.revoke{background:#FBE1DC;color:var(--red)}
/* insights */
.ins{border-radius:24px;padding:22px 24px;position:relative}.ins .kind{font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;opacity:.7}
.ins h4{font-size:20px;font-weight:700;letter-spacing:-.015em;margin:6px 0 8px;line-height:1.3}.ins ul{margin:6px 0 0;padding-left:18px;font-size:13.5px}
.ins details summary{cursor:pointer;font-size:13px;font-weight:700;list-style:none;display:inline-flex;background:rgba(255,255,255,.6);border-radius:999px;padding:4px 12px}.ins details summary::-webkit-details-marker{display:none}
.ins .inner{background:rgba(255,255,255,.55);border-radius:16px;padding:12px 14px;margin-top:10px;font-size:14px}
.vs{display:grid;grid-template-columns:1fr auto;gap:8px 12px;align-items:center}
.tilt{transform:rotate(-1.6deg)}
.empty{color:var(--mute);font-size:14px;padding:10px 0}
/* charts */
.lolli{display:flex;justify-content:space-between;align-items:flex-end;height:170px;margin-top:10px;padding:0 4px}
.lolli .c{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1}.lolli .stick{width:2px;background:#D9DBD8;border-radius:2px;position:relative}
.lolli .stick::before{content:"";position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:var(--ink)}
.lolli .stick.dn{background:transparent;border-left:2px dashed #BBB}.lolli .stick.z::before{background:#D9DBD8}
.lolli .d{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-size:12px;background:#F0F1EF;color:var(--mute)}.lolli .d.today{background:var(--ink);color:#fff}
.tip{position:absolute;top:-38px;left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;font-size:11.5px;padding:3px 9px;border-radius:999px;white-space:nowrap}
.legend{display:flex;gap:14px;font-size:12.5px;color:var(--mute);margin-top:6px}.legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:0}
footer{color:var(--mute);font-size:12.5px;margin:40px 6px 0}
.toast{position:fixed;bottom:96px;left:50%;transform:translate(-50%,8px);background:var(--ink);color:#fff;padding:10px 18px;border-radius:999px;font-size:14px;opacity:0;transition:opacity .18s,transform .18s;pointer-events:none;z-index:9}.toast.on{opacity:1;transform:translate(-50%,0)}
@media(max-width:1100px){.grid>*{grid-column:1/-1!important}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style></head><body>
<div class="topbar"><div class="brand">clearmind<i></i></div>
<div class="user"><div style="text-align:right"><b id="who">tirth</b><span id="model">offline</span></div><div class="av" id="av">T</div></div></div>
<div class="canvas">
<nav class="notch" aria-label="Sections" id="nav"></nav>
<!-- OVERVIEW -->
<div class="view" id="v-overview">
<div class="head"><h1>Your <b>memory</b>,<br>in your control</h1><div class="sp"></div><div class="hright"><div class="r1"><span class="datep" id="today"></span><div class="toggles" role="group" aria-label="Range" id="range"><button data-d="1">Today</button><button data-d="7" class="on">This week</button><button data-d="14">2 weeks</button></div></div><div class="dpill" aria-live="polite"><span id="progN"></span><div class="ticks" id="ticks"></div><span class="nx" id="nextStep"></span></div></div></div>
<div class="grid">
 <div style="grid-column:span 7" class="wrapc"><span class="badge rb dark" style="width:42px;height:42px"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="17" cy="19" r="2"/><path d="M7 7l3 3M17 8l-3 2.5M15.5 17.5L14 14"/></svg></span>
  <div class="card pocket"><h3>Memory constellation</h3><p class="sub">Each dot is something an agent may know about you. Lines are corrections, habits and conflicts.</p><svg id="constel" viewBox="0 0 600 280" style="width:100%;height:280px" role="img" aria-label="Memories grouped by scope"></svg>
  <div class="legend"><span><i style="background:#9CC7E6"></i>work</span><span><i style="background:#E9CF73"></i>food</span><span><i style="background:#F2A99B"></i>health</span><span><i style="background:#9BDDB0"></i>travel</span><span><i style="background:#C9B3F5"></i>family</span><span><i style="background:#7BC96F"></i>habit link</span><span><i style="background:#E5533D"></i>conflict</span></div></div></div>
 <div style="grid-column:span 5;display:grid;grid-template-columns:1fr 1fr;gap:14px;align-content:start" id="tiles"></div>
 <div style="grid-column:span 5" class="wrapc"><span class="badge rb" style="width:42px;height:42px;background:#fff"><svg viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/></svg></span>
  <div class="card pocket"><h3>Trust</h3><p class="sub">Average confidence across current memories. Rises when you confirm, fades with time.</p><svg id="gauge" viewBox="0 0 220 124" style="width:100%;max-width:300px;display:block;margin:0 auto"></svg></div></div>
 <div style="grid-column:span 7" class="wrapc"><span class="badge rb" style="width:42px;height:42px;background:#fff"><svg viewBox="0 0 24 24"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg></span>
  <div class="card pocket"><h3 id="lolliT">Agent reads, this week</h3><p class="sub">Every read attempt by an agent. Dark is allowed, dashed is denied.</p><div class="lolli" id="lolli"></div></div></div>
 <div style="grid-column:span 7"><div class="card"><h3>Recent access</h3><div class="log" id="logMini"></div></div></div>
 <div style="grid-column:span 5"><div class="card halftone-wrap" style="background:var(--black);color:#fff;overflow:hidden;position:relative;min-height:220px"><div class="halftone" style="position:absolute;inset:auto -20px -30px auto;width:70%;height:75%;opacity:.35;filter:invert(1);-webkit-mask:radial-gradient(ellipse at 100% 100%,#000 20%,transparent 70%);mask:radial-gradient(ellipse at 100% 100%,#000 20%,transparent 70%)"></div>
  <div class="pill" style="background:var(--mint);color:var(--ink)">Powered by</div><h3 style="font-size:26px;margin-top:14px;font-weight:300;letter-spacing:-.02em">NVIDIA <b style="font-weight:800">Nemotron-3 Ultra</b><br>on Nebius Token Factory</h3><p class="small" style="color:#a9adb3;max-width:300px">Answers only from memories the policy allows, and cites them. Qwen3 embeddings power hybrid recall.</p><div class="pill" style="background:#2a2a2a;color:#fff" id="spendPill">$0.000 spent</div></div></div>
 <div style="grid-column:1/-1"><h3 style="font-size:19px;margin:18px 6px 12px">Latest insights</h3><div class="grid" id="learnMini"></div></div>
</div></div>
<!-- MEMORY -->
<div class="view" id="v-memory"><div class="head"><h1>Your <b>memory</b></h1></div>
<div class="grid"><div style="grid-column:span 8"><div class="card" id="s-mem"><h3>Remember something</h3><p class="sub">Correcting a memory replaces it. The old version stays in history and is never returned again.</p>
<div class="row"><input id="newText" aria-label="New memory" placeholder="e.g. Dentist on Nov 8 at 17:00"><select id="newTag" class="fit" aria-label="Scope" style="width:120px"><option>work</option><option>health</option><option>food</option><option>travel</option><option>family</option></select><button class="btn dark" onclick="addMem()">Remember</button></div>
<div class="tabs" role="tablist" id="memTabs"></div><div class="tl" id="mems"></div></div></div>
<div style="grid-column:span 4;display:flex;flex-direction:column;gap:14px" id="memSide"></div></div></div>
<!-- ACCESS -->
<div class="view" id="v-access"><div class="head"><h1>Agents <b>&amp; access</b></h1></div>
<div class="grid"><div style="grid-column:span 6" class="wrapc"><span class="badge rb dark" style="width:42px;height:42px"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/></svg></span><div class="card pocket" id="s-agent"><h3>An agent asks</h3><p class="sub">Agents must say why they're reading. Nemotron answers only from what the policy allows, and cites it.</p>
<div class="row"><div><label class="l" for="aAgent">Agent</label><select id="aAgent"><option value="calendar-agent">calendar-agent</option><option value="shopping-agent">shopping-agent</option><option value="owner">me (owner)</option></select></div>
<div><label class="l" for="aPurpose">Purpose</label><input id="aPurpose" placeholder="none given"></div></div>
<label class="l" for="aTags">Scope</label><select id="aTags"><option value="">anything granted</option><option>work</option><option>health</option><option>food</option><option>travel</option><option>family</option></select>
<label class="l" for="aQ">Question</label><div class="row"><input id="aQ" value="When is my team standup?"><button class="btn dark" id="askBtn" onclick="ask()">Ask</button></div><div id="aOut" aria-live="polite"></div></div></div>
<div style="grid-column:span 6" class="wrapc"><span class="badge rb" style="width:42px;height:42px;background:var(--mint)"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg></span><div class="card pocket" id="s-grant"><h3>Grant access</h3><p class="sub">Consent is explicit: which agent, which parts of your memory, for what, and until when.</p>
<div class="row"><div><label class="l" for="gAgent">Agent</label><select id="gAgent"><option>calendar-agent</option><option>shopping-agent</option></select></div><div><label class="l" for="gTtl">Expires</label><select id="gTtl"><option value="60">in 1 hour</option><option value="1440">in 1 day</option><option value="10080">in 7 days</option><option value="">never</option></select></div></div>
<label class="l" for="gPurpose">Purpose</label><input id="gPurpose" value="schedule-meetings">
<label class="l">Scopes</label><div class="scopes" id="gScopes"></div>
<label class="consent"><input type="checkbox" id="gConsent"> I consent to this agent reading these memories for this purpose.</label>
<div style="margin-top:16px"><button class="btn dark" onclick="grant()">Grant access</button></div>
<h3 style="font-size:15px;margin:28px 0 10px">Grants</h3><div id="grants"></div></div></div></div></div>
<!-- LOG -->
<div class="view" id="v-log"><div class="head"><h1>Access <b>log</b></h1></div><div class="card"><p class="sub">Every attempt, allowed or not, with its purpose and what it saw.</p><div class="log" id="log"></div></div></div>
<!-- INSIGHTS -->
<div class="view" id="v-insights"><div class="head"><h1>What it <b>learned</b></h1></div><p class="sub" style="margin:-10px 6px 20px;color:var(--mute)">Conflicts to resolve, habits seen across days, and lessons agents took from their own mistakes.</p><div class="grid" id="learn"></div></div>
<footer>Runs locally on 127.0.0.1 · Answers by NVIDIA Nemotron on Nebius Token Factory · Recall by Qwen3 embeddings + BM25 · Built on agentmemory</footer>
</div>
<div class="frameL"></div><div class="frameR"></div><nav class="dock" aria-label="Quick actions">
<button class="sky" title="Remember something" aria-label="Remember something" onclick="go('memory','newText')"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
<button class="mint" title="Ask as an agent" aria-label="Ask as an agent" onclick="go('access','aQ')"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/></svg></button>
<button class="butter" title="Grant access" aria-label="Grant access" onclick="go('access','gPurpose')"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg></button>
<button class="lilac" title="Insights" aria-label="Insights" onclick="go('insights')"><svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z"/></svg></button>
<span class="sep"></span>
<button style="background:#2a2a2a;color:#fff" title="Access log" aria-label="Access log" onclick="go('log')"><svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h9"/></svg></button>
</nav>
<div class="toast" id="toast" role="status"></div>
<script>
const $=id=>document.getElementById(id);const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const SCOPES=["work","health","food","travel","family"];let S=null,tab="active",editing=null,openHist={};
const IC={overview:'<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/>',memory:'<circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="17" cy="19" r="2"/><path d="M7 7l3 3M17 8l-3 2.5M15.5 17.5L14 14"/>',access:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',log:'<path d="M5 6h14M5 12h14M5 18h9"/>',insights:'<path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z"/>'};
const TITLES={overview:"Overview",memory:"Memory",access:"Agents & access",log:"Access log",insights:"Insights"};
$("nav").innerHTML=Object.entries(TITLES).map(([k,n])=>'<a href="#'+k+'" data-v="'+k+'"><svg viewBox="0 0 24 24">'+IC[k]+'</svg>'+esc(n)+'</a>').join("");
$("gScopes").innerHTML=SCOPES.map(t=>'<label><input type="checkbox" value="'+t+'"'+(t==="work"?" checked":"")+'>'+t+'</label>').join("");
function route(){const v=location.hash.slice(1)||"overview",k=TITLES[v]?v:"overview";document.querySelectorAll(".view").forEach(e=>e.classList.toggle("on",e.id==="v-"+k));document.querySelectorAll(".notch a").forEach(a=>{a.classList.toggle("on",a.dataset.v===k);a.setAttribute("aria-current",a.dataset.v===k?"page":"false")})}
window.addEventListener("hashchange",()=>{route();window.scrollTo(0,0)});route();
function go(v,focus){location.hash=v;setTimeout(()=>{if(focus){const e=$(focus);e.focus();e.scrollIntoView({block:"center",behavior:"smooth"})}},60)}
const toast=m=>{const t=$("toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove("on"),1800)};
async function api(p,b){const r=await fetch(p,b===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});const j=await r.json();if(!r.ok)throw new Error(j.error||r.status);return j}
const ago=iso=>{const d=(Date.now()-Date.parse(iso))/1000;if(d<60)return"just now";if(d<3600)return Math.floor(d/60)+" min ago";if(d<86400)return Math.floor(d/3600)+" h ago";const n=Math.floor(d/86400);return n===1?"yesterday":n+" days ago"};
const hm=iso=>new Date(iso).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",hour12:false});
function memText(id){const m=S.memories.find(x=>x.id===id);return m?m.text:id}
function cleanReason(r){return esc(String(r).replace(/\s*\d{4}-\d\d-\d\dT[\d:.]+Z/g,"").replace(/^grant grt_\w+ was revoked at$/,"access was revoked").replace(/grant grt_\w+,?\s*/,""))}
const svgI=p=>'<svg viewBox="0 0 24 24">'+p+'</svg>';
function renderMems(){const all=S.memories,act=all.filter(m=>m.status==="active"),rep=all.filter(m=>m.status!=="active");
 $("memTabs").innerHTML=[["active","Current · "+act.length],["replaced","Corrected · "+rep.length]].map(([k,l])=>'<button role="tab" aria-selected="'+(tab===k)+'" class="'+(tab===k?"on":"")+'" onclick="tab=\''+k+'\';renderMems()">'+l+'</button>').join("");
 const list=(tab==="active"?act:rep).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 $("mems").innerHTML=list.map(m=>{const ed=editing===m.id;return '<div class="it"><div class="mem '+(m.status!=="active"?"replaced ":"")+(openHist[m.id]?"open":"")+'"><span class="sw '+esc(m.tags[0]||"")+'" title="'+esc(m.tags.join(", "))+'"></span><div class="t">'+(ed?'<div class="row"><input id="ed-'+m.id+'" aria-label="Corrected text" value="'+esc(m.text)+'" onkeydown="if(event.key===\'Enter\')saveEdit(\''+m.id+'\');if(event.key===\'Escape\'){editing=null;renderMems()}"><button class="btn dark" onclick="saveEdit(\''+m.id+'\')">Save</button><button class="btn" onclick="editing=null;renderMems()">Cancel</button></div>':'<span>'+esc(m.text)+'</span>'+(m.supersedes.length?'<button class="corr" onclick="toggleHist(\''+m.id+'\')">corrected</button>':''))+
 '<div class="meta"><span>'+esc(m.tags.join(", "))+'</span><span>'+ago(m.createdAt)+'</span><span title="Confidence rises when confirmed and fades over time"><span class="conf"><i style="width:'+Math.round(m.confidence*100)+'%"></i></span>'+Math.round(m.confidence*100)+'% sure</span>'+(m.confirmations?'<span>confirmed '+m.confirmations+'×</span>':'')+'</div>'+
 (openHist[m.id]?'<div class="hist">'+openHist[m.id].map((h,i)=>'<div>'+(i===0?'<b>'+esc(h.text)+'</b>':'<s>'+esc(h.text)+'</s>')+' <span class="small">· '+ago(h.createdAt)+'</span></div>').join("")+'</div>':'')+
 '</div>'+(m.status==="active"&&!ed?'<div class="acts"><button class="rb" onclick="confirmMem(\''+m.id+'\')" title="Still true" aria-label="Still true">'+svgI('<path d="M5 12l4 4 10-10"/>')+'</button><button class="rb dark" onclick="startEdit(\''+m.id+'\')" title="Correct" aria-label="Correct">'+svgI('<path d="M4 20h4L19 9l-4-4L4 16z"/>')+'</button></div>':'')+'</div></div>'}).join("")||'<div class="empty">Nothing here yet.</div>';
 const by={};act.forEach(m=>{const t=m.tags[0]||"other";by[t]=(by[t]||0)+1});const cls={work:"sky",food:"butter",health:"lilac",travel:"mint",family:"lilac"};
 $("memSide").innerHTML='<div class="stat blk hatch"><div class="k" style="opacity:.7">Corrected, kept as history</div><div class="v">'+rep.length+'</div></div>'+Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([t,n])=>'<div class="stat '+(cls[t]||"sky")+'" style="min-height:84px"><div class="k">'+esc(t)+'</div><div class="v" style="font-size:30px">'+n+'</div></div>').join("")}
function startEdit(id){if(location.hash!=="#memory")location.hash="memory";tab="active";editing=id;renderMems();setTimeout(()=>{const e=$("ed-"+id);if(e){e.focus();e.select();e.scrollIntoView({block:"center",behavior:"smooth"})}},80)}
async function toggleHist(id){if(openHist[id]){delete openHist[id]}else{openHist[id]=await api("/api/memories/"+id+"/history")}renderMems()}
function renderGrants(){const g=S.grants.slice().reverse();$("grants").innerHTML=g.map(x=>{const off=x.revokedAt||(x.expiresAt&&Date.parse(x.expiresAt)<Date.now());return '<div class="grant '+(off?"off":"")+'"><div class="t"><b>'+esc(x.agentId)+'</b> can read <b>'+x.tags.map(esc).join(", ")+'</b> for '+esc(x.purposes.join(", "))+'<div class="small">'+(x.revokedAt?'Revoked '+ago(x.revokedAt):x.expiresAt?(off?'Expired':'Until '+new Date(x.expiresAt).toLocaleString([],{dateStyle:"medium",timeStyle:"short"})):'No expiry')+' · consent by '+esc(x.consentBy)+'</div></div>'+(off?'':'<button class="rv" onclick="revoke(\''+x.grantId+'\')">Revoke</button>')+'</div>'}).join("")||'<div class="empty">No agent has access yet.</div>'}
function logRows(n){return S.log.slice(0,n).map(e=>{const w=e.action==="read"?e.decision:e.action;return '<div class="e"><span class="ts">'+hm(e.at)+'</span><span class="pill w '+w+'">'+(w==="allowed"?"Allowed":w==="denied"?"Denied":w==="grant"?"Granted":"Revoked")+'</span><span><b>'+esc(e.agentId)+'</b>'+(e.action==="read"?(e.purpose?' · '+esc(e.purpose):' · no purpose')+(e.memoryIds.length?' · saw '+e.memoryIds.length:''):'')+'<div class="small">'+cleanReason(e.reason)+'</div></span></div>'}).join("")||'<div class="empty">No access yet.</div>'}
function renderLog(){$("log").innerHTML=logRows(60);$("logMini").innerHTML=logRows(5)}
function insightCards(full){const out=[];
 for(const c of S.conflicts)out.push('<div class="ins butter"><div class="kind">Needs review · conflict</div><h4>These two can\'t both be true</h4><div class="inner vs"><span>'+esc(memText(c.a))+'</span>'+(full?'<button class="rb dark" aria-label="Correct" onclick="startEdit(\''+c.a+'\')">'+svgI('<path d="M4 20h4L19 9l-4-4L4 16z"/>')+'</button>':'<span></span>')+'<span>'+esc(memText(c.b))+'</span>'+(full?'<button class="rb dark" aria-label="Correct" onclick="startEdit(\''+c.b+'\')">'+svgI('<path d="M4 20h4L19 9l-4-4L4 16z"/>')+'</button>':'<span></span>')+'</div></div>');
 for(const p of S.patterns)out.push('<div class="ins lilac"><div class="kind">Habit · '+p.support+' times over '+p.distinctDays+' days</div><h4>'+esc(p.title||p.terms.join(" "))+'</h4>'+(full?'<details><summary>Show evidence</summary><ul>'+p.evidence.map(id=>'<li>'+esc(memText(id))+'</li>').join("")+'</ul></details>':'<div class="small" style="color:var(--lilacInk)">confidence '+Math.round(p.confidence*100)+'%</div>')+'</div>');
 for(const [a,ls] of Object.entries(S.lessons))for(const l of ls)out.push('<div class="ins mint tilt"><div class="kind">Lesson · '+esc(a)+'</div><h4>'+esc(l.text)+'</h4><div class="inner">Learned from a failed run. Applies when '+esc(String(l.trigger).replace(/^when\s+/i,""))+'.</div></div>');
 return out}
function renderLearn(){const f=insightCards(true);$("learn").innerHTML=f.map(h=>'<div style="grid-column:span 6">'+h+'</div>').join("")||'<div class="empty">Nothing learned yet.</div>';
 const m=insightCards(false);const pick=[m[0],m[1],m[m.length-1]].filter((x,i,a)=>x&&a.indexOf(x)===i);$("learnMini").innerHTML=pick.map(h=>'<div style="grid-column:span 4">'+h+'</div>').join("")}
const COL={work:"#9CC7E6",health:"#F2A99B",food:"#E9CF73",travel:"#9BDDB0",family:"#C9B3F5"};
function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296}
function renderConstel(){const W=600,H=280,P=26;const cx={work:[110,120],food:[290,95],health:[480,105],travel:[215,210],family:[420,215]};const pos={};
 const act=S.memories;const cnt={};act.forEach(m=>{const t=m.tags[0]||"work";cnt[t]=(cnt[t]||0)+1});const idx={};
 act.forEach(m=>{const t=m.tags[0]||"work",[x,y]=cx[t]||[300,140];const i=idx[t]=(idx[t]||0)+1;const ga=i*2.39996+hash(t)*6.28,rr=14+Math.sqrt(i)*24;const r=m.status==="active"?7+m.confidence*9:5;
  let px=x+Math.cos(ga)*rr*1.25,py=y+Math.sin(ga)*rr*.85;px=Math.min(W-P-r,Math.max(P+r,px));py=Math.min(H-P-r,Math.max(P+r,py));pos[m.id]=[px,py,t,m,r]});
 let l="";const curve=(a,b,st,dash,w)=>{if(!pos[a]||!pos[b])return;const [x1,y1]=pos[a],[x2,y2]=pos[b],mx=(x1+x2)/2,my=(y1+y2)/2,dx=x2-x1,dy=y2-y1,k=.22;l+='<path d="M'+x1.toFixed(1)+' '+y1.toFixed(1)+' Q'+(mx-dy*k).toFixed(1)+' '+(my+dx*k).toFixed(1)+' '+x2.toFixed(1)+' '+y2.toFixed(1)+'" fill="none" stroke="'+st+'" stroke-width="'+w+'" stroke-linecap="round" '+(dash?'stroke-dasharray="0.1 6"':'')+'/>'};
 S.patterns.forEach(p=>p.evidence.forEach((e,i)=>i&&curve(p.evidence[i-1],e,"#7BC96F",1,2.2)));S.memories.forEach(m=>m.replacedBy&&curve(m.id,m.replacedBy,"#B9BCC0",1,1.8));S.conflicts.forEach(c=>curve(c.a,c.b,"#E5533D",0,1.6));
 let n="";for(const [id,[x,y,t,m,r]] of Object.entries(pos)){const on=m.status==="active",lx=x>W-170?x-r-8:x+r+8,anc=x>W-170?"end":"start",txt=m.text.length>34?m.text.slice(0,33)+"…":m.text;
  n+='<g class="nd" tabindex="0" style="animation:fl '+(6+hash(id)*5).toFixed(1)+'s ease-in-out -'+(hash(id+"d")*6).toFixed(1)+'s infinite alternate"><circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+(r*2.1).toFixed(1)+'" fill="url(#halo-'+t+')"/><circle class="core" cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+r.toFixed(1)+'" fill="'+(on?COL[t]:"#fff")+'" stroke="'+(on?"#fff":"#B9BCC0")+'" stroke-width="2.5" '+(on?'':'stroke-dasharray="2 3"')+'/><text x="'+lx.toFixed(1)+'" y="'+(y+4).toFixed(1)+'" text-anchor="'+anc+'" font-size="11.5" font-weight="600" fill="#141414" paint-order="stroke" stroke="#fff" stroke-width="4">'+esc(txt)+'</text><title>'+esc(m.text)+'</title></g>'}
 const defs=Object.entries(COL).map(([t,c])=>'<radialGradient id="halo-'+t+'"><stop offset="0" stop-color="'+c+'" stop-opacity=".55"/><stop offset="1" stop-color="'+c+'" stop-opacity="0"/></radialGradient>').join("");
 const labels=Object.entries(cx).filter(([t])=>cnt[t]).map(([t,[x,y]])=>'<text x="'+x+'" y="'+Math.min(H-8,y+68)+'" text-anchor="middle" font-size="10" letter-spacing="2" font-weight="700" fill="#B3B7BC">'+t.toUpperCase()+'</text>').join("");
 $("constel").innerHTML='<defs>'+defs+'</defs><style>@keyframes fl{to{transform:translateY(-3px)}}</style>'+labels+'<g>'+l+'</g><g>'+n+'</g>'}
function renderGauge(){const act=S.memories.filter(m=>m.status==="active");const v=act.length?act.reduce((s,m)=>s+m.confidence,0)/act.length:0;
 const R=86,C=Math.PI*R,arc='M24 112 A86 86 0 0 1 196 112';
 $("gauge").innerHTML='<defs><pattern id="hp" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#fff"/><rect width="2.4" height="7" fill="#1A1A1A"/></pattern></defs><path d="'+arc+'" fill="none" stroke="url(#hp)" stroke-width="22"/><path d="'+arc+'" fill="none" stroke="#1A1A1A" stroke-width="22" stroke-dasharray="'+(C*v).toFixed(1)+' '+C.toFixed(1)+'"/><text x="110" y="100" text-anchor="middle" font-size="34" font-weight="800" fill="#141414" font-family="inherit">'+Math.round(v*100)+'%</text><text x="110" y="120" text-anchor="middle" font-size="11" fill="#8A8F98" font-family="inherit">average confidence</text>'}
let RANGE=7;document.querySelectorAll('#range button').forEach(b=>b.onclick=()=>{RANGE=+b.dataset.d;document.querySelectorAll('#range button').forEach(x=>x.classList.toggle('on',x===b));$('lolliT').textContent='Agent reads, '+(RANGE===1?'today':RANGE===7?'this week':'last 2 weeks');renderLolli()});
function renderLolli(){const N=Math.max(RANGE,7),days=[...Array(N)].map((_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(N-1)+i);return d});
 const reads=S.log.filter(e=>e.action==="read"&&e.agentId!=="owner");const cnt=days.map(d=>{const n=new Date(d);n.setDate(n.getDate()+1);const r=reads.filter(e=>{const t=Date.parse(e.at);return t>=d&&t<n});return [r.filter(e=>e.decision==="allowed").length,r.filter(e=>e.decision==="denied").length]});
 const mx=Math.max(1,...cnt.map(c=>c[0]+c[1]));
 $("lolli").innerHTML=days.map((d,i)=>{const [a,dn]=cnt[i],today=i===N-1,dim=RANGE===1&&!today;return '<div class="c" style="'+(dim?'opacity:.25':'')+'"><div style="display:flex;gap:10px;align-items:flex-end;position:relative">'+(today&&(a+dn)?'<span class="tip">'+a+' allowed · '+dn+' denied</span>':'')+'<div class="stick'+(a?'':' z')+'" style="height:'+(10+a/mx*100)+'px"></div><div class="stick dn'+(dn?'':' z')+'" style="height:'+(10+dn/mx*100)+'px"></div></div><div class="d'+(today?' today':'')+'">'+d.toLocaleDateString([],{weekday:"narrow"})+'</div></div>'}).join("")}
function renderTiles(){const reads=S.log.filter(e=>e.action==="read"&&e.agentId!=="owner"),act=S.grants.filter(g=>!g.revokedAt&&!(g.expiresAt&&Date.parse(g.expiresAt)<Date.now())).length;
 const I={mem:'<circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="7" r="2"/><path d="M7 7l3 3M17 8l-3 2.5"/>',key:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',ok:'<path d="M5 12l4 4 10-10"/>',no:'<path d="M6 6l12 12M18 6L6 18"/>',warn:'<path d="M12 4l9 16H3zM12 10v4M12 17v.5"/>',bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z"/>'};
 const t=[["sky",S.memories.filter(m=>m.status==="active").length,"memories",I.mem,"background:#fff","","memory"],["mint",act,"active grants",I.key,"background:var(--ink);color:#fff","bl","access"],["mint",reads.filter(e=>e.decision==="allowed").length,"reads allowed",I.ok,"background:var(--mint2)","","log"],["blk hatch",reads.filter(e=>e.decision==="denied").length,"reads denied",I.no,"background:var(--red);color:#fff","bl","log"],["butter",S.conflicts.length,"conflicts to review",I.warn,"background:var(--ink);color:var(--butter)","","insights"],["lilac",S.patterns.length+Object.values(S.lessons).flat().length,"habits & lessons",I.bulb,"background:#fff","bl","insights"]];
 $("tiles").innerHTML=t.map(([c,v,k,ic,bs,pos,view])=>'<div class="tw '+pos+'"><a class="tb" href="#'+view+'" aria-label="Open '+k+'" style="'+bs+'"><svg viewBox="0 0 24 24">'+ic+'</svg></a><div class="stat '+c+'"><div class="k">'+k+'</div><div class="v">'+v+'</div></div></div>').join("");$("spendPill").textContent="$"+S.spendUsd.toFixed(4)+" spent on Token Factory"}
function renderSteps(){const reads=S.log.filter(e=>e.action==="read"&&e.agentId!=="owner");
 const st=[["Correct a memory",S.memories.some(m=>m.status!=="active")],["Ask without a purpose",reads.some(e=>e.decision==="denied")],["Grant access",S.grants.length>0],["Ask again: allowed",reads.some(e=>e.decision==="allowed")],["Revoke",S.grants.some(g=>g.revokedAt)],["Review insights",S.conflicts.length+S.patterns.length>0]];
 const n=st.filter(s=>s[1]).length,ni=st.findIndex(s=>!s[1]);$("ticks").innerHTML=st.map((s,i)=>'<i class="'+(s[1]?"on":i===ni?"next":"")+'" title="'+esc(s[0])+'"></i>').join("");$("progN").textContent="Demo "+n+"/6";$("nextStep").textContent=ni<0?"Complete":"Next: "+st[ni][0]}
async function load(){if(editing)return;S=await api("/api/state");$("model").textContent=S.online?"Nemotron online":"offline";$("who").textContent=S.owner;$("av").textContent=S.owner[0].toUpperCase();$("today").textContent=new Date().toLocaleDateString([],{weekday:"short",day:"numeric",month:"short"});renderMems();renderGrants();renderLog();renderLearn();renderSteps();renderTiles();renderGauge();renderLolli();renderConstel()}
async function addMem(){const t=$("newText").value.trim();if(!t)return;const m=await api("/api/memories",{text:t,tags:[$("newTag").value]});$("newText").value="";toast(m.confirmed?"Already known, confirmed":"Remembered");load()}
async function saveEdit(id){const t=$("ed-"+id).value.trim();editing=null;await api("/api/memories/"+id+"/update",{text:t});toast("Corrected. The old version is kept in history.");tab="active";load()}
async function confirmMem(id){await api("/api/memories/"+id+"/confirm",{});toast("Confirmed");load()}
async function grant(){if(!$("gConsent").checked){toast("Tick the consent box first");$("gConsent").focus();return}const tags=[...document.querySelectorAll("#gScopes input:checked")].map(i=>i.value);if(!tags.length){toast("Pick at least one scope");return}
 await api("/api/grants",{agentId:$("gAgent").value,tags,purposes:[$("gPurpose").value.trim()||"*"],ttlMin:$("gTtl").value||null});$("gConsent").checked=false;toast("Access granted");load()}
async function revoke(id){await api("/api/grants/"+id+"/revoke",{});toast("Access revoked");load()}
async function ask(){const b=$("askBtn");b.disabled=true;b.textContent="Asking…";$("aOut").innerHTML="";
 try{const agentId=$("aAgent").value,r=await api("/api/ask",{question:$("aQ").value,agentId,purpose:$("aPurpose").value.trim()||null,tags:$("aTags").value?[$("aTags").value]:[]});
 const ans=esc(r.answer).replace(/\s*\[([0-9A-Z]{10,})\]/g,(_,id)=>' <span class="cite" tabindex="0" title="'+esc(memText(id))+'">source</span>');
 $("aOut").innerHTML='<div class="result '+r.decision+(r.decision==="denied"?" hatch":"")+'"><div class="st">'+(r.decision==="allowed"?"Allowed":"Denied")+'</div>'+(r.decision==="allowed"?'<div class="answer">'+ans+'</div><div class="small" style="color:var(--mintInk)">'+(r.memories.length?'Read '+r.memories.length+' memor'+(r.memories.length>1?'ies':'y')+' · ':'')+(r.usage?esc(r.usage.model.split("/").pop())+' · '+r.usage.ms+' ms':'')+'</div>':'<div class="answer" style="font-size:16px">'+cleanReason(r.reason)+'</div>')+'</div>'}
 catch(e){$("aOut").innerHTML='<div class="result denied"><div class="why">'+esc(e.message)+'</div></div>'}finally{b.disabled=false;b.textContent="Ask";load()}}
$("aQ").addEventListener("keydown",e=>{if(e.key==="Enter")ask()});$("newText").addEventListener("keydown",e=>{if(e.key==="Enter")addMem()});
load();setInterval(()=>{const a=document.activeElement;if(!a||a.tagName!=="INPUT")load()},5000);
</script></body></html>`;
