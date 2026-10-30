#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { Clearmind } from "../src/index.js";
import { AgentMemory as BaseAgentMemory, SqliteStore as BaseSqliteStore } from "/home/ubuntu/work/projects/agentmemory/dist/index.js";
import type { Embedder } from "/home/ubuntu/work/projects/agentmemory/dist/index.js";

const BASELINE_PATH = "/home/ubuntu/work/projects/agentmemory/dist/index.js";
const BASELINE_REPO_DIR = "/home/ubuntu/work/projects/agentmemory";
const WORKTREE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface CliArgs {
  data: string;
  system: "before" | "after";
  retriever: "bm25" | "embedding";
  embedder?: string;
  k: number;
  perCategory?: number;
  cases?: string;
  out: string;
  rows: string;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const args: Partial<CliArgs> = {
    k: 10,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--data" && i + 1 < argv.length) {
      args.data = argv[++i];
    } else if (arg === "--system" && i + 1 < argv.length) {
      const val = argv[++i];
      if (val !== "before" && val !== "after") {
        throw new Error(`Invalid --system: ${val}. Must be 'before' or 'after'.`);
      }
      args.system = val;
    } else if (arg === "--retriever" && i + 1 < argv.length) {
      const val = argv[++i];
      if (val !== "bm25" && val !== "embedding") {
        throw new Error(`Invalid --retriever: ${val}. Must be 'bm25' or 'embedding'.`);
      }
      args.retriever = val;
    } else if (arg === "--embedder" && i + 1 < argv.length) {
      args.embedder = argv[++i];
    } else if (arg === "--k" && i + 1 < argv.length) {
      args.k = parseInt(argv[++i], 10);
    } else if (arg === "--per-category" && i + 1 < argv.length) {
      args.perCategory = parseInt(argv[++i], 10);
    } else if (arg === "--cases" && i + 1 < argv.length) {
      args.cases = argv[++i];
    } else if (arg === "--out" && i + 1 < argv.length) {
      args.out = argv[++i];
    } else if (arg === "--rows" && i + 1 < argv.length) {
      args.rows = argv[++i];
    }
  }

  if (!args.data) throw new Error("Missing required argument: --data <dataset dir>");
  if (!args.system) throw new Error("Missing required argument: --system before|after");
  if (!args.retriever) throw new Error("Missing required argument: --retriever bm25|embedding");
  if (args.retriever === "embedding" && !args.embedder) {
    throw new Error("Missing required argument --embedder <path> when --retriever is 'embedding'");
  }
  if (!args.out) throw new Error("Missing required argument: --out <results.json>");
  if (!args.rows) throw new Error("Missing required argument: --rows <rows.jsonl>");

  return args as CliArgs;
}

function getGitSha(dir?: string): string {
  try {
    const cmd = dir ? `git -C "${dir}" rev-parse HEAD` : "git rev-parse HEAD";
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

function findDataFile(dataDir: string, filename: string): string | null {
  const p1 = join(dataDir, "data", filename);
  if (existsSync(p1)) return p1;
  const p2 = join(dataDir, filename);
  if (existsSync(p2)) return p2;
  return null;
}

function loadJsonl<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return [];
  const lines = readFileSync(filePath, "utf8").split("\n");
  const items: T[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      items.push(JSON.parse(trimmed));
    }
  }
  return items;
}

interface BaselineRememberInput {
  text: string;
  trigger?: string;
  tags?: string[];
  date?: string; // memory timestamp from the dataset, so baseline recency sees real order
  embedding?: Float32Array | null;
}

