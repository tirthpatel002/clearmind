// 21 evidence spans for citations and 24 self-check verifier.
import type { Memory } from "../types.js";
import type { ChatFn } from "../providers/provider.js";
import { lexicalCoverage } from "../abstain.js";

export interface Evidence { id: string; text: string; support: number }

/** For each cited memory: its text and how much of the citing sentence(s) it covers lexically. */
export function citationEvidence(answer: string, cited: string[], ms: Memory[]): Evidence[] {
  const sentences = answer.split(/(?<=[.!?])\s+/);
  return cited.flatMap((id) => {
    const m = ms.find((x) => x.id === id); if (!m) return [];
    const s = sentences.filter((x) => x.includes(`[${id}]`)).join(" ").replace(/\[[0-9A-Z]{10,}\]/g, "");
    return [{ id, text: m.text, support: Number(lexicalCoverage(s || answer, m.text).toFixed(4)) }];
  });
}

export const VERIFY_SYSTEM = `You check whether an ANSWER is fully supported by the MEMORIES. Reply with exactly one word: SUPPORTED or UNSUPPORTED.`;

export async function selfCheck(chat: ChatFn, question: string, answer: string, ms: Memory[]): Promise<{ supported: boolean; raw: string }> {
  const res = await chat([
    { role: "system", content: VERIFY_SYSTEM },
    { role: "user", content: `MEMORIES:\n${ms.map((m) => `[${m.id}] ${m.text}`).join("\n")}\n\nQUESTION: ${question}\nANSWER: ${answer}` },
  ]);
  const raw = res.content.trim();
  return { supported: /^\W*supported\b/i.test(raw), raw };
}
