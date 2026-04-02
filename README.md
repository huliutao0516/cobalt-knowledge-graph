# Cobalt Knowledge Graph

GeoScene-style cobalt supply chain knowledge graph preview with a globe view, regional drilldown, searchable entities, detail cards, and upstream/downstream layered tracing.

## Main Entry

- `index.html`
- `cobalt_geoscene_preview.html`

## Local Preview

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start_preview_server.ps1
```

Then open:

`http://127.0.0.1:8765/cobalt_geoscene_preview.html`

## Rebuild Data

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build_cobalt_geoscene_data.ps1
```

## Included Content

- cobalt GeoScene-style preview page
- local globe textures and fallback Earth layer
- build scripts
- core CSV/JSON source data required to regenerate the preview dataset

## Current Data Gaps

- product code fields are still missing
- quantity coverage is partial
- facility imagery fields are still missing
