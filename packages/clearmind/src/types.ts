// Shared data and API types. Plain data only (no runtime code, no Node imports),
// so the browser app can import them as well as the server.

// ---------- memories ----------
export interface Memory {
  id: string;
  text: string;
  tags: string[];
  key: string | null;
  status: string;
  replacedBy: string | null;
  supersedes: string[];
  createdAt: string;
  /** Effective confidence, after time decay. */
  confidence: number;
  confirmations: number;
  score?: number | undefined;
}

export interface MemoryPage {
  items: Memory[];
  nextCursor: string | null;
}

export interface MemoryStats {
  active: number;
  replaced: number;
  perScope: Record<string, number>;
  avgConfidence: number;
}

export type MemoryStatusFilter = "active" | "replaced" | "all";
export type ImportFormat = "text" | "json" | "csv";

export interface ImportItem {
  text: string;
  tags?: string[];
  key?: string | undefined;
}

export interface ImportResult {
  added: number;
  confirmed: number;
  skipped: number;
  errors: string[];
}

export interface ExtractedFact {
  text: string;
  scope: string | null;
}

// ---------- learning ----------
export interface Conflict {
  a: string;
  b: string;
  reason: string;
  similarity: number;
}

export interface Pattern {
  label: string;
  terms: string[];
  evidence: string[];
  support: number;
  distinctDays: number;
  confidence: number;
}

export type TitledPattern = Pattern & { title: string };

export interface Insights {
  conflicts: Conflict[];
  patterns: TitledPattern[];
  computedAt: string;
  factCount: number;
}

// ---------- access policy ----------
export type Decision = "allowed" | "denied";

export interface Grant {
  grantId: string;
  ownerId: string;
  /** Who may read. */
  agentId: string;
  /** Memory scopes the agent may see, e.g. ["work"]; "*" = all. */
  tags: string[];
  /** Allowed purposes; "*" = any non-empty purpose. */
  purposes: string[];
  /** Who consented (required). */
  consentBy: string;
  consentAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
}

export interface AccessLogEntry {
  seq: number;
  at: string;
  ownerId: string;
  agentId: string;
  action: "read" | "grant" | "revoke";
  purpose: string | null;
  tags: string[];
  decision: Decision;
  reason: string;
  grantId: string | null;
  memoryIds: string[];
}

export interface AccessLogPage {
  items: AccessLogEntry[];
  nextCursor: number | null;
}

export interface AccessStats {
  readsAllowed: number;
  readsDenied: number;
  byDay: Record<string, { allowed: number; denied: number }>;
  grants: number;
  activeGrants: number;
  revokedGrants: number;
}

// ---------- model calls ----------
export interface ChatResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  usd: number;
  model: string;
  ms: number;
}

export type ChatUsage = Omit<ChatResult, "content">;

export interface ReadResult {
  decision: Decision;
  reason: string;
  memories: Memory[];
  log: AccessLogEntry;
}

export interface AskResult extends ReadResult {
  answer: string;
  cited: string[];
  abstained?: boolean;
  usage?: ChatUsage | undefined;
}

// ---------- graph (constellation) ----------
export interface GraphEdges {
  habit: [string, string][];
  conflict: [string, string][];
  correction: [string, string][];
}

export interface NodeGraph {
  mode: "nodes";
  scope?: string;
  total: number;
  nodes: Memory[];
  edges: GraphEdges;
}

export interface ClusterGraph {
  mode: "clusters";
  total: number;
  clusters: { scope: string; count: number }[];
}

export type Graph = NodeGraph | ClusterGraph;

// ---------- HTTP API responses ----------
export interface LessonSummary {
  id: string;
  text: string;
  trigger: string;
  kind: string;
  status: string;
  confidence: number;
}

export type InsightHighlight = ({ kind: "conflict" } & Conflict) | ({ kind: "pattern" } & TitledPattern);

/** GET /api/state: everything the dashboard needs in one call. */
export interface StateResponse {
  owner: string;
  online: boolean;
  demo: boolean;
  memories: MemoryStats;
  scopes: string[];
  agents: string[];
  access: AccessStats;
  grants: Grant[];
  recent: AccessLogEntry[];
  insights: { conflicts: number; patterns: number; lessons: number; stale: boolean; top: InsightHighlight[] };
  /** id -> text for memories referenced by `insights.top`. */
  texts: Record<string, string>;
  lessons: Record<string, LessonSummary[]>;
  spendUsd: number;
  limits: { spendCapUsd: number; pageSize: number };
}

/** GET /api/insights?kind=conflicts|patterns */
export interface InsightsPage<T = Conflict | TitledPattern> {
  items: T[];
  texts: Record<string, string>;
  total: number;
  nextCursor: number | null;
  stale: boolean;
}
