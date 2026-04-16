from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "tenke_kfm_override.json"
EXPORT_DIR = ROOT / "exports" / "material_flows"

MINE_CONFIG = {
    "Tenke Fungurume": {
        "slug": "tfm",
        "title": "TFM 物质流图",
        "root_name": "Tenke Fungurume Mining (TFM)",
        "subtitle": "边宽代表 workbook 路径出现次数，节点按阶段从左到右展开。",
        "direction": "阶段顺序：Mining → Smelting → Trading → Refining → Precursor → Cathode → Cell → Pack → EV / Scooter",
    },
    "Kisanfu": {
        "slug": "kfm",
        "title": "KFM 物质流图",
        "root_name": "Kisanfu mine (KFM)",
        "subtitle": "边宽代表 workbook 路径出现次数，节点按阶段从左到右展开。",
        "direction": "阶段顺序：Mining → Smelting → Trading → Refining → Precursor → Cathode → Cell → Pack → EV / Scooter",
    },
}

STAGE_ORDER = [
    "Mining",
    "Smelting",
    "Trading",
    "Refining",
    "Precursor manufacturing",
    "Cathode manufacturing",
    "Battery cell manufacturing",
    "Battery pack manufacturing",
    "Electric car / scooter manufacturing",
]

STAGE_LABELS = {
    "Mining": "Mining",
    "Smelting": "Smelting",
    "Trading": "Trading",
    "Refining": "Refining",
    "Precursor manufacturing": "Precursor",
    "Cathode manufacturing": "Cathode",
    "Battery cell manufacturing": "Cell",
    "Battery pack manufacturing": "Pack",
    "Electric car / scooter manufacturing": "EV / Scooter",
}

STAGE_COLORS = {
    "Mining": "#3de2d8",
    "Smelting": "#8fff68",
    "Trading": "#ffd85a",
    "Refining": "#d6ff56",
    "Precursor manufacturing": "#ffae57",
    "Cathode manufacturing": "#ff7d7d",
    "Battery cell manufacturing": "#ff64c8",
    "Battery pack manufacturing": "#d18bff",
    "Electric car / scooter manufacturing": "#7ab6ff",
}

CJK_PATTERN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")


