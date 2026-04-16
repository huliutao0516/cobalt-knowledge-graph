import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const dataPath = path.join(process.cwd(), "assets", "cobalt_geoscene_data.js");

if (!fs.existsSync(dataPath)) {
  console.error(`Missing data bundle: ${dataPath}`);
  process.exit(1);
}

const source = fs.readFileSync(dataPath, "utf8");
const context = { window: {} };
vm.createContext(context);

try {
  new vm.Script(source, { filename: dataPath }).runInContext(context);
} catch (error) {
  console.error("Failed to evaluate data bundle.");
  console.error(error?.stack || String(error));
  process.exit(1);
}

const data = context.window.COBALT_GEOSCENE_DATA;
if (!data || !Array.isArray(data.transactions)) {
  console.error("COBALT_GEOSCENE_DATA is missing transactions.");
  process.exit(1);
}

const disallowedIds = new Set([
  "transaction::223MINKIMTRAIXM",
  "transaction::387MINTENSMETEN",
  "transaction::499MINKISTRAVIC"
]);

const hasWorkbookSource = (data.sources || []).some((item) => item.id === "source::tenke-kisanfu-extended-trace");
if (!hasWorkbookSource) {
  console.error("Missing Tenke/KFM workbook source entry in payload.");
  process.exit(1);
}

const hasWorkbookNote = data.transactions.some((tx) => (tx.notes || []).includes("Workbook import: Tenke_Kisanfu_extended_trace.xlsx"));
if (!hasWorkbookNote) {
  console.error("Missing workbook-import note on Tenke/KFM replacement transactions.");
  process.exit(1);
}

const stillHasLegacy = data.transactions.some((tx) => disallowedIds.has(tx.id));
if (stillHasLegacy) {
  console.error("Legacy Tenke/KFM transactions are still present in the built payload.");
  process.exit(1);
}

const hasTenkeOverrideEdge = data.transactions.some((tx) =>
  tx.supplierCompanyId === "company::tenke-fungurume-mining-tfm"
  && tx.buyerCompanyId === "company::ixm-sa"
  && tx.supplierStage === "Mining"
  && tx.buyerStage === "Trading"
);

if (!hasTenkeOverrideEdge) {
  console.error("Missing expected Tenke replacement edge (TFM -> IXM SA).");
  process.exit(1);
}

const hasKfmOverrideEdge = data.transactions.some((tx) =>
  tx.supplierCompanyId === "company::kisanfu-mine-kfm"
  && tx.buyerCompanyId === "company::ixm-sa"
  && tx.supplierStage === "Mining"
  && tx.buyerStage === "Trading"
);

if (!hasKfmOverrideEdge) {
  console.error("Missing expected KFM replacement edge (KFM -> IXM SA).");
  process.exit(1);
}

console.log("Tenke/KFM override checks passed.");
