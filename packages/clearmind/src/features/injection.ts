// 17: heuristic prompt-injection screening of memory text before it reaches a model prompt.
const PATTERNS: [string, RegExp][] = [
  ["override", /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|system|your)\b[^.\n]{0,20}\b(instructions?|prompts?|rules?|messages?|context)\b/i],
  ["role_hijack", /\b(you are now|act as|pretend to be|from now on you|new instructions?:|developer mode|jailbreak|DAN\b)/i],
  ["fake_role_tag", /(^|\n)\s*(system|assistant|developer)\s*:|<\/?\s*(system|assistant|im_start|im_end|instructions?)\s*>|\[\/?INST\]/i],
  ["exfiltration", /\b(reveal|print|show|output|send|leak|repeat)\b[^.\n]{0,30}\b(system prompt|instructions|api[ _-]?keys?|passwords?|secrets?|credentials|tokens?)\b/i],
  ["tool_coercion", /\b(call|invoke|run|execute)\b[^.\n]{0,20}\b(tool|function|command|shell|curl|wget)\b|\bcurl\s+https?:\/\//i],
  ["answer_forcing", /\b(you|assistant|model|ai)\s+(must|should|will)\s+(always\s+)?(answer|respond|reply|say)\b|\b(always|must)\s+(answer|respond|reply|say)\s*['"]|\brespond only with\b/i],
  ["hidden_text", /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/],
  ["encoded_payload", /\b(base64|rot13)\b[^.\n]{0,20}\b(decode|execute|follow)\b|[A-Za-z0-9+/]{80,}={0,2}/],
];

export function detectInjection(text: string): string[] {
  return PATTERNS.filter(([, re]) => re.test(text)).map(([n]) => n);
}
