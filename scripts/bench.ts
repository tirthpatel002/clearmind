// Latency benchmark for the local API. Usage: node --import tsx scripts/bench.ts --url http://127.0.0.1:8791 [--n 40]
const arg = (k: string, d: string) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const base = arg("url", "http://127.0.0.1:8791"), n = Number(arg("n", "40"));
const paths = ["/api/state", "/api/memories?limit=50", "/api/memories?limit=50&q=coffee", "/api/memories?limit=50&scope=food", "/api/log?limit=50", "/api/log?limit=50&q=shopping", "/api/graph", "/api/graph?scope=food", "/api/insights?kind=conflicts&limit=20"];
for (const p of paths) {
  await fetch(base + p); const t: number[] = [];
  for (let i = 0; i < n; i++) { const s = performance.now(); const r = await fetch(base + p); await r.arrayBuffer(); t.push(performance.now() - s); }
  t.sort((a, b) => a - b); const q = (x: number) => t[Math.min(t.length - 1, Math.floor(x * t.length))].toFixed(1);
  console.log(`${p.padEnd(42)} p50 ${q(0.5)} ms  p95 ${q(0.95)} ms`);
}