def font_path() -> str | None:
    candidates = [
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    return None


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = font_path()
    if path:
        return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def display_stage(stage: str) -> str:
    if stage in {"Electric car manufacturing", "Electric scooter manufacturing"}:
        return "Electric car / scooter manufacturing"
    return stage


def parse_path_count(notes: List[str]) -> int:
    for note in notes:
        if note.startswith("Workbook path count:"):
            try:
                return int(note.split(":", 1)[1].strip())
            except ValueError:
                return 1
    return 1


def normalize_entity_name(name: str) -> str:
    segments = [segment.strip() for segment in name.split("/") if segment.strip()]
    if len(segments) == 1:
        return name.strip()
    english_segments = [segment for segment in segments if not CJK_PATTERN.search(segment)]
    if english_segments:
        return " / ".join(english_segments)
    return segments[0]


def load_edges_for_mine(mine: str) -> Tuple[Dict[Tuple[str, str, str, str], int], Dict[Tuple[str, str], int]]:
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    edge_weights: Dict[Tuple[str, str, str, str], int] = defaultdict(int)
    node_weights: Dict[Tuple[str, str], int] = defaultdict(int)

    for tx in payload["transactions"]:
        notes = tx.get("notes", [])
        if f"Workbook mine: {mine}" not in notes:
            continue
        left_stage = display_stage(tx["supplierStage"])
        right_stage = display_stage(tx["buyerStage"])
        left_name = normalize_entity_name(tx["supplierCompany"])
        right_name = normalize_entity_name(tx["buyerCompany"])
        weight = parse_path_count(notes)
        edge_weights[(left_stage, left_name, right_stage, right_name)] += weight
        node_weights[(left_stage, left_name)] += weight
        node_weights[(right_stage, right_name)] += weight

    return edge_weights, node_weights


def build_layout(
    edge_weights: Dict[Tuple[str, str, str, str], int],
    node_weights: Dict[Tuple[str, str], int],
) -> Tuple[dict, int, int]:
    stage_nodes: Dict[str, List[str]] = defaultdict(list)
    for stage, name in node_weights:
        stage_nodes[stage].append(name)

    for stage in STAGE_ORDER:
        stage_nodes.setdefault(stage, [])
        stage_nodes[stage] = sorted(
            stage_nodes[stage],
            key=lambda name: (-node_weights[(stage, name)], name.lower()),
        )

    max_nodes = max(max(len(items), 1) for items in stage_nodes.values())
    width = 460 + (len(STAGE_ORDER) - 1) * 250
    height = max(980, 300 + max_nodes * 78)

    node_w = 204
    base_node_h = 40
    line_height = 14
    title_y = 92
    stage_y = 208
    top_y = 260
    bottom_margin = 108
    content_h = height - top_y - bottom_margin

    positions = {}
    node_lines: Dict[Tuple[str, str], List[str]] = {}
    node_heights: Dict[Tuple[str, str], float] = {}
    for col, stage in enumerate(STAGE_ORDER):
        items = stage_nodes[stage]
        x = 120 + col * 250
        count = max(len(items), 1)
        if not items:
            continue
        for name in items:
            lines = wrap_label(name, 28)
            node_lines[(stage, name)] = lines
            node_heights[(stage, name)] = base_node_h + max(0, len(lines) - 1) * line_height
        total_node_h = sum(node_heights[(stage, name)] for name in items)
        gap = max(8.0, (content_h - total_node_h) / (count + 1))
        y_cursor = top_y + gap
        for name in items:
            node_h = node_heights[(stage, name)]
            y = y_cursor + node_h / 2
            positions[(stage, name)] = {"x": x, "y": y}
            y_cursor += node_h + gap

    return {
        "stage_nodes": stage_nodes,
        "positions": positions,
        "node_w": node_w,
        "line_height": line_height,
        "title_y": title_y,
        "stage_y": stage_y,
        "edge_weights": edge_weights,
        "node_weights": node_weights,
        "node_lines": node_lines,
        "node_heights": node_heights,
    }, width, height


def edge_width(weight: int, max_weight: int) -> float:
    if max_weight <= 1:
        return 3.0
    return 2.0 + 12.0 * (weight / max_weight) ** 0.65


def svg_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def wrap_label(text: str, limit: int = 26) -> List[str]:
    if len(text) <= limit:
        return [text]
    chunks = []
    remaining = text
    while len(remaining) > limit:
        chunks.append(remaining[:limit].rstrip())
        remaining = remaining[limit:].lstrip()
    if remaining:
        chunks.append(remaining)
    return chunks


def render_svg(config: dict, layout: dict, width: int, height: int) -> str:
    max_weight = max(layout["edge_weights"].values()) if layout["edge_weights"] else 1
    header_x = 88
    header_y = 34
    header_w = width - 176
    header_h = 168
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<defs>',
        '<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">'
        '<feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.12"/>'
        '</filter>',
        '</defs>',
        f'<rect width="{width}" height="{height}" fill="#f6f8fb"/>',
        f'<g filter="url(#shadow)"><rect x="{header_x}" y="{header_y}" width="{header_w}" height="{header_h}" rx="18" fill="#ffffff" stroke="#dfe6ee" stroke-width="1.5"/></g>',
        f'<text x="120" y="{layout["title_y"]}" font-family="Microsoft YaHei, Arial, sans-serif" font-size="30" font-weight="700" fill="#111827">{svg_escape(config["title"])}</text>',
        f'<text x="120" y="{layout["title_y"] + 34}" font-family="Arial, sans-serif" font-size="17" font-weight="600" fill="#1f2937">{svg_escape(config["root_name"])}</text>',
        f'<text x="120" y="{layout["title_y"] + 64}" font-family="Microsoft YaHei, Arial, sans-serif" font-size="15" fill="#4b5d73">{svg_escape(config["subtitle"])}</text>',
        f'<text x="120" y="{layout["title_y"] + 92}" font-family="Microsoft YaHei, Arial, sans-serif" font-size="15" fill="#1f6fb9">{svg_escape(config["direction"])}</text>',
    ]

    for col, stage in enumerate(STAGE_ORDER):
        x = 120 + col * 250
        color = STAGE_COLORS[stage]
        lines.append(
            f'<rect x="{x - 16}" y="{layout["stage_y"] + 18}" width="{layout["node_w"] + 30}" height="{height - layout["stage_y"] - 52}" rx="22" fill="#c7d4e6" fill-opacity="0.17"/>'
        )
        lines.append(
            f'<g><rect x="{x - 10}" y="{layout["stage_y"] - 24}" width="156" height="34" rx="17" fill="{color}" fill-opacity="0.18"/>'
            f'<text x="{x}" y="{layout["stage_y"]}" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#0f172a">{svg_escape(STAGE_LABELS[stage])}</text></g>'
        )

    for (left_stage, left_name, right_stage, right_name), weight in sorted(
        layout["edge_weights"].items(),
        key=lambda item: item[1],
    ):
        left = layout["positions"][(left_stage, left_name)]
        right = layout["positions"][(right_stage, right_name)]
        start_x = left["x"] + layout["node_w"]
        start_y = left["y"]
        end_x = right["x"]
        end_y = right["y"]
        bend = (end_x - start_x) * 0.42
        stroke = edge_width(weight, max_weight)
        lines.append(
            f'<path d="M {start_x:.1f} {start_y:.1f} C {start_x + bend:.1f} {start_y:.1f}, {end_x - bend:.1f} {end_y:.1f}, {end_x:.1f} {end_y:.1f}" '
            f'stroke="#486179" stroke-opacity="0.22" stroke-width="{stroke:.2f}" fill="none"/>'
        )

    for stage in STAGE_ORDER:
        for name in layout["stage_nodes"][stage]:
            pos = layout["positions"][(stage, name)]
            x = pos["x"]
            node_h = layout["node_heights"][(stage, name)]
            y = pos["y"] - node_h / 2
            color = STAGE_COLORS[stage]
            lines.append(
                f'<g filter="url(#shadow)">'
                f'<rect x="{x}" y="{y:.1f}" width="{layout["node_w"]}" height="{node_h:.1f}" rx="14" fill="white" stroke="{color}" stroke-width="2"/>'
                f'<rect x="{x}" y="{y:.1f}" width="10" height="{node_h:.1f}" rx="14" fill="{color}"/>'
            )
            text_lines = layout["node_lines"][(stage, name)]
            start_y = pos["y"] - (len(text_lines) - 1) * layout["line_height"] / 2 + 1
            for idx, text in enumerate(text_lines):
                ty = start_y + idx * layout["line_height"]
                lines.append(
                    f'<text x="{x + 18}" y="{ty:.1f}" font-family="Arial, sans-serif" font-size="12.5" fill="#111827">{svg_escape(text)}</text>'
                )
            weight = layout["node_weights"][(stage, name)]
            lines.append(
                f'<text x="{x + layout["node_w"] - 14}" y="{pos["y"] + 4:.1f}" text-anchor="end" font-family="Arial, sans-serif" font-size="11.5" fill="#64748b">{weight}</text></g>'
            )

    lines.append("</svg>")
    return "\n".join(lines)


