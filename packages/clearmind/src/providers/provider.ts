// Model provider interface. Clearmind needs three things from a provider: chat (answers, extraction,
// titles), an LLM function for agentmemory's lesson distiller, and an embedder for hybrid recall.
import type { Embedder, LLM } from "agentmemory";
import type { ChatResult } from "../types.js";

export type ChatMessage = { role: string; content: string };
export type ChatOptions = { json?: boolean; maxTokens?: number };
export type ChatFn = (messages: ChatMessage[], opts?: ChatOptions) => Promise<ChatResult>;

export interface ModelProvider {
  readonly chat: ChatFn;
  readonly llm: LLM;
  readonly embedder: Embedder;
}
