import { chat, setConfig, loadConfigSync } from "@hackkit/connector";
setConfig(loadConfigSync(new URL("./models.modal.yaml", import.meta.url).pathname));
const t0 = Date.now();
const r = await chat("glimmer:muse-glimmer-30b", [{ role: "user", content: "Is Paris the capital of France? Answer yes or no only." }], { maxTokens: 300, temperature: 0 });
console.log(JSON.stringify({ ms: Date.now() - t0, text: r.text.slice(0, 400), reasoning: r.reasoning?.slice(0, 300) ?? null, in: r.tokensIn, out: r.tokensOut, finish: r.finishReason }));
