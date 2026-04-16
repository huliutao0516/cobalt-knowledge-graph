from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
EXPORT_DIR = ROOT / "exports" / "material_flows"

required = [
    EXPORT_DIR / "tfm_material_flow.svg",
    EXPORT_DIR / "tfm_material_flow.png",
    EXPORT_DIR / "kfm_material_flow.svg",
    EXPORT_DIR / "kfm_material_flow.png",
]

for path in required:
    if not path.exists():
        raise SystemExit(f"Missing export: {path}")

svg_checks = {
    EXPORT_DIR / "tfm_material_flow.svg": [
        "TFM 物质流图",
        "Tenke Fungurume Mining (TFM)",
        "边宽代表 workbook 路径出现次数，节点按阶段从左到右展开。",
        "阶段顺序：Mining → Smelting → Trading → Refining",
    ],
    EXPORT_DIR / "kfm_material_flow.svg": [
        "KFM 物质流图",
        "Kisanfu mine (KFM)",
        "边宽代表 workbook 路径出现次数，节点按阶段从左到右展开。",
        "阶段顺序：Mining → Trading → Refining",
    ],
}

for path, snippets in svg_checks.items():
    content = path.read_text(encoding="utf-8")
    for snippet in snippets:
        if snippet not in content:
            raise SystemExit(f"Missing '{snippet}' in {path}")

for path in required:
    if path.stat().st_size < 1024:
        raise SystemExit(f"Export looks too small: {path}")

print("Material flow exports verified.")
