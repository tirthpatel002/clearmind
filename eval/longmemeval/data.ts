// LongMemEval-S loading: rounds (user turn + following assistant turn) as memory units, split into <=CHUNK chars.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

export interface Turn { role: "user" | "assistant"; content: string; has_answer?: boolean }
export interface Question {
  question_id: string; question_type: string; question: string; question_date: string; answer: string;
  answer_session_ids: string[]; haystack_dates: string[]; haystack_session_ids: string[]; haystack_sessions: Turn[][];
}
export interface Chunk { chunkId: string; roundId: string; sessionId: string; date: string; text: string; hasAnswer: boolean }

export function loadDataset(path: string): { questions: Question[]; sha256: string } {
  const raw = readFileSync(path);
  return { questions: JSON.parse(raw.toString("utf8")) as Question[], sha256: createHash("sha256").update(raw).digest("hex") };
}

/** "2023/05/20 (Sat) 02:21" -> Date (UTC; the dataset carries no zone). */
export function parseLmeDate(s: string): Date {
  const m = /^(\d{4})\/(\d{2})\/(\d{2})(?:\s*\([A-Za-z]+\))?\s*(\d{2}):(\d{2})/.exec(s.trim());
  if (!m) throw new Error(`bad LongMemEval date: ${s}`);
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!));
}

/**
 * Round granularity as in the LongMemEval paper (user turn + assistant reply). A round longer than maxChars is split
 * into several chunks that keep the same round id (Clearmind caps one memory at 4000 chars).
 * Round id = `${sessionId}_${roundIndex}` so the official turn->session id stripping works.
 */
export function chunksFor(q: Question, maxChars = 3800): Chunk[] {
  const out: Chunk[] = [];
  q.haystack_sessions.forEach((sess, si) => {
    const sid = q.haystack_session_ids[si]!, date = q.haystack_dates[si]!;
    let i = 0, r = 0;
    while (i < sess.length) {
      const t = sess[i]!; let text: string, has = !!t.has_answer;
      if (t.role === "user" && sess[i + 1]?.role === "assistant") { text = `user: ${t.content}\nassistant: ${sess[i + 1]!.content}`; has = has || !!sess[i + 1]!.has_answer; i += 2; }
      else { text = `${t.role}: ${t.content}`; i += 1; }
      const roundId = `${sid}_${r++}`;
      text = text.trim();
      if (!text) continue;
      for (let c = 0, k = 0; c < text.length; c += maxChars, k++) {
        const part = k === 0 ? text.slice(0, maxChars) : `(continued) ${text.slice(c, c + maxChars)}`;
        out.push({ chunkId: `${roundId}#${k}`, roundId, sessionId: sid, date, text: part, hasAnswer: has });
      }
    }
  });
  return out;
}
