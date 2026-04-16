# Tenke/KFM Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace only the Tenke Fungurume and Kisanfu/KFM chains in the beta dataset with paths imported from `Tenke_Kisanfu_extended_trace.xlsx`, while leaving all other online content unchanged.

**Architecture:** Convert the workbook into a committed override JSON snapshot, then apply that snapshot only at the final payload-building stage of `assets/cobalt_geoscene_data.js`. Filter out the old Tenke/KFM transactions and operator links, merge the override entities/sources/transactions, rebuild the dataset, and publish the refreshed beta page.

**Tech Stack:** PowerShell build scripts, Python workbook export helper, Node verification scripts, GitHub Pages via `main`

---

### Task 1: Add a failing verification for the targeted override

**Files:**
- Create: `d:/zstp2/scripts/check_tenke_kfm_override.mjs`

- [ ] **Step 1: Write the failing test**

```js
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const dataPath = path.join(process.cwd(), "assets", "cobalt_geoscene_data.js");
const source = fs.readFileSync(dataPath, "utf8");
const context = { window: {} };
vm.createContext(context);
new vm.Script(source, { filename: dataPath }).runInContext(context);
const data = context.window.COBALT_GEOSCENE_DATA;

const disallowedIds = new Set([
  "transaction::223MINKIMTRAIXM",
  "transaction::387MINTENSMETEN",
  "transaction::499MINKISTRAVIC"
]);

const hasWorkbookSource = (data.sources || []).some((item) => item.id === "source::tenke-kisanfu-extended-trace");
const hasWorkbookNote = (data.transactions || []).some((tx) => (tx.notes || []).includes("Workbook import: Tenke_Kisanfu_extended_trace.xlsx"));
const stillHasLegacy = (data.transactions || []).some((tx) => disallowedIds.has(tx.id));

if (!hasWorkbookSource) {
  throw new Error("Missing Tenke/KFM workbook source entry in payload.");
}

if (!hasWorkbookNote) {
  throw new Error("Missing workbook-import note on Tenke/KFM replacement transactions.");
}

if (stillHasLegacy) {
  throw new Error("Legacy Tenke/KFM transactions are still present in the built payload.");
}

console.log("Tenke/KFM override checks passed.");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/check_tenke_kfm_override.mjs`
Expected: FAIL because the current payload still contains legacy Tenke/KFM transactions and no workbook-import marker.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-04-16-tenke-kfm-override.md scripts/check_tenke_kfm_override.mjs
git commit -m "test: add Tenke KFM override verification"
```

### Task 2: Export the workbook into a committed override snapshot

**Files:**
- Create: `d:/zstp2/scripts/export_tenke_kfm_override.py`
- Create: `d:/zstp2/data/tenke_kfm_override.json`

- [ ] **Step 1: Write the failing workbook export command expectation**

```python
from pathlib import Path

workbook_path = Path(r"C:\Users\胡刘涛\Downloads\Tenke_Kisanfu_extended_trace.xlsx")
assert workbook_path.exists()
```

- [ ] **Step 2: Run workbook export probe**

Run: `python scripts/export_tenke_kfm_override.py`
Expected: FAIL first because the export helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```python
# Read the workbook's `trace` sheet.
# Split semicolon-delimited stage cells into parallel company nodes.
# Map known companies to existing node ids from `companies.csv`.
# Emit a JSON snapshot with:
# - replaceCompanyIds
# - synthetic sources
# - synthetic entities for unmatched names
# - replacement transactions in final payload shape
```

- [ ] **Step 4: Run export and verify snapshot creation**

Run: `python scripts/export_tenke_kfm_override.py`
Expected: PASS and `data/tenke_kfm_override.json` exists with Tenke/KFM replacement data.

- [ ] **Step 5: Commit**

```bash
git add scripts/export_tenke_kfm_override.py data/tenke_kfm_override.json
git commit -m "feat: export Tenke KFM override snapshot"
```

### Task 3: Apply the override snapshot in the build pipeline

**Files:**
- Modify: `d:/zstp2/scripts/build_cobalt_geoscene_data.ps1`

- [ ] **Step 1: Write the failing test condition**

```powershell
$overridePath = Join-Path $root 'data\tenke_kfm_override.json'
if (-not (Test-Path $overridePath)) {
  throw "Missing override snapshot: $overridePath"
}
```

- [ ] **Step 2: Run build to verify it still lacks override support**

Run: `powershell -ExecutionPolicy Bypass -File scripts/build_cobalt_geoscene_data.ps1`
Expected: PASS build-wise, but `node scripts/check_tenke_kfm_override.mjs` still FAILS because the override snapshot is not yet applied.

- [ ] **Step 3: Write minimal implementation**

```powershell
# After txItems / entities / operatorPairs are built:
# - load data/tenke_kfm_override.json when present
# - filter out legacy txItems for replaceCompanyIds
# - filter out legacy operatorPairs for replaceCompanyIds
# - merge override sources into sourceMap
# - merge override entities into the entity list by id
# - append override operatorPairs
# - append override transactions
```

- [ ] **Step 4: Run build and verify override check passes**

Run: `powershell -ExecutionPolicy Bypass -File scripts/build_cobalt_geoscene_data.ps1`
Expected: PASS and `assets/cobalt_geoscene_data.js` rewritten.

Run: `node scripts/check_tenke_kfm_override.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/build_cobalt_geoscene_data.ps1 assets/cobalt_geoscene_data.js
git commit -m "feat: apply Tenke KFM beta override"
```

### Task 4: Refresh beta cache-busting and run full verification

**Files:**
- Modify: `d:/zstp2/cobalt_knowledge_graph_beta.html`

- [ ] **Step 1: Write the failing cache-bust expectation**

```html
<script src="assets/cobalt_geoscene_data.js"></script>
```

- [ ] **Step 2: Run existing verification**

Run: `node scripts/check_cobalt_knowledge_graph.mjs`
Expected: PASS before and after this task.

- [ ] **Step 3: Write minimal implementation**

```html
<script src="assets/cobalt_geoscene_data.js?v=20260416a"></script>
```

- [ ] **Step 4: Run verification again**

Run: `node scripts/check_cobalt_knowledge_graph.mjs`
Expected: PASS

Run: `node scripts/check_tenke_kfm_override.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cobalt_knowledge_graph_beta.html
git commit -m "chore: refresh beta dataset cache bust"
```

### Task 5: Publish to GitHub Pages

**Files:**
- Modify: `d:/zstp2/assets/cobalt_geoscene_data.js`
- Modify: `d:/zstp2/cobalt_knowledge_graph_beta.html`

- [ ] **Step 1: Inspect final working tree**

Run: `git status --short`
Expected: only the intended Tenke/KFM override files plus any unrelated pre-existing user files.

- [ ] **Step 2: Push to GitHub Pages source branch**

Run: `git push origin main`
Expected: PASS

- [ ] **Step 3: Smoke-check the published beta URL**

Run: open `https://huliutao0516.github.io/cobalt-knowledge-graph/cobalt_knowledge_graph_beta.html?refresh=20260416a`
Expected: the Tenke and KFM chains reflect the workbook-derived override while the rest of the graph remains unchanged.
