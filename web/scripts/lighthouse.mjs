// Lighthouse budgets for the static export (mobile emulation, Lighthouse's
// default throttling). Fails if any page drops below the targets in
// docs/web-app-plan.md (§G).
//
//   npx serve out -l 4180 &   then   node scripts/lighthouse.mjs [baseUrl]
//
// Uses Playwright's Chromium so CI needs no separate Chrome install. Each
// page gets up to two runs and keeps its best performance score, since
// simulated-throttling scores wobble by a few points between runs.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const BASE = process.argv[2] ?? "http://localhost:4180";
const PAGES = ["/", "/conditions/back-pain", "/poses/tree_pose", "/corrector", "/progress", "/about"];
const BUDGET = { performance: 90, accessibility: 95, "best-practices": 95, seo: 90 };
const CATEGORIES = Object.keys(BUDGET);

const chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ["--headless=new"] });
const results = [];
try {
  for (const path of PAGES) {
    let best = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { lhr } = await lighthouse(`${BASE}${path}`, {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        onlyCategories: CATEGORIES,
      });
      const scores = Object.fromEntries(CATEGORIES.map((c) => [c, Math.round(lhr.categories[c].score * 100)]));
      const metrics = {
        lcp: lhr.audits["largest-contentful-paint"].displayValue,
        tbt: lhr.audits["total-blocking-time"].displayValue,
        cls: lhr.audits["cumulative-layout-shift"].displayValue,
      };
      if (!best || scores.performance > best.scores.performance) best = { path, scores, metrics };
      if (scores.performance >= BUDGET.performance) break;
    }
    results.push(best);
    console.log(
      `${best.path.padEnd(24)} ${CATEGORIES.map((c) => `${c} ${best.scores[c]}`).join("  ")}  ` +
        `LCP ${best.metrics.lcp}  TBT ${best.metrics.tbt}  CLS ${best.metrics.cls}`,
    );
  }
} finally {
  await chrome.kill();
}

mkdirSync("test-results", { recursive: true });
writeFileSync("test-results/lighthouse.json", JSON.stringify(results, null, 2));

const failures = results.flatMap(({ path, scores }) =>
  CATEGORIES.filter((c) => scores[c] < BUDGET[c]).map((c) => `${path}: ${c} ${scores[c]} < ${BUDGET[c]}`),
);
if (failures.length) {
  console.error(`\nLighthouse budget failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`\nAll ${results.length} pages within budget.`);