async function baselineRemember(
  mem: BaseAgentMemory,
  store: BaseSqliteStore,
  embedder: Embedder | undefined,
  scope: { namespace: string; userId: string; agentId: string },
  input: BaselineRememberInput
): Promise<{ lessonId: string }> {
  const trigger = input.trigger ?? (input.tags || []).join(" ").trim();
  let embedding: Float32Array | null = input.embedding ?? null;
  if (embedding === null && embedder) {
    const textToEmbed = `${trigger} ${input.text}`.trim();
    const embs = await embedder([textToEmbed]);
    embedding = embs[0] ?? null;
  }
  const lessonId = `les_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const now = input.date ? new Date(input.date).toISOString() : new Date().toISOString();
  const lesson = {
    ...scope,
    lessonId,
    text: input.text,
    trigger,
    kind: "fact",
    provenance: { createdBy: "manual", sourceRunIds: [], sourceEventIds: [] },
    confidence: 0.7,
    uses: 0,
    helped: 0,
    hurt: 0,
    createdAt: now,
    updatedAt: now,
    status: "active",
    replacedBy: null,
    embedding,
    extra: { tags: input.tags || [] },
  };
  await store.insertLesson(lesson);
  return { lessonId };
}

interface RecallMemory {
  mid: string;
  text: string;
  date: string;
  key?: string | null;
  tags?: string[];
}

interface RecallCase {
  id: string;
  category: string;
  question_date?: string;
  memories: RecallMemory[];
  query: string;
  gold_answer?: string;
  gold_mids?: string[];
  stale_mids?: string[];
  expect_abstain?: boolean;
}

interface PolicyStep {
  op: "grant" | "advance_min" | "revoke" | "read";
  owner?: string;
  ref?: string;
  agent?: string;
  tags?: string[] | null;
  purposes?: string[];
  ttl_min?: number;
  n?: number;
  purpose?: string | null;
  query?: string;
}

interface PolicyCase {
  id: string;
  category: string;
  owners: Record<string, { mid: string; text: string; tags?: string[]; key?: string | null }[]>;
  steps: PolicyStep[];
  expected: "allowed" | "denied";
  protected_mids?: string[];
  allowed_mids?: string[];
}

async function runRecallCase(
  c: RecallCase,
  type: "recall" | "abstention",
  system: "before" | "after",
  embedder: Embedder | undefined,
  k: number
) {
  const t0 = performance.now();
  const caseDir = mkdtempSync(join(tmpdir(), "cm-bench-rec-"));
  const sortedMemories = [...(c.memories || [])].sort((a, b) =>
    a.date > b.date ? 1 : a.date < b.date ? -1 : 0
  );

  const storeIdToMid = new Map<string, string>();
  let returnedTexts: string[] = [];
  let returnedMids: string[] = [];

  try {
    if (system === "before") {
      const store = new BaseSqliteStore({ path: join(caseDir, "memory.db") });
      const mem = new BaseAgentMemory({
        store,
        embedder,
        config: { minSimilarity: 0.3, minLexicalSimilarity: 0.05, quarantine: { trialSlots: 0 } },
      });
      await mem.init();
      const scope = { namespace: "bench", userId: "owner", agentId: "owner" };
      for (const m of sortedMemories) {
        const res = await baselineRemember(mem, store, embedder, scope, {
          text: m.text,
          trigger: (m.tags || []).join(" ").trim(),
          tags: m.tags || [],
          date: m.date,
        });
        storeIdToMid.set(res.lessonId, m.mid);
      }
      const lessons = await mem.recall(scope, c.query, k);
      returnedTexts = lessons.map((l: any) => l.text);
      returnedMids = lessons
        .map((l: any) => storeIdToMid.get(l.lessonId))
        .filter((id): id is string => typeof id === "string");
      await store.close();
    } else {
      const cm = new Clearmind({
        dir: caseDir,
        ownerId: "owner",
        embedder,
      });
      for (const m of sortedMemories) {
        const memRecord = await cm.remember(m.text, {
          tags: m.tags || [],
          key: m.key ?? undefined,
        });
        storeIdToMid.set(memRecord.id, m.mid);
      }
      const results = await cm.recall(c.query, k);
      returnedTexts = results.map((m) => m.text);
      returnedMids = results
        .map((m) => storeIdToMid.get(m.id))
        .filter((id): id is string => typeof id === "string");
      await cm.mem.store.close();
      cm.policy.close();
    }
  } finally {
    try {
      rmSync(caseDir, { recursive: true, force: true });
    } catch {}
  }

  const timingMs = Math.round((performance.now() - t0) * 100) / 100;

  const isAbstention = c.expect_abstain === true || c.category === "abstention" || type === "abstention";
  const goldMids = c.gold_mids || [];
  const staleMids = c.stale_mids || [];
  const goldSet = new Set(goldMids);
  const staleSet = new Set(staleMids);

  const abstained = returnedMids.length === 0;

  let hitAt1: number | null = null;
  let mrr: number | null = null;
  let recallAt5: number | null = null;
  let newestWins: number | null = null;
  let staleTop1: number | null = null;
  let falseAbstain: number | null = null;

  if (isAbstention) {
    falseAbstain = null;
  } else {
    falseAbstain = abstained ? 1 : 0;
    hitAt1 = returnedMids.length > 0 && goldSet.has(returnedMids[0]) ? 1 : 0;
    const rankIdx = returnedMids.findIndex((m) => goldSet.has(m));
    mrr = rankIdx !== -1 ? 1 / (rankIdx + 1) : 0;

    const top5 = returnedMids.slice(0, 5);
    const goldHits = top5.filter((m) => goldSet.has(m)).length;
    recallAt5 = goldMids.length > 0 ? goldHits / goldMids.length : 0;
  }

  if (staleMids.length > 0) {
    staleTop1 = returnedMids.length > 0 && staleSet.has(returnedMids[0]) ? 1 : 0;
    const firstGoldRank = returnedMids.findIndex((m) => goldSet.has(m));
    if (firstGoldRank !== -1) {
      const firstStaleRank = returnedMids.findIndex((m) => staleSet.has(m));
      if (firstStaleRank === -1 || firstGoldRank < firstStaleRank) {
        newestWins = 1;
      } else {
        newestWins = 0;
      }
    } else {
      newestWins = 0;
    }
  }

  return {
    id: c.id,
    category: c.category,
    type,
    system,
    timing_ms: timingMs,
    duration_ms: timingMs,
    query: c.query,
    gold_mids: goldMids,
    stale_mids: staleMids,
    returned_mids: returnedMids,
    returned_texts: returnedTexts,
    hit_at_1: hitAt1,
    mrr,
    recall_at_5: recallAt5,
    newest_wins: newestWins,
    stale_top1: staleTop1,
    abstained,
    false_abstain: falseAbstain,
  };
}

async function runPolicyCase(
  c: PolicyCase,
  system: "before" | "after",
  embedder: Embedder | undefined,
  k: number
) {
  const t0 = performance.now();
  const caseDir = mkdtempSync(join(tmpdir(), "cm-bench-pol-"));

  const protectedMids = c.protected_mids || [];
  const allowedMids = c.allowed_mids || [];
  const storeIdToMid = new Map<string, string>();

  let finalDecision: "allowed" | "denied" = "denied";
  let finalReturnedTexts: string[] = [];
  let finalReturnedMids: string[] = [];
  let finalReason = "";

  try {
    if (system === "before") {
      const store = new BaseSqliteStore({ path: join(caseDir, "memory.db") });
      const mem = new BaseAgentMemory({
        store,
        embedder,
        config: { minSimilarity: 0.3, minLexicalSimilarity: 0.05, quarantine: { trialSlots: 0 } },
      });
      await mem.init();

      for (const [owner, memories] of Object.entries(c.owners || {})) {
        const scope = { namespace: "bench", userId: owner, agentId: "owner" };
        for (const m of memories) {
          const res = await baselineRemember(mem, store, embedder, scope, {
            text: m.text,
            trigger: (m.tags || []).join(" ").trim(),
            tags: m.tags || [],
          });
          storeIdToMid.set(res.lessonId, m.mid);
        }
      }

      // Replay steps - find the final read step
      const readSteps = (c.steps || []).filter((s) => s.op === "read");
      const targetRead = readSteps[readSteps.length - 1];
      if (targetRead && targetRead.owner) {
        const targetScope = { namespace: "bench", userId: targetRead.owner, agentId: "owner" };
        const lessons = await mem.recall(targetScope, targetRead.query || "", k);
        finalReturnedTexts = lessons.map((l: any) => l.text);
        finalReturnedMids = lessons
          .map((l: any) => storeIdToMid.get(l.lessonId))
          .filter((id): id is string => typeof id === "string");
        finalDecision = "allowed";
        finalReason = "baseline agentmemory without policy allows all reads";
      }
      await store.close();
    } else {
      let currentTime = new Date("2026-01-01T00:00:00.000Z");
      const now = () => new Date(currentTime);
      const cms: Record<string, Clearmind> = {};

      for (const [owner, memories] of Object.entries(c.owners || {})) {
        const ownerDir = join(caseDir, owner);
        const cm = new Clearmind({
          dir: ownerDir,
          ownerId: owner,
          embedder,
          now,
        });
        for (const m of memories) {
          const memRecord = await cm.remember(m.text, {
            tags: m.tags || [],
            key: m.key ?? undefined,
          });
          storeIdToMid.set(memRecord.id, m.mid);
        }
        cms[owner] = cm;
      }

      const grantRefMap = new Map<string, string>();

      for (const step of c.steps || []) {
        if (step.op === "grant" && step.owner && step.agent) {
          const cm = cms[step.owner];
          if (cm) {
            const g = cm.grant({
              agentId: step.agent,
              tags: step.tags || ["*"],
              purposes: step.purposes || ["*"],
              consentBy: step.owner,
              ttlMs: step.ttl_min != null ? step.ttl_min * 60000 : undefined,
            });
            if (step.ref) {
              grantRefMap.set(step.ref, g.grantId);
            }
          }
        } else if (step.op === "advance_min") {
          currentTime = new Date(currentTime.getTime() + (step.n || 0) * 60000);
        } else if (step.op === "revoke" && step.owner && step.ref) {
          const cm = cms[step.owner];
          if (cm) {
            const grantId = grantRefMap.get(step.ref) ?? step.ref;
            try {
              cm.revoke(grantId, step.owner);
            } catch {}
          }
        } else if (step.op === "read" && step.owner && step.agent) {
          const cm = cms[step.owner];
          if (cm) {
            const res = await cm.read({
              agentId: step.agent,
              purpose: step.purpose,
              tags: step.tags ?? undefined,
              query: step.query || "",
              k,
            });
            finalDecision = res.decision;
            finalReason = res.reason;
            finalReturnedTexts = res.memories.map((m) => m.text);
            finalReturnedMids = res.memories
              .map((m) => storeIdToMid.get(m.id))
              .filter((id): id is string => typeof id === "string");
          } else {
            finalDecision = "denied";
            finalReason = `owner ${step.owner} not found`;
            finalReturnedTexts = [];
            finalReturnedMids = [];
          }
        }
      }

      for (const cm of Object.values(cms)) {
        await cm.mem.store.close();
        cm.policy.close();
      }
    }
  } finally {
    try {
      rmSync(caseDir, { recursive: true, force: true });
    } catch {}
  }

  const timingMs = Math.round((performance.now() - t0) * 100) / 100;
  const returnedMids = finalReturnedMids;
  const decisionAccuracy = finalDecision === c.expected ? 1 : 0;
  const hasLeak = returnedMids.some((m) => protectedMids.includes(m));
  const leak = hasLeak ? 1 : 0;

  let allowedHit: number | null = null;
  if (c.expected === "allowed") {
    const hitsAllowed = returnedMids.some((m) => allowedMids.includes(m));
    allowedHit = hitsAllowed ? 1 : 0;
  }

  return {
    id: c.id,
    category: c.category,
    type: "policy",
    system,
    timing_ms: timingMs,
    duration_ms: timingMs,
    expected: c.expected,
    decision: finalDecision,
    decision_accuracy: decisionAccuracy,
    reason: finalReason,
    protected_mids: protectedMids,
    allowed_mids: allowedMids,
    returned_mids: returnedMids,
    returned_texts: finalReturnedTexts,
    leak,
    allowed_hit: allowedHit,
  };
}

function mean(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 10000) / 10000;
}

async function main() {
  const args = parseArgs();
  const agentmemorySha = getGitSha(BASELINE_REPO_DIR);
  const worktreeSha = getGitSha(WORKTREE_DIR);

  let embedderFn: Embedder | undefined = undefined;
  if (args.retriever === "embedding") {
    const embedderPath = resolve(args.embedder!);
    const mod = await import(pathToFileURL(embedderPath).href);
    if (!mod.default || typeof mod.default !== "function") {
      throw new Error(`Embedder module at ${embedderPath} does not have a default function export.`);
    }
    embedderFn = mod.default as Embedder;
  }

  const recallFile = findDataFile(args.data, "recall.jsonl");
  const abstentionFile = findDataFile(args.data, "abstention.jsonl");
  const policyFile = findDataFile(args.data, "policy.jsonl");

  let recallCases = recallFile ? loadJsonl<RecallCase>(recallFile) : [];
  let abstentionCases = abstentionFile ? loadJsonl<RecallCase>(abstentionFile) : [];
  let policyCases = policyFile ? loadJsonl<PolicyCase>(policyFile) : [];

  // Filter by case IDs if requested
  if (args.cases) {
    const caseIdSet = new Set(args.cases.split(",").map((s) => s.trim()).filter(Boolean));
    recallCases = recallCases.filter((c) => caseIdSet.has(c.id));
    abstentionCases = abstentionCases.filter((c) => caseIdSet.has(c.id));
    policyCases = policyCases.filter((c) => caseIdSet.has(c.id));
  }

  if (args.perCategory != null && args.perCategory > 0) {
    const filterByCat = <T extends { category: string }>(items: T[]): T[] => {
      const grouped = new Map<string, T[]>();
      for (const item of items) {
        if (!grouped.has(item.category)) grouped.set(item.category, []);
        const list = grouped.get(item.category)!;
        if (list.length < args.perCategory!) {
          list.push(item);
        }
      }
      return Array.from(grouped.values()).flat();
    };

    recallCases = filterByCat(recallCases);
    abstentionCases = filterByCat(abstentionCases);
    policyCases = filterByCat(policyCases);
  }

  const allCasesToRun = [
    ...recallCases.map((c) => ({ type: "recall" as const, case: c })),
    ...abstentionCases.map((c) => ({ type: "abstention" as const, case: c })),
    ...policyCases.map((c) => ({ type: "policy" as const, case: c })),
  ];

  const totalCases = allCasesToRun.length;
  let processedCount = 0;
  const allRows: any[] = [];

  for (const item of allCasesToRun) {
    if (item.type === "recall" || item.type === "abstention") {
      const row = await runRecallCase(item.case as RecallCase, item.type, args.system, embedderFn, args.k);
      allRows.push(row);
    } else {
      const row = await runPolicyCase(item.case as PolicyCase, args.system, embedderFn, args.k);
      allRows.push(row);
    }
    processedCount++;
    if (processedCount % 25 === 0 || processedCount === totalCases) {
      process.stderr.write(`[progress] ${processedCount}/${totalCases} cases completed (${args.system}, ${args.retriever})\n`);
    }
  }

  // Aggregate category counts
  const countByCategory: Record<string, number> = {};
  for (const r of allRows) {
    countByCategory[r.category] = (countByCategory[r.category] || 0) + 1;
  }

  const recallRows = allRows.filter((r) => r.type === "recall");
  const abstentionRows = allRows.filter((r) => r.type === "abstention");
  const policyRows = allRows.filter((r) => r.type === "policy");

  const recallAbstentionRows = [...recallRows, ...abstentionRows];
  const answerableRows = recallAbstentionRows.filter((r) => r.type === "recall");
  const staleRows = recallAbstentionRows.filter((r) => r.stale_mids && r.stale_mids.length > 0);

  // Overall recall / abstention metrics
  const overallRecallAbstention = {
    count: recallAbstentionRows.length,
    answerable_count: answerableRows.length,
    abstention_count: abstentionRows.length,
    hit_at_1: mean(answerableRows.map((r) => r.hit_at_1)),
    mrr: mean(answerableRows.map((r) => r.mrr)),
    recall_at_5: mean(answerableRows.map((r) => r.recall_at_5)),
    newest_wins: mean(staleRows.map((r) => r.newest_wins)),
    stale_top1_rate: mean(staleRows.map((r) => r.stale_top1)),
    abstain_rate: mean(abstentionRows.map((r) => (r.abstained ? 1 : 0))),
    false_abstain_rate: mean(answerableRows.map((r) => r.false_abstain)),
  };

  // Overall policy metrics
  const expectedDeniedPolicyRows = policyRows.filter((r) => r.expected === "denied");
  const expectedAllowedPolicyRows = policyRows.filter((r) => r.expected === "allowed");

  const overallPolicy = {
    count: policyRows.length,
    expected_allowed_count: expectedAllowedPolicyRows.length,
    expected_denied_count: expectedDeniedPolicyRows.length,
    decision_accuracy: mean(policyRows.map((r) => r.decision_accuracy)),
    leak_rate_expected_denied: mean(expectedDeniedPolicyRows.map((r) => r.leak)),
    leak_rate_overall: mean(policyRows.map((r) => r.leak)),
    allowed_recall: mean(expectedAllowedPolicyRows.map((r) => r.allowed_hit)),
  };

  // By category metrics
  const byCategory: Record<string, any> = {};
  for (const cat of Object.keys(countByCategory)) {
    const catRows = allRows.filter((r) => r.category === cat);
    const catType = catRows[0]?.type;

    if (catType === "policy") {
      const denied = catRows.filter((r) => r.expected === "denied");
      const allowed = catRows.filter((r) => r.expected === "allowed");
      byCategory[cat] = {
        type: "policy",
        count: catRows.length,
        decision_accuracy: mean(catRows.map((r) => r.decision_accuracy)),
        leak_rate_expected_denied: mean(denied.map((r) => r.leak)),
        leak_rate_overall: mean(catRows.map((r) => r.leak)),
        allowed_recall: mean(allowed.map((r) => r.allowed_hit)),
      };
    } else if (cat === "abstention" || catType === "abstention") {
      byCategory[cat] = {
        type: "abstention",
        count: catRows.length,
        abstain_rate: mean(catRows.map((r) => (r.abstained ? 1 : 0))),
      };
    } else {
      const catStale = catRows.filter((r) => r.stale_mids && r.stale_mids.length > 0);
      byCategory[cat] = {
        type: "recall",
        count: catRows.length,
        hit_at_1: mean(catRows.map((r) => r.hit_at_1)),
        mrr: mean(catRows.map((r) => r.mrr)),
        recall_at_5: mean(catRows.map((r) => r.recall_at_5)),
        newest_wins: catStale.length > 0 ? mean(catStale.map((r) => r.newest_wins)) : null,
        stale_top1_rate: catStale.length > 0 ? mean(catStale.map((r) => r.stale_top1)) : null,
        false_abstain_rate: mean(catRows.map((r) => r.false_abstain)),
      };
    }
  }

  const results = {
    git_sha: worktreeSha,
    agentmemory_git_sha: agentmemorySha,
    config: {
      data: args.data,
      system: args.system,
      retriever: args.retriever,
      embedder: args.embedder ?? null,
      k: args.k,
      per_category: args.perCategory ?? null,
      cases: args.cases ?? null,
      baseline_path: BASELINE_PATH,
      agentmemory_git_sha: agentmemorySha,
      worktree_git_sha: worktreeSha,
      agentmemory_sha: agentmemorySha,
      worktree_sha: worktreeSha,
    },
    counts: {
      total: allRows.length,
      recall: recallRows.length,
      abstention: abstentionRows.length,
      policy: policyRows.length,
      by_category: countByCategory,
    },
    metrics: {
      overall: {
        recall_abstention: overallRecallAbstention,
        policy: overallPolicy,
      },
      by_category: byCategory,
    },
  };

  mkdirSync(dirname(resolve(args.out)), { recursive: true });
  writeFileSync(resolve(args.out), JSON.stringify(results, null, 2) + "\n", "utf8");

  mkdirSync(dirname(resolve(args.rows)), { recursive: true });
  const rowsContent = allRows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(resolve(args.rows), rowsContent, "utf8");

  console.log(`Replay finished: ${allRows.length} cases processed for system=${args.system}, retriever=${args.retriever}.`);
  console.log(`Results saved to ${args.out}`);
  console.log(`Rows saved to ${args.rows}`);
}

main().catch((err) => {
  console.error("Bench runner failed:", err);
  process.exit(1);
});
