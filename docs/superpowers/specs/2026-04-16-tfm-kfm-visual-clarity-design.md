# TFM / KFM Visual Clarity And Export Polish Design

## Goal

Improve clarity for TFM and KFM chain presentation in two places without publishing any online changes yet:

1. Fix misleading on-site visual expression so TFM and KFM chain order is read correctly as stage-based left-to-right flow.
2. Beautify the standalone TFM and KFM material flow exports with a moderate polish pass that preserves the current structure.

## User-Approved Scope

### In scope

- Update all local site views that can present the TFM/KFM to IXM to Umicore chain, so the sequence is not visually misleading.
- Do not beautify the on-site views.
- Beautify only the exported TFM and KFM material flow diagrams.
- Keep export outputs as both SVG and PNG.
- Keep English entity names in the diagrams and Chinese titles.
- Preserve weighted edges where line width reflects workbook path counts.
- Keep all work local only; do not upload or sync online in this task.

### Out of scope

- Reworking the broader site visual language.
- Changing the underlying TFM/KFM override data.
- Publishing to GitHub Pages or any remote target.
- Re-exporting or redesigning diagrams for mines other than TFM and KFM.

## Problem Statement

The underlying override data is already in the intended order:

- TFM (Mining) -> TFM (Smelting) -> IXM SA (Trading) -> Umicore S.A. (Refining)
- KFM (Mining) -> IXM SA (Trading) -> Umicore S.A. (Refining)

The issue is not incorrect source data. The issue is that some visual presentations do not make stage direction explicit enough, which can cause readers to interpret Umicore as appearing before IXM. This is most likely in interactive chain views where spatial perspective or repeated company names across stages reduce directional clarity.

Separately, the exported material flow diagrams currently have low visual hierarchy and contain mojibake in Chinese text, which reduces readability and presentation quality.

## Selected Approach

Use a structure-first clarity pass for the local site and a moderate polish pass for exports.

### Why this approach

- It addresses the real issue, which is visual interpretation rather than data order.
- It improves comprehension without redesigning the whole product.
- It keeps risk low by preserving the current data model and most of the existing layout logic.
- It matches the user's request to avoid beautifying the on-site views while still improving exported visuals.

## Design

### A. Local site clarity updates

#### Target views

Apply the clarity fixes to all local views that can show the TFM/KFM chain order, especially:

- 3D chain view
- hierarchy / layered chain view
- relation list and any supporting route labels
- other chain-adjacent explanatory text that surfaces supplier stage to buyer stage ordering

#### Visual rules

1. Stage order must read left to right as the primary interpretation.
2. Trading must be visually understood as preceding Refining in the TFM/KFM route.
3. Repeated company names across multiple stages must always show stage context when ambiguity is possible.
4. The clarification should be achieved without changing the underlying transaction ordering or adding mine-specific hardcoded routing logic.

#### 3D chain design

- Keep the existing stage-driven node grouping.
- Strengthen persistent stage orientation by adding explicit left-to-right direction guidance in the rendered view.
- Make stage columns easier to interpret even when the model is rotated.
- Adjust the default camera orientation and/or edge arrow emphasis so the initial view strongly communicates upstream-to-downstream order.
- Ensure labels and hover content preserve stage context where a company appears in more than one stage.

#### Hierarchy and relation design

- Update route text to use complete stage-aware expressions when rendering TFM/KFM-relevant chains.
- Prefer chain text that includes both entity and stage context, rather than leaving readers to infer stage from placement alone.
- Preserve sorting by stage order so textual lists and visual groupings stay aligned.

### B. Export diagram polish

#### Layout

- Keep the current stage-column layout and left-to-right progression.
- Preserve the existing export file names and destination directory.
- Continue using the override dataset and workbook path count aggregation already in place.

#### Visual updates

- Replace mojibake Chinese strings with proper Chinese titles and subtitle text.
- Improve stage headers so columns are more scannable.
- Increase directional clarity with a concise subtitle or guide text that states the left-to-right progression.
- Improve node cards, spacing, and edge styling for clearer reading in reports.
- Preserve edge-weight encoding while making relative thickness differences easier to see.

#### Language treatment

- Titles: Chinese
- Entity names: English
- Stage headers: English, consistent with the current diagram language
- Supporting subtitle or legend: Chinese

## Components And File Impact

### Expected code changes

- `d:/zstp2/assets/cobalt_knowledge_graph_app.js`
  - refine chain-view directional cues and stage-aware labels
- `d:/zstp2/scripts/export_material_flows.py`
  - fix text encoding output and improve export styling

### Expected generated outputs

- `d:/zstp2/exports/material_flows/tfm_material_flow.svg`
- `d:/zstp2/exports/material_flows/tfm_material_flow.png`
- `d:/zstp2/exports/material_flows/kfm_material_flow.svg`
- `d:/zstp2/exports/material_flows/kfm_material_flow.png`

## Data Flow

1. Local site reads the same TFM/KFM override transactions already present in `data/tenke_kfm_override.json`.
2. Chain-related views continue deriving stage order from the existing `stageOrder` logic.
3. Presentation logic adds stronger direction and stage context without altering transaction semantics.
4. Export generation continues reading the override file, aggregating weighted edges, and rendering one diagram per mine.

## Error Handling And Safety

- If an expected stage is absent for a selected mine, the site should continue rendering remaining stages without breaking layout.
- If a label must be shortened, stage context should still remain visible where ambiguity would otherwise occur.
- Export rendering should tolerate missing optional data the same way it does today and still emit files if the required route data exists.
- No online deployment step is included in this design.

## Testing And Verification

### Local site verification

- Check TFM chain presentation locally and confirm it reads as:
  - TFM (Mining) -> TFM (Smelting) -> IXM SA (Trading) -> Umicore S.A. (Refining)
- Check KFM chain presentation locally and confirm it reads as:
  - KFM (Mining) -> IXM SA (Trading) -> Umicore S.A. (Refining)
- Review all affected chain views to ensure they communicate the same direction consistently.

### Export verification

- Run the export script to regenerate the TFM and KFM diagrams.
- Run the existing export verification script.
- Confirm the new SVG and PNG files exist and contain corrected Chinese titles.
- Spot-check the exported diagrams for:
  - proper Chinese text rendering
  - preserved left-to-right stage order
  - readable weighted edges
  - improved spacing and visual hierarchy

## Non-Goals And Release Note

- This work intentionally stops before any online upload.
- Publishing, cache-busting, or remote sync will be a separate follow-up step after review.