def render_png(config: dict, layout: dict, width: int, height: int, out_path: Path) -> None:
    scale = 2
    canvas = Image.new("RGBA", (width * scale, height * scale), "#f6f8fb")
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(28 * scale)
    root_font = load_font(16 * scale)
    subtitle_font = load_font(14 * scale)
    stage_font = load_font(14 * scale)
    node_font = load_font(12 * scale)
    meta_font = load_font(11 * scale)

    draw.rectangle((0, 0, width * scale, height * scale), fill="#f6f8fb")
    header_box = (88 * scale, 34 * scale, (width - 88) * scale, 202 * scale)
    draw.rounded_rectangle(header_box, radius=18 * scale, fill="#ffffff", outline="#dfe6ee", width=2 * scale)
    draw.text((120 * scale, (layout["title_y"] - 26) * scale), config["title"], font=title_font, fill="#111827")
    draw.text(
        (120 * scale, (layout["title_y"] + 6) * scale),
        config["root_name"],
        font=root_font,
        fill="#1f2937",
    )
    draw.text(
        (120 * scale, (layout["title_y"] + 36) * scale),
        config["subtitle"],
        font=subtitle_font,
        fill="#4b5d73",
    )
    draw.text(
        (120 * scale, (layout["title_y"] + 64) * scale),
        config["direction"],
        font=subtitle_font,
        fill="#1f6fb9",
    )

    max_weight = max(layout["edge_weights"].values()) if layout["edge_weights"] else 1

    for col, stage in enumerate(STAGE_ORDER):
        x = (120 + col * 250) * scale
        draw.rounded_rectangle(
            (
                (x - 16 * scale),
                (layout["stage_y"] + 18) * scale,
                (x + (layout["node_w"] + 14) * scale),
                (height - 52) * scale,
            ),
            radius=22 * scale,
            fill="#c7d4e62b",
        )
        y = (layout["stage_y"] - 28) * scale
        color = STAGE_COLORS[stage]
        pill = (x - 10 * scale, y, x + 146 * scale, y + 34 * scale)
        draw.rounded_rectangle(pill, radius=16 * scale, fill=color + "33")
        draw.text((x + 8 * scale, y + 7 * scale), STAGE_LABELS[stage], font=stage_font, fill="#0f172a")

    for (left_stage, left_name, right_stage, right_name), weight in sorted(
        layout["edge_weights"].items(),
        key=lambda item: item[1],
    ):
        left = layout["positions"][(left_stage, left_name)]
        right = layout["positions"][(right_stage, right_name)]
        start = ((left["x"] + layout["node_w"]) * scale, left["y"] * scale)
        mid1 = ((left["x"] + layout["node_w"] + 90) * scale, left["y"] * scale)
        mid2 = ((right["x"] - 90) * scale, right["y"] * scale)
        end = (right["x"] * scale, right["y"] * scale)
        points = [start, mid1, mid2, end]
        draw.line(points, fill="#48617938", width=max(2, int(edge_width(weight, max_weight) * scale)), joint="curve")

    for stage in STAGE_ORDER:
        color = STAGE_COLORS[stage]
        for name in layout["stage_nodes"][stage]:
            pos = layout["positions"][(stage, name)]
            node_h = layout["node_heights"][(stage, name)]
            text_lines = layout["node_lines"][(stage, name)]
            x = pos["x"] * scale
            y = (pos["y"] - node_h / 2) * scale
            box = (x, y, (pos["x"] + layout["node_w"]) * scale, (pos["y"] + node_h / 2) * scale)
            draw.rounded_rectangle(box, radius=14 * scale, fill="white", outline=color, width=2 * scale)
            draw.rounded_rectangle((x, y, x + 10 * scale, (pos["y"] + node_h / 2) * scale), radius=12 * scale, fill=color)
            start_y = pos["y"] - (len(text_lines) - 1) * layout["line_height"] / 2 - 9
            for idx, text in enumerate(text_lines):
                ty = (start_y + idx * layout["line_height"]) * scale
                draw.text((x + 18 * scale, ty), text, font=node_font, fill="#111827")
            weight = layout["node_weights"][(stage, name)]
            weight_text = str(weight)
            tw = draw.textbbox((0, 0), weight_text, font=meta_font)[2]
            draw.text((box[2] - tw - 12 * scale, pos["y"] * scale - 6 * scale), weight_text, font=meta_font, fill="#64748b")

    image = canvas.resize((width, height), Image.Resampling.LANCZOS)
    image.save(out_path, format="PNG")


def export_mine(mine: str, config: dict) -> None:
    edge_weights, node_weights = load_edges_for_mine(mine)
    layout, width, height = build_layout(edge_weights, node_weights)
    svg = render_svg(config, layout, width, height)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    svg_path = EXPORT_DIR / f"{config['slug']}_material_flow.svg"
    png_path = EXPORT_DIR / f"{config['slug']}_material_flow.png"
    svg_path.write_text(svg, encoding="utf-8")
    render_png(config, layout, width, height, png_path)


def main() -> None:
    for mine, config in MINE_CONFIG.items():
        export_mine(mine, config)
    print(f"Wrote exports to {EXPORT_DIR}")


if __name__ == "__main__":
    main()
