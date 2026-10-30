// Redaction for the privacy demo: agentmemory's detectors plus international phone numbers
// (e.g. "+91 98765 43210", "+44 20 7946 0958", "+1 (415) 555-0132") and long grouped local numbers.
import { scanAndRedact } from "agentmemory";
import type { Detection } from "agentmemory";

/** A digit run with optional + and common separators; checked by digit count below. */
const PHONE_CANDIDATE = /(?<![\w+])\+?\(?\d[\d\s().-]{5,}\d(?![\w])/g;

/** Phone if it has 8-15 digits and either starts with "+" or has 10+ digits (keeps dates like 2026-10-28 and times). */
export function isPhone(s: string): boolean {
  const digits = s.replace(/\D/g, "").length;
  if (digits < 8 || digits > 15) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return false;
  return s.trim().startsWith("+") || digits >= 10;
}

export function redactText(text: string): { text: string; detections: Detection[] } {
  const base = scanAndRedact(text, "redact");
  let n = 0;
  const out = base.text.replace(PHONE_CANDIDATE, (m) => {
    const lead = m.match(/^\s*/)![0], trail = m.match(/\s*$/)![0];
    if (!isPhone(m)) return m;
    n++;
    return `${lead}[REDACTED:phone]${trail}`;
  });
  const detections = base.detections.map((d) => ({ ...d }));
  if (n) {
    const p = detections.find((d) => d.detector === "phone");
    if (p) p.count += n; else detections.push({ detector: "phone", count: n });
  }
  return { text: out, detections };
}
