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

const tradingIndex = (data.stageOrder || []).indexOf("Trading");
const refiningIndex = (data.stageOrder || []).indexOf("Refining");
if (tradingIndex === -1 || refiningIndex === -1) {
  console.error("Missing Trading or Refining in payload stageOrder.");
  process.exit(1);
}

if (tradingIndex > refiningIndex) {
  console.error("Trading is still ordered after Refining in payload stageOrder.");
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
  && tx.supplierStage === "Smelting"
  && tx.buyerStage === "Trading"
);

if (!hasTenkeOverrideEdge) {
  console.error("Missing expected Tenke replacement edge (TFM -> IXM SA).");
  process.exit(1);
}

const hasTenkeSmeltingStep = data.transactions.some((tx) =>
  tx.supplierCompanyId === "company::tenke-fungurume-mining-tfm"
  && tx.buyerCompanyId === "company::tenke-fungurume-mining-tfm"
  && tx.supplierStage === "Mining"
  && tx.buyerStage === "Smelting"
);

if (!hasTenkeSmeltingStep) {
  console.error("Missing expected Tenke smelting step (Mining -> Smelting).");
  process.exit(1);
}

const hasTradingToRefiningStep = data.transactions.some((tx) =>
  tx.supplierCompanyId === "company::ixm-sa"
  && tx.buyerCompanyId === "company::umicore-s-a"
  && tx.supplierStage === "Trading"
  && tx.buyerStage === "Refining"
);

if (!hasTradingToRefiningStep) {
  console.error("Missing expected Tenke/KFM trading-to-refining step (IXM SA -> Umicore S.A.).");
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

const unexpectedUmicoreSmelting = data.transactions.filter((tx) =>
  tx.supplierCompanyId === "company::umicore-s-a"
  && tx.supplierStage === "Smelting"
  && String(tx.id || "").startsWith("transaction::override-tenke-kfm-")
);

if (unexpectedUmicoreSmelting.length) {
  console.error("Unexpected Umicore smelting-stage override transactions remain in payload.");
  console.error(unexpectedUmicoreSmelting.map((tx) => tx.id).join(", "));
  process.exit(1);
}

const kokkolaRefiningFacilities = new Set(
  data.transactions
    .filter((tx) =>
      tx.buyerCompanyId === "company::umicore-s-a"
      && tx.buyerStage === "Refining"
      && String(tx.buyerFacility || "").includes("Refinery Precursor Plant")
      && String(tx.buyerCountry || "") === "Finland"
    )
    .map((tx) => tx.buyerFacilityId)
    .filter(Boolean)
);

if (kokkolaRefiningFacilities.size > 1) {
  console.error("Refining-stage Kokkola 'Refinery Precursor Plant' still resolves to multiple facility IDs.");
  console.error([...kokkolaRefiningFacilities].join(", "));
  process.exit(1);
}

console.log("Tenke/KFM override checks passed.");
