#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface ResultFile {
  filePath: string;
  data: any;
}

function fmtPct(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return `${(val * 100).toFixed(1)}%`;
}

function fmtNum(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return val.toFixed(4);
}

function fmtDelta(after: number | null | undefined, before: number | null | undefined, isPct = true): string {
  if (after === null || after === undefined || before === null || before === undefined) return "-";
  const diff = after - before;
  const sign = diff > 0 ? "+" : "";
  return isPct ? `${sign}${(diff * 100).toFixed(1)}%` : `${sign}${diff.toFixed(4)}`;
}

function generateReport(files: ResultFile[]): string {
  const lines: string[] = [];

  lines.push("# Clearmind Benchmark Replay Report\n");

  // Run Metadata
  lines.push("## Configurations Evaluated\n");
  lines.push("| Label | System | Retriever | Embedder | k | Git SHA | Total Cases |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const f of files) {
    const c = f.data.config || {};
    const label = f.filePath;
    const sys = c.system || "unknown";
    const ret = c.retriever || "unknown";
    const emb = c.embedder ? c.embedder.split("/").pop() : "none";
    const k = c.k ?? 10;
    const sha = (f.data.git_sha || "unknown").slice(0, 8);
    const total = f.data.counts?.total ?? "-";
    lines.push(`| \`${label}\` | **${sys}** | ${ret} | ${emb} | ${k} | \`${sha}\` | ${total} |`);
  }
  lines.push("");

  // Check if we have before and after files
  const beforeFile = files.find((f) => f.data.config?.system === "before");
  const afterFile = files.find((f) => f.data.config?.system === "after");

  if (beforeFile && afterFile) {
    const bOvRec = beforeFile.data.metrics?.overall?.recall_abstention || {};
    const aOvRec = afterFile.data.metrics?.overall?.recall_abstention || {};

    lines.push("## Recall & Abstention Overall Summary\n");
    lines.push("| Metric | Baseline (Before) | Clearmind (After) | Delta | Target Direction |");
    lines.push("|---|---|---|---|---|");
    lines.push(`| **Hit@1** (gold mid ranked #1) | ${fmtPct(bOvRec.hit_at_1)} | ${fmtPct(aOvRec.hit_at_1)} | ${fmtDelta(aOvRec.hit_at_1, bOvRec.hit_at_1)} | Higher is better |`);
    lines.push(`| **MRR@k** (mean reciprocal rank) | ${fmtNum(bOvRec.mrr)} | ${fmtNum(aOvRec.mrr)} | ${fmtDelta(aOvRec.mrr, bOvRec.mrr, false)} | Higher is better |`);
    lines.push(`| **Recall@5** (gold in top 5) | ${fmtPct(bOvRec.recall_at_5)} | ${fmtPct(aOvRec.recall_at_5)} | ${fmtDelta(aOvRec.recall_at_5, bOvRec.recall_at_5)} | Higher is better |`);
    lines.push(`| **Newest Wins** (gold > stale / stale dropped) | ${fmtPct(bOvRec.newest_wins)} | ${fmtPct(aOvRec.newest_wins)} | ${fmtDelta(aOvRec.newest_wins, bOvRec.newest_wins)} | Higher is better |`);
    lines.push(`| **Stale Top-1 Rate** (stale fact ranked #1) | ${fmtPct(bOvRec.stale_top1_rate)} | ${fmtPct(aOvRec.stale_top1_rate)} | ${fmtDelta(aOvRec.stale_top1_rate, bOvRec.stale_top1_rate)} | Lower is better |`);
    lines.push(`| **Abstain Rate** (on abstention queries) | ${fmtPct(bOvRec.abstain_rate)} | ${fmtPct(aOvRec.abstain_rate)} | ${fmtDelta(aOvRec.abstain_rate, bOvRec.abstain_rate)} | Higher is better |`);
    lines.push(`| **False Abstain Rate** (empty on answerable) | ${fmtPct(bOvRec.false_abstain_rate)} | ${fmtPct(aOvRec.false_abstain_rate)} | ${fmtDelta(aOvRec.false_abstain_rate, bOvRec.false_abstain_rate)} | Lower is better |`);
    lines.push("");

    const bOvPol = beforeFile.data.metrics?.overall?.policy || {};
    const aOvPol = afterFile.data.metrics?.overall?.policy || {};

    lines.push("## Access Policy Overall Summary\n");
    lines.push("| Metric | Baseline (Before) | Clearmind (After) | Delta | Target Direction |");
    lines.push("|---|---|---|---|---|");
    lines.push(`| **Decision Accuracy** (allowed/denied match) | ${fmtPct(bOvPol.decision_accuracy)} | ${fmtPct(aOvPol.decision_accuracy)} | ${fmtDelta(aOvPol.decision_accuracy, bOvPol.decision_accuracy)} | Higher is better |`);
    lines.push(`| **Leak Rate on Denied** (protected mid leaked) | ${fmtPct(bOvPol.leak_rate_expected_denied)} | ${fmtPct(aOvPol.leak_rate_expected_denied)} | ${fmtDelta(aOvPol.leak_rate_expected_denied, bOvPol.leak_rate_expected_denied)} | Lower is better (0% ideal) |`);
    lines.push(`| **Leak Rate Overall** (all policy cases) | ${fmtPct(bOvPol.leak_rate_overall)} | ${fmtPct(aOvPol.leak_rate_overall)} | ${fmtDelta(aOvPol.leak_rate_overall, bOvPol.leak_rate_overall)} | Lower is better (0% ideal) |`);
    lines.push(`| **Allowed Recall** (allowed mid returned when allowed) | ${fmtPct(bOvPol.allowed_recall)} | ${fmtPct(aOvPol.allowed_recall)} | ${fmtDelta(aOvPol.allowed_recall, bOvPol.allowed_recall)} | Higher is better |`);
    lines.push("");

    // Category Breakdown - Recall
    lines.push("## Recall & Abstention Breakdown by Category\n");
    lines.push("| Category | Type | Cases | System | Hit@1 | MRR@k | Recall@5 | Newest Wins | Stale Top1 | Abstain Rate | False Abstain |");
    lines.push("|---|---|---|---|---|---|---|---|---|---|---|");

    const allCats = new Set([
      ...Object.keys(beforeFile.data.metrics?.by_category || {}),
      ...Object.keys(afterFile.data.metrics?.by_category || {}),
    ]);

    for (const cat of allCats) {
      const bCat = beforeFile.data.metrics?.by_category?.[cat];
      const aCat = afterFile.data.metrics?.by_category?.[cat];
      const type = aCat?.type || bCat?.type;
      if (type === "policy") continue;

      const count = aCat?.count ?? bCat?.count ?? 0;
      if (bCat) {
        lines.push(`| ${cat} | ${type} | ${count} | Before | ${fmtPct(bCat.hit_at_1)} | ${fmtNum(bCat.mrr)} | ${fmtPct(bCat.recall_at_5)} | ${fmtPct(bCat.newest_wins)} | ${fmtPct(bCat.stale_top1_rate)} | ${fmtPct(bCat.abstain_rate)} | ${fmtPct(bCat.false_abstain_rate)} |`);
      }
      if (aCat) {
        lines.push(`| ${cat} | ${type} | ${count} | After | ${fmtPct(aCat.hit_at_1)} | ${fmtNum(aCat.mrr)} | ${fmtPct(aCat.recall_at_5)} | ${fmtPct(aCat.newest_wins)} | ${fmtPct(aCat.stale_top1_rate)} | ${fmtPct(aCat.abstain_rate)} | ${fmtPct(aCat.false_abstain_rate)} |`);
      }
    }
    lines.push("");

    // Category Breakdown - Policy
    lines.push("## Access Policy Breakdown by Category\n");
    lines.push("| Category | Cases | System | Decision Acc | Leak Rate (Denied) | Leak Rate (Overall) | Allowed Recall |");
    lines.push("|---|---|---|---|---|---|---|");

    for (const cat of allCats) {
      const bCat = beforeFile.data.metrics?.by_category?.[cat];
      const aCat = afterFile.data.metrics?.by_category?.[cat];
      const type = aCat?.type || bCat?.type;
      if (type !== "policy") continue;

      const count = aCat?.count ?? bCat?.count ?? 0;
      if (bCat) {
        lines.push(`| ${cat} | ${count} | Before | ${fmtPct(bCat.decision_accuracy)} | ${fmtPct(bCat.leak_rate_expected_denied)} | ${fmtPct(bCat.leak_rate_overall)} | ${fmtPct(bCat.allowed_recall)} |`);
      }
      if (aCat) {
        lines.push(`| ${cat} | ${count} | After | ${fmtPct(aCat.decision_accuracy)} | ${fmtPct(aCat.leak_rate_expected_denied)} | ${fmtPct(aCat.leak_rate_overall)} | ${fmtPct(aCat.allowed_recall)} |`);
      }
    }
    lines.push("");
  } else {
    // Multi-file report
    lines.push("## Replay Results Summary\n");
    for (const f of files) {
      lines.push(`### Results for \`${f.filePath}\`\n`);
      const rec = f.data.metrics?.overall?.recall_abstention;
      if (rec) {
        lines.push("**Recall / Abstention Metrics:**");
        lines.push(`- Hit@1: ${fmtPct(rec.hit_at_1)}`);
        lines.push(`- MRR@k: ${fmtNum(rec.mrr)}`);
        lines.push(`- Recall@5: ${fmtPct(rec.recall_at_5)}`);
        lines.push(`- Newest Wins: ${fmtPct(rec.newest_wins)}`);
        lines.push(`- Stale Top-1 Rate: ${fmtPct(rec.stale_top1_rate)}`);
        lines.push(`- Abstain Rate: ${fmtPct(rec.abstain_rate)}`);
        lines.push(`- False Abstain Rate: ${fmtPct(rec.false_abstain_rate)}\n`);
      }
      const pol = f.data.metrics?.overall?.policy;
      if (pol) {
        lines.push("**Policy Metrics:**");
        lines.push(`- Decision Accuracy: ${fmtPct(pol.decision_accuracy)}`);
        lines.push(`- Leak Rate on Denied: ${fmtPct(pol.leak_rate_expected_denied)}`);
        lines.push(`- Leak Rate Overall: ${fmtPct(pol.leak_rate_overall)}`);
        lines.push(`- Allowed Recall: ${fmtPct(pol.allowed_recall)}\n`);
      }
    }
  }

  return lines.join("\n");
}

function main() {
  const argv = process.argv.slice(2);
  let outFile: string | null = null;
  const filePaths: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" && i + 1 < argv.length) {
      outFile = argv[++i];
    } else {
      filePaths.push(argv[i]);
    }
  }

  if (filePaths.length === 0) {
    console.error("Usage: npx tsx bench/report.mts <results1.json> [results2.json ...] [--out <report.md>]");
    process.exit(1);
  }

  const loadedFiles: ResultFile[] = [];
  for (const fp of filePaths) {
    const fullPath = resolve(fp);
    if (!existsSync(fullPath)) {
      console.error(`File not found: ${fp}`);
      process.exit(1);
    }
    const data = JSON.parse(readFileSync(fullPath, "utf8"));
    loadedFiles.push({ filePath: fp, data });
  }

  const report = generateReport(loadedFiles);
  console.log(report);

  if (outFile) {
    writeFileSync(resolve(outFile), report, "utf8");
    console.log(`\nReport written to ${outFile}`);
  }
}

main();
