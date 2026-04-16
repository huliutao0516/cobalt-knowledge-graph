import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "assets", "cobalt_knowledge_graph_app.js");

if (!fs.existsSync(appPath)) {
  console.error(`Missing app script: ${appPath}`);
  process.exit(1);
}

const source = fs.readFileSync(appPath, "utf8");
const requiredSnippets = [
  "function stageAwareRouteText(",
  "function drawChainDirectionGuide(",
  "供应链方向：上游（左） → 下游（右）",
  "const DEFAULT_CHAIN3D_VIEW = Object.freeze({ yaw: -0.34, pitch: 0.18, zoom: 1 });",
  "route = stageAwareRouteText(tx, { includeEntities: true });",
  "return `${kindText} | ${stageAwareRouteText(tx)} | ${transactionCommodity(tx)} | ${formatDate(tx)}`;"
];

const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
if (missing.length) {
  console.error("Missing required local-chain clarity snippets:");
  missing.forEach((snippet) => console.error(`- ${snippet}`));
  process.exit(1);
}

console.log("TFM/KFM chain clarity snippets verified:", appPath);
