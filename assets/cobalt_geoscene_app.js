(() => {
  const DATA = window.COBALT_GEOSCENE_DATA;

  if (!DATA || !Array.isArray(DATA.transactions)) {
    document.body.innerHTML = "<div style='padding:32px;color:#fff;font-family:Segoe UI,Microsoft YaHei,sans-serif'>缺少数据文件，请先运行 scripts/build_cobalt_geoscene_data.ps1。</div>";
    return;
  }

  const byId = (id) => document.getElementById(id);
  const fmt = new Intl.NumberFormat("zh-CN");
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const isNum = (value) => Number.isFinite(Number(value));
  const toArray = (value) => Array.isArray(value)
    ? value.filter((item) => item !== null && item !== undefined && item !== "")
    : (value === null || value === undefined || value === "" ? [] : [value]);
  const safeText = (value, fallback = "未标注") => {
    const text = String(value ?? "").trim();
    return text || fallback;
  };
  const shortText = (value, limit = 22) => {
    const text = safeText(value, "未命名");
    return text.length > limit ? `${text.slice(0, Math.max(1, limit - 1))}…` : text;
  };
  const withAlpha = (hex, alpha = "ff") => {
    const text = String(hex || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(text)) return `${text}${alpha}`;
    return text || "#7fd0ff";
  };

  const STAGE_LABELS = {
    "Artisanal mining": "手工采矿",
    "Mining": "采矿",
    "Artisanal processing": "手工加工",
    "Smelting": "冶炼",
    "Refining": "精炼",
    "Trading": "贸易",
    "Precursor manufacturing": "前驱体制造",
    "Cathode manufacturing": "正极材料制造",
    "Battery cell manufacturing": "电芯制造",
    "Battery pack manufacturing": "电池包制造",
    "Electric car manufacturing": "电动汽车制造",
    "Electric scooter manufacturing": "电动两轮制造",
    "Recycling": "回收"
  };

  const COUNTRY_LABELS = new Map(Object.entries({
    china: "中国",
    "democratic republic of the congo": "刚果（金）",
    "dr congo": "刚果（金）",
    drc: "刚果（金）",
    congo: "刚果（金）",
    zambia: "赞比亚",
    indonesia: "印度尼西亚",
    finland: "芬兰",
    germany: "德国",
    france: "法国",
    belgium: "比利时",
    switzerland: "瑞士",
    japan: "日本",
    "south korea": "韩国",
    korea: "韩国",
    singapore: "新加坡",
    canada: "加拿大",
    australia: "澳大利亚",
    usa: "美国",
    "u.s.": "美国",
    "u.s.a.": "美国",
    "united states": "美国",
    "united states of america": "美国",
    uk: "英国",
    "united kingdom": "英国",
    england: "英国",
    netherlands: "荷兰",
    norway: "挪威",
    sweden: "瑞典",
    poland: "波兰",
    india: "印度",
    philippines: "菲律宾",
    luxembourg: "卢森堡",
    portugal: "葡萄牙",
    spain: "西班牙",
    italy: "意大利",
    austria: "奥地利",
    "south africa": "南非",
    southafrica: "南非",
    morocco: "摩洛哥",
    argentina: "阿根廷",
    chile: "智利",
    mexico: "墨西哥",
    taiwan: "中国台湾",
    "hong kong": "中国香港",
    tanzania: "坦桑尼亚",
    brazil: "巴西",
    turkey: "土耳其",
    vietnam: "越南"
  }));

  const POINT_ORIGIN_LABELS = {
    facility: "设施坐标",
    company: "企业坐标",
    centroid: "区域中心点",
    inferred: "推定坐标"
  };

  const ENTITY_TYPE_LABELS = {
    company: "企业",
    facility: "矿点/设施"
  };

  const TEXTURES = {
    github: {
      label: "GitHub 开源高清版",
      url: "assets/earth_github_4096.jpg",
      hint: "已使用 GitHub 开源地球纹理的本地缓存版本，兼顾清晰度和加载速度。"
    },
    sharp: {
      label: "本地高清版",
      url: "assets/earth_satellite_5400.jpg",
      hint: "当前使用本地高清纹理，细节更丰富。"
    },
    balanced: {
      label: "本地流畅版",
      url: "assets/earth_satellite_1350.jpg",
      hint: "当前使用本地流畅纹理，优先保证交互性能。"
    }
  };

  const FILE_PROTOCOL_HINT = window.location.protocol === "file:"
    ? "如果你是直接双击 HTML 打开，建议运行 scripts/start_preview_server.ps1，再访问 http://127.0.0.1:8765/cobalt_geoscene_preview.html。"
    : "";

  const stageOrder = DATA.stageOrder || [];
  const stageColors = DATA.stageColors || {};
  const stageLookup = new Map(stageOrder.map((stage) => [String(stage).toLowerCase(), stage]));

  const entities = new Map((DATA.entities || []).map((entity) => [entity.id, entity]));
  const sources = new Map((DATA.sources || []).map((source) => [source.id, source]));
  const transactions = (DATA.transactions || []).map((tx) => ({
    ...tx,
    supplierStage: stageLookup.get(String(tx.supplierStage || "").toLowerCase()) || tx.supplierStage || "Unknown",
    buyerStage: stageLookup.get(String(tx.buyerStage || "").toLowerCase()) || tx.buyerStage || "Unknown",
    inputCommodities: toArray(tx.inputCommodities),
    outputCommodities: toArray(tx.outputCommodities),
    inputCommodityIds: toArray(tx.inputCommodityIds),
    outputCommodityIds: toArray(tx.outputCommodityIds),
    sourceIds: toArray(tx.sourceIds),
    notes: toArray(tx.notes)
  }));
  const txById = new Map(transactions.map((tx) => [tx.id, tx]));

  const companyFacilities = new Map();
  const facilityCompany = new Map();
  const txByEntity = new Map();

  const pushMapArray = (map, key, value) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };

  (DATA.operatorPairs || []).forEach((pair) => {
    pushMapArray(companyFacilities, pair.companyId, pair.facilityId);
    if (pair.facilityId && !facilityCompany.has(pair.facilityId)) facilityCompany.set(pair.facilityId, pair.companyId);
  });

  transactions.forEach((tx) => {
    [tx.supplierCompanyId, tx.buyerCompanyId, tx.supplierFacilityId, tx.buyerFacilityId].filter(Boolean).forEach((id) => {
      pushMapArray(txByEntity, id, tx);
    });
  });

  const searchCatalog = [...entities.values()].map((entity) => ({
    id: entity.id,
    type: entity.type,
    name: entity.name,
    country: entity.country || "",
    count: (txByEntity.get(entity.id) || []).length,
    blob: [
      entity.name,
      entity.searchLabel,
      entity.displayName,
      entity.place,
      entity.country,
      entity.facilityType
    ].filter(Boolean).join(" ").toLowerCase()
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "en"));

  const tooltip = byId("tooltip");
  const earthFallback = byId("earthFallback");
  const earthSphere = earthFallback ? earthFallback.querySelector(".earth-sphere") : null;
  const globeHost = byId("globe");

  const state = {
    stage: "all",
    texture: "github",
    labels: true,
    dense: false,
    autoRotate: true,
    selectedEntityId: "",
    selectedTxId: "",
    evidenceOpen: false,
    view: { lat: 16, lng: 102, altitude: 2.35 },
    textureNotice: "",
    globeNotice: "",
    globeMode: "pending",
    pointerX: 0,
    pointerY: 0,
    suppressViewSync: false
  };

  let globe = null;
  let viewSyncTimer = 0;

  function displayStage(stage) {
    return STAGE_LABELS[stage] || safeText(stage);
  }

  function displayCountry(country) {
    const raw = String(country || "").trim();
    if (!raw) return "未标注";
    return COUNTRY_LABELS.get(raw.toLowerCase()) || raw;
  }

  function displayEntityType(type) {
    return ENTITY_TYPE_LABELS[type] || safeText(type);
  }

  function displayPointOrigin(origin) {
    return POINT_ORIGIN_LABELS[String(origin || "").toLowerCase()] || safeText(origin);
  }

  function displayFacilityType(value) {
    let text = String(value || "").trim();
    if (!text) return "";
    const replacements = [
      [/Battery producer/gi, "电池生产商"],
      [/Electric car producer/gi, "电动汽车生产商"],
      [/Electric scooter producer/gi, "电动两轮生产商"],
      [/Cathode producer/gi, "正极材料生产商"],
      [/Precursor producer/gi, "前驱体生产商"],
      [/Commodity trader/gi, "贸易商"],
      [/Refiner/gi, "精炼企业"],
      [/Smelter/gi, "冶炼企业"],
      [/Miner/gi, "矿业企业"],
      [/Battery pack plant/gi, "电池包工厂"],
      [/Battery cell plant/gi, "电芯工厂"],
      [/Battery plant/gi, "电池工厂"],
      [/Electric car plant/gi, "电动汽车工厂"],
      [/Electric scooter plant/gi, "电动两轮工厂"],
      [/Cathode plant/gi, "正极材料工厂"],
      [/Precursor plant/gi, "前驱体工厂"],
      [/Refinery/gi, "精炼厂"],
      [/Smelter/gi, "冶炼厂"],
      [/Processing plant/gi, "加工厂"],
      [/Mine/gi, "矿点"],
      [/Headquarter/gi, "总部"],
      [/Office/gi, "办公室"],
      [/Plant/gi, "工厂"],
      [/Factory/gi, "工厂"]
    ];
    replacements.forEach(([pattern, replacement]) => {
      text = text.replace(pattern, replacement);
    });
    return text;
  }

  function parseFacilityText(raw) {
    const text = String(raw || "").trim();
    if (!text) return { type: "", country: "", place: "" };
    const parts = text.split("|").map((item) => item.trim()).filter(Boolean);
    return {
      type: parts[0] || "",
      country: parts[1] || "",
      place: parts.slice(2).join(" | ")
    };
  }

  function sourceLinksForTx(tx) {
    return tx.sourceIds.map((id) => sources.get(id)).filter(Boolean);
  }

  function formatAmount(tx) {
    return safeText(
      tx.amountTonnesRaw ||
      tx.amountUnitsRaw ||
      tx.amountUsdRaw ||
      tx.amountYuanRaw ||
      tx.amountEnergyRaw,
      "未标注"
    );
  }

  function formatDate(tx) {
    return safeText(tx.date || tx.expectedDate, "未标注");
  }

  function formatCoordinate(value) {
    return isNum(value) ? Number(value).toFixed(2) : "未标注";
  }

  function transactionCommodity(tx) {
    const inbound = tx.inputCommodities.join(" / ");
    const outbound = tx.outputCommodities.join(" / ");
    if (inbound && outbound && inbound !== outbound) return `${inbound} → ${outbound}`;
    return outbound || inbound || "未标注";
  }

  function getSvgViewport(svg, fallbackWidth, fallbackHeight) {
    const rect = svg.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width || fallbackWidth));
    const height = Math.max(220, Math.round(rect.height || fallbackHeight));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    return { width, height };
  }

  function estimateTextWidth(text, fontSize) {
    let units = 0;
    for (const ch of String(text || "")) {
      if (/\s/.test(ch)) units += 0.36;
      else if (/[A-Z0-9]/.test(ch)) units += 0.68;
      else if (/[a-z]/.test(ch)) units += 0.58;
      else if (/[\u4e00-\u9fff]/.test(ch)) units += 1.02;
      else units += 0.78;
    }
    return Math.max(fontSize * 2.2, units * fontSize * 0.68);
  }

  function boxesOverlap(a, b, gap = 0) {
    return !(
      a.x2 + gap < b.x1
      || a.x1 - gap > b.x2
      || a.y2 + gap < b.y1
      || a.y1 - gap > b.y2
    );
  }

  function clampLabelBox(box, bounds) {
    const width = box.x2 - box.x1;
    const height = box.y2 - box.y1;
    let x1 = box.x1;
    let y1 = box.y1;
    if (x1 < bounds.minX) x1 = bounds.minX;
    if (x1 + width > bounds.maxX) x1 = bounds.maxX - width;
    if (y1 < bounds.minY) y1 = bounds.minY;
    if (y1 + height > bounds.maxY) y1 = bounds.maxY - height;
    return { x1, y1, x2: x1 + width, y2: y1 + height };
  }

  function makeLabelCandidate(item, variant, bounds) {
    const paddingX = 8;
    const paddingY = 4;
    const textWidth = estimateTextWidth(item.text, item.fontSize);
    const boxWidth = textWidth + paddingX * 2;
    const boxHeight = item.fontSize + paddingY * 2 + 2;
    const gap = item.nodeRadius + 10;

    let box;
    let textAnchor = "start";
    let textX = item.x + gap + paddingX;
    let textY = item.y;

    switch (variant) {
      case "right":
        box = { x1: item.x + gap, y1: item.y - boxHeight / 2, x2: item.x + gap + boxWidth, y2: item.y + boxHeight / 2 };
        textAnchor = "start";
        textX = box.x1 + paddingX;
        break;
      case "left":
        box = { x1: item.x - gap - boxWidth, y1: item.y - boxHeight / 2, x2: item.x - gap, y2: item.y + boxHeight / 2 };
        textAnchor = "start";
        textX = box.x1 + paddingX;
        break;
      case "top":
        box = { x1: item.x - boxWidth / 2, y1: item.y - gap - boxHeight, x2: item.x + boxWidth / 2, y2: item.y - gap };
        textAnchor = "middle";
        textX = item.x;
        break;
      case "bottom":
        box = { x1: item.x - boxWidth / 2, y1: item.y + gap, x2: item.x + boxWidth / 2, y2: item.y + gap + boxHeight };
        textAnchor = "middle";
        textX = item.x;
        break;
      case "top-right":
        box = { x1: item.x + gap * 0.75, y1: item.y - gap - boxHeight * 0.9, x2: item.x + gap * 0.75 + boxWidth, y2: item.y - gap + boxHeight * 0.1 };
        textAnchor = "start";
        textX = box.x1 + paddingX;
        break;
      case "bottom-right":
        box = { x1: item.x + gap * 0.75, y1: item.y + gap * 0.25, x2: item.x + gap * 0.75 + boxWidth, y2: item.y + gap * 0.25 + boxHeight };
        textAnchor = "start";
        textX = box.x1 + paddingX;
        break;
      case "top-left":
        box = { x1: item.x - gap * 0.75 - boxWidth, y1: item.y - gap - boxHeight * 0.9, x2: item.x - gap * 0.75, y2: item.y - gap + boxHeight * 0.1 };
        textAnchor = "start";
        textX = box.x1 + paddingX;
        break;
      case "bottom-left":
        box = { x1: item.x - gap * 0.75 - boxWidth, y1: item.y + gap * 0.25, x2: item.x - gap * 0.75, y2: item.y + gap * 0.25 + boxHeight };
        textAnchor = "start";
        textX = box.x1 + paddingX;
        break;
      default:
        return null;
    }

    const clamped = clampLabelBox(box, bounds);
    const offsetX = clamped.x1 - box.x1;
    const offsetY = clamped.y1 - box.y1;

    return {
      variant,
      box: clamped,
      textAnchor,
      textX: textX + offsetX,
      textY: item.y + offsetY,
      boxWidth,
      boxHeight
    };
  }

  function buildLabelVariants(item, mode = "generic") {
    const rightHeavy = item.x < (item.midX ?? Infinity);
    const topHeavy = item.y > (item.midY ?? Infinity);
    if (mode === "region") {
      return rightHeavy
        ? (topHeavy ? ["right", "top-right", "bottom-right", "top", "bottom", "left"] : ["right", "bottom-right", "top-right", "bottom", "top", "left"])
        : (topHeavy ? ["left", "top-left", "bottom-left", "top", "bottom", "right"] : ["left", "bottom-left", "top-left", "bottom", "top", "right"]);
    }
    return rightHeavy
      ? (topHeavy ? ["right", "bottom-right", "top-right", "bottom", "top", "left"] : ["right", "top-right", "bottom-right", "top", "bottom", "left"])
      : (topHeavy ? ["left", "bottom-left", "top-left", "bottom", "top", "right"] : ["left", "top-left", "bottom-left", "top", "bottom", "right"]);
  }

  function placeSmartLabels(items, bounds, options = {}) {
    const mode = options.mode || "generic";
    const labelBoxes = [];
    const nodeBoxes = options.nodeBoxes || [];
    const placed = [];

    items.forEach((item) => {
      const variants = buildLabelVariants(item, mode);
      let chosen = null;
      for (const variant of variants) {
        const candidate = makeLabelCandidate(item, variant, bounds);
        if (!candidate) continue;
        const hitsLabel = labelBoxes.some((box) => boxesOverlap(candidate.box, box, 3));
        const hitsNode = nodeBoxes.some((box) => boxesOverlap(candidate.box, box, 2));
        if (!hitsLabel && !hitsNode) {
          chosen = candidate;
          break;
        }
      }
      if (!chosen && item.selected) {
        chosen = makeLabelCandidate(item, variants[0], bounds);
      }
      if (!chosen) return;
      labelBoxes.push(chosen.box);
      placed.push({ ...item, ...chosen });
    });

    return placed;
  }

  function labelGroupHtml(label, className = "chart-label") {
    const rectX = label.box.x1;
    const rectY = label.box.y1;
    const rectWidth = label.box.x2 - label.box.x1;
    const rectHeight = label.box.y2 - label.box.y1;
    const lineToX = Math.min(Math.max(label.x, label.box.x1), label.box.x2);
    const lineToY = Math.min(Math.max(label.y, label.box.y1), label.box.y2);
    return `
      <g class="chart-label-group">
        <line class="chart-pointer" x1="${label.x}" y1="${label.y}" x2="${lineToX}" y2="${lineToY}" />
        <rect class="chart-label-box" x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" rx="7" ry="7"></rect>
        <text class="${className}" x="${label.textX}" y="${label.textY}" text-anchor="${label.textAnchor}" dominant-baseline="middle" font-size="${label.fontSize}">${esc(label.text)}</text>
      </g>
    `;
  }

  function dominantStageForEntity(entityId) {
    const counts = new Map();
    (txByEntity.get(entityId) || []).forEach((tx) => {
      if (tx.supplierCompanyId === entityId || tx.supplierFacilityId === entityId) {
        counts.set(tx.supplierStage, (counts.get(tx.supplierStage) || 0) + 1);
      }
      if (tx.buyerCompanyId === entityId || tx.buyerFacilityId === entityId) {
        counts.set(tx.buyerStage, (counts.get(tx.buyerStage) || 0) + 1);
      }
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }

  function entityTitle(entityId, fallback = "") {
    const entity = entityId ? entities.get(entityId) : null;
    if (entity?.name) return entity.name;
    return safeText(fallback, "未命名实体");
  }

  function entitySubtitle(entity) {
    if (!entity) return "未锁定实体";
    const tags = [displayEntityType(entity.type), displayCountry(entity.country || "")];
    if (entity.facilityType) tags.push(displayFacilityType(entity.facilityType));
    const stage = dominantStageForEntity(entity.id);
    if (stage) tags.push(`主导类别：${displayStage(stage)}`);
    return tags.filter(Boolean).join(" | ");
  }

  function normalizeLon(lon) {
    let value = Number(lon);
    while (value <= -180) value += 360;
    while (value > 180) value -= 360;
    return value;
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    if (![lat1, lon1, lat2, lon2].every(isNum)) return Infinity;
    const toRad = (value) => Number(value) * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(normalizeLon(lon2 - lon1));
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function midpoint(tx) {
    if (!isNum(tx.sourceLat) || !isNum(tx.sourceLon) || !isNum(tx.targetLat) || !isNum(tx.targetLon)) return null;
    return {
      lat: (Number(tx.sourceLat) + Number(tx.targetLat)) / 2,
      lon: normalizeLon((Number(tx.sourceLon) + Number(tx.targetLon)) / 2)
    };
  }

  function sideNodeFromTx(tx, side) {
    const source = side === "source";
    const entityId = source ? (tx.supplierFacilityId || tx.supplierCompanyId) : (tx.buyerFacilityId || tx.buyerCompanyId);
    const entity = entityId ? entities.get(entityId) : null;
    const facilityRaw = source ? tx.supplierFacility : tx.buyerFacility;
    const companyRaw = source ? tx.supplierCompany : tx.buyerCompany;
    const parsed = parseFacilityText(facilityRaw);
    return {
      key: entityId || `${source ? "supplier" : "buyer"}:${companyRaw || facilityRaw || tx.id}`,
      entityId,
      companyId: source ? tx.supplierCompanyId : tx.buyerCompanyId,
      facilityId: source ? tx.supplierFacilityId : tx.buyerFacilityId,
      stage: source ? tx.supplierStage : tx.buyerStage,
      lat: Number(source ? tx.sourceLat : tx.targetLat),
      lon: Number(source ? tx.sourceLon : tx.targetLon),
      pointOrigin: source ? tx.sourcePointOrigin : tx.targetPointOrigin,
      country: entity?.country || (source ? tx.supplierCountry : tx.buyerCountry) || parsed.country || "",
      place: entity?.place || parsed.place || "",
      name: entity?.name || companyRaw || facilityRaw || "未命名实体"
    };
  }

  function currentEntity() {
    return state.selectedEntityId ? entities.get(state.selectedEntityId) || null : null;
  }

  function currentTx() {
    return state.selectedTxId ? txById.get(state.selectedTxId) || null : null;
  }

  function entityScopeIds(entityId) {
    const scope = new Set();
    if (!entityId) return scope;
    scope.add(entityId);
    const entity = entities.get(entityId);
    if (entity?.type === "company") {
      (companyFacilities.get(entity.id) || []).forEach((facilityId) => scope.add(facilityId));
    } else {
      const ownerId = facilityCompany.get(entityId);
      if (ownerId) scope.add(ownerId);
    }
    return scope;
  }

  function stageFilteredTransactions() {
    if (state.stage === "all") return transactions;
    return transactions.filter((tx) => tx.supplierStage === state.stage || tx.buyerStage === state.stage);
  }

  function entityFocusedTransactions(base, entityId) {
    const scopedIds = entityScopeIds(entityId);
    return base.filter((tx) =>
      scopedIds.has(tx.supplierCompanyId)
      || scopedIds.has(tx.buyerCompanyId)
      || scopedIds.has(tx.supplierFacilityId)
      || scopedIds.has(tx.buyerFacilityId)
    );
  }

  function transactionNeighborhood(base, tx) {
    const scopedIds = new Set([
      tx.supplierCompanyId,
      tx.buyerCompanyId,
      tx.supplierFacilityId,
      tx.buyerFacilityId
    ].filter(Boolean));
    return base.filter((item) =>
      item.id === tx.id
      || scopedIds.has(item.supplierCompanyId)
      || scopedIds.has(item.buyerCompanyId)
      || scopedIds.has(item.supplierFacilityId)
      || scopedIds.has(item.buyerFacilityId)
    );
  }

  function cameraRadiusKm(altitude, scale = 1) {
    const radius = 900 + (Number(altitude || 2.2) - 0.8) * 4200;
    return clamp(radius * scale, 900, 9200);
  }

  function cameraFocusedTransactions(base, radiusKm = cameraRadiusKm(state.view.altitude)) {
    return base.filter((tx) => {
      const views = [
        { lat: tx.sourceLat, lon: tx.sourceLon },
        { lat: tx.targetLat, lon: tx.targetLon },
        midpoint(tx)
      ].filter(Boolean);
      return views.some((point) => haversineKm(state.view.lat, state.view.lng, point.lat, point.lon) <= radiusKm);
    });
  }

  function ensureValidSelection(base) {
    if (state.selectedEntityId && !entities.has(state.selectedEntityId)) state.selectedEntityId = "";
    if (state.selectedTxId && !base.some((tx) => tx.id === state.selectedTxId)) state.selectedTxId = "";
  }

  function computeContext() {
    const base = stageFilteredTransactions();
    ensureValidSelection(base);
    const entity = currentEntity();
    const tx = currentTx();

    let focus = base;
    let mode = "global";

    if (entity) {
      focus = entityFocusedTransactions(base, entity.id);
      mode = "entity";
    } else if (tx) {
      focus = transactionNeighborhood(base, tx);
      mode = "transaction";
    } else {
      const viewScoped = cameraFocusedTransactions(base);
      if (viewScoped.length && state.view.altitude < 1.95) {
        focus = viewScoped;
        mode = "camera";
      }
    }

    if (!focus.length) focus = base;

    return {
      base,
      focus,
      entity,
      tx,
      mode,
      cameraRadiusKm: cameraRadiusKm(state.view.altitude)
    };
  }

  function currentModeLabel(context) {
    if (context.mode === "entity" && context.entity) return `围绕 ${context.entity.name}`;
    if (context.mode === "transaction" && context.tx) return "关系邻域";
    if (context.mode === "camera") return "当前视角区域";
    return "全球总览";
  }

  function currentModeSub(context) {
    if (context.mode === "entity" && context.entity) return "当前围绕该实体的供应链关系、空间落点与上下游主体联动展示。";
    if (context.mode === "transaction" && context.tx) return "已聚焦当前关系及其相关企业/设施。点击其他关系可继续钻取。";
    if (context.mode === "camera") return `视角中心 ${state.view.lat.toFixed(1)}°, ${state.view.lng.toFixed(1)}°；半径约 ${fmt.format(Math.round(context.cameraRadiusKm))} 公里。`;
    return "拖动或缩放地球后，页面会自动切换到当前视角对应的区域关系。";
  }

  function setGlobeState(mode, notice = "") {
    state.globeMode = mode;
    state.globeNotice = notice;
    document.body.classList.toggle("globe-ready", mode === "webgl");
    document.body.classList.toggle("globe-fallback", mode !== "webgl");
  }

  function preloadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      if (/^https?:/i.test(url)) image.crossOrigin = "anonymous";
      image.onload = () => resolve(url);
      image.onerror = () => reject(new Error(`Failed to load ${url}`));
      image.src = url;
    });
  }

  function setupFallbackEarth() {
    const root = document.documentElement;
    const texture = window.COBALT_EARTH_FALLBACK || "";
    if (texture) root.style.setProperty("--earth-fallback-image", `url('${texture}')`);
    else root.style.setProperty("--earth-fallback-image", "url('assets/earth_satellite_1350.jpg')");
  }

  function setupFallbackInteraction() {
    if (!earthFallback || !earthSphere) return;
    let dragging = false;
    let lastX = 0;
    let offset = 18;

    const paint = () => {
      earthSphere.style.backgroundPosition = `center, center, ${offset}% 50%, center`;
    };

    earthFallback.addEventListener("pointerdown", (event) => {
      if (state.globeMode === "webgl") return;
      dragging = true;
      lastX = event.clientX;
      earthFallback.classList.add("is-dragging");
      earthSphere.style.animation = "none";
      earthFallback.setPointerCapture?.(event.pointerId);
    });

    earthFallback.addEventListener("pointermove", (event) => {
      if (!dragging || state.globeMode === "webgl") return;
      const deltaX = event.clientX - lastX;
      lastX = event.clientX;
      offset += deltaX * 0.08;
      paint();
    });

    const stopDrag = (event) => {
      if (!dragging) return;
      dragging = false;
      earthFallback.classList.remove("is-dragging");
      earthFallback.releasePointerCapture?.(event.pointerId);
    };

    earthFallback.addEventListener("pointerup", stopDrag);
    earthFallback.addEventListener("pointercancel", stopDrag);
    earthFallback.addEventListener("pointerleave", stopDrag);

    paint();
  }

  function openTooltip(html) {
    if (!html) {
      tooltip.style.display = "none";
      tooltip.innerHTML = "";
      return;
    }
    tooltip.innerHTML = html;
    tooltip.style.display = "block";
    tooltip.style.left = `${state.pointerX}px`;
    tooltip.style.top = `${state.pointerY}px`;
  }

  function stageColor(stage) {
    return stageColors[stage] || "#7fd0ff";
  }

  function buildLegend() {
    byId("legendList").innerHTML = stageOrder.map((stage) => `
      <span class="legend-pill">
        <span class="legend-dot" style="--dot:${stageColor(stage)}"></span>
        ${esc(displayStage(stage))}
      </span>
    `).join("");
  }

  function sortTransactionsForList(list) {
    return [...list].sort((a, b) => {
      if (a.id === state.selectedTxId) return -1;
      if (b.id === state.selectedTxId) return 1;
      if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount;
      if (Number(b.hasQuantity) !== Number(a.hasQuantity)) return Number(b.hasQuantity) - Number(a.hasQuantity);
      if (Number(b.hasDate) !== Number(a.hasDate)) return Number(b.hasDate) - Number(a.hasDate);
      return String(a.id).localeCompare(String(b.id));
    });
  }

  function renderResults() {
    const query = byId("searchInput").value.trim().toLowerCase();
    const items = (query ? searchCatalog.filter((item) => item.blob.includes(query)) : searchCatalog).slice(0, 12);
    byId("results").innerHTML = items.length
      ? items.map((item) => `
        <button class="result-item" data-entity="${esc(item.id)}">
          <div>
            <div class="result-name">${esc(item.name)}</div>
            <div class="result-meta">${esc(displayCountry(item.country))} | ${esc(displayEntityType(item.type))} | ${fmt.format(item.count)} 条关联关系</div>
          </div>
          <span class="tag">${item.type === "company" ? "企业" : "设施"}</span>
        </button>
      `).join("")
      : "<div class='empty-state'>没有匹配结果，请尝试换一个关键词。</div>";
  }

  function renderFocusChip(context) {
    byId("focusTitle").textContent = currentModeLabel(context);
    byId("focusSub").textContent = currentModeSub(context);
  }

  function globalSummaryCard(context) {
    const focusCountries = new Set();
    const focusStages = new Set();
    const focusNodes = new Set();
    context.focus.forEach((tx) => {
      if (tx.supplierCountry) focusCountries.add(displayCountry(tx.supplierCountry));
      if (tx.buyerCountry) focusCountries.add(displayCountry(tx.buyerCountry));
      focusStages.add(displayStage(tx.supplierStage));
      focusStages.add(displayStage(tx.buyerStage));
      if (tx.supplierFacilityId || tx.supplierCompanyId) focusNodes.add(tx.supplierFacilityId || tx.supplierCompanyId);
      if (tx.buyerFacilityId || tx.buyerCompanyId) focusNodes.add(tx.buyerFacilityId || tx.buyerCompanyId);
    });

    return `
      <div class="entity-card">
        <div class="entity-title">${esc(currentModeLabel(context))}</div>
        <div class="entity-sub">${esc(currentModeSub(context))}</div>
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-key">当前关系数</div><div class="stat-value">${fmt.format(context.focus.length)}</div></div>
          <div class="stat-card"><div class="stat-key">空间落点数</div><div class="stat-value">${fmt.format(focusNodes.size)}</div></div>
          <div class="stat-card"><div class="stat-key">涉及国家</div><div class="stat-value">${fmt.format(focusCountries.size)}</div></div>
          <div class="stat-card"><div class="stat-key">涉及环节</div><div class="stat-value">${fmt.format(focusStages.size)}</div></div>
        </div>
        <div class="kv-list">
          <div class="kv-row"><span>全局交易关系</span><strong>${fmt.format(DATA.meta.transactions)}</strong></div>
          <div class="kv-row"><span>企业数量</span><strong>${fmt.format(DATA.meta.companies)}</strong></div>
          <div class="kv-row"><span>设施数量</span><strong>${fmt.format(DATA.meta.facilities)}</strong></div>
          <div class="kv-row"><span>矿点数量</span><strong>${fmt.format(DATA.meta.mines)}</strong></div>
          <div class="kv-row"><span>证据文档数</span><strong>${fmt.format(DATA.meta.sourceDocuments)}</strong></div>
          <div class="kv-row"><span>当前视角半径</span><strong>${fmt.format(Math.round(context.cameraRadiusKm))} 公里</strong></div>
        </div>
      </div>
    `;
  }

  function entitySummaryCard(entity, context) {
    const related = entityFocusedTransactions(context.base, entity.id);
    const upstream = new Set();
    const downstream = new Set();
    const stages = new Set();
    const goods = new Set();
    let quantityCount = 0;
    let dateCount = 0;
    let evidenceCount = 0;

    related.forEach((tx) => {
      if (tx.supplierCompanyId === entity.id || tx.supplierFacilityId === entity.id) {
        if (tx.buyerCompanyId) downstream.add(tx.buyerCompanyId);
        if (tx.buyerFacilityId) downstream.add(tx.buyerFacilityId);
      }
      if (tx.buyerCompanyId === entity.id || tx.buyerFacilityId === entity.id) {
        if (tx.supplierCompanyId) upstream.add(tx.supplierCompanyId);
        if (tx.supplierFacilityId) upstream.add(tx.supplierFacilityId);
      }
      stages.add(tx.supplierStage);
      stages.add(tx.buyerStage);
      [...tx.inputCommodities, ...tx.outputCommodities].forEach((value) => goods.add(value));
      if (tx.hasQuantity) quantityCount += 1;
      if (tx.hasDate) dateCount += 1;
      if (tx.sourceIds.length) evidenceCount += 1;
    });

    return `
      <div class="entity-card">
        <div class="entity-title">${esc(entity.name)}</div>
        <div class="entity-sub">${esc(entitySubtitle(entity))}</div>
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-key">关联关系</div><div class="stat-value">${fmt.format(related.length)}</div></div>
          <div class="stat-card"><div class="stat-key">上游主体</div><div class="stat-value">${fmt.format(upstream.size)}</div></div>
          <div class="stat-card"><div class="stat-key">下游主体</div><div class="stat-value">${fmt.format(downstream.size)}</div></div>
          <div class="stat-card"><div class="stat-key">涉及环节</div><div class="stat-value">${fmt.format(stages.size)}</div></div>
        </div>
        <div class="kv-list">
          <div class="kv-row"><span>经纬度</span><span class="value">${formatCoordinate(entity.lat)}, ${formatCoordinate(entity.lon)}</span></div>
          <div class="kv-row"><span>地点</span><span class="value">${esc(safeText(entity.place, "未标注"))}</span></div>
          <div class="kv-row"><span>设施类型</span><span class="value">${esc(safeText(displayFacilityType(entity.facilityType), "未标注"))}</span></div>
          <div class="kv-row"><span>带数量字段</span><strong>${fmt.format(quantityCount)}</strong></div>
          <div class="kv-row"><span>带时间字段</span><strong>${fmt.format(dateCount)}</strong></div>
          <div class="kv-row"><span>带证据来源</span><strong>${fmt.format(evidenceCount)}</strong></div>
        </div>
        <div class="section-title compact-top">涉及环节与产品</div>
        <div class="tag-list">
          ${[...stages].slice(0, 8).map((stage) => `<span class="tag"><span class="node-dot" style="--dot:${stageColor(stage)}"></span>${esc(displayStage(stage))}</span>`).join("")}
          ${[...goods].slice(0, 8).map((value) => `<span class="tag">${esc(value)}</span>`).join("") || "<span class='tag'>暂无产品标注</span>"}
        </div>
      </div>
    `;
  }

  function renderSummary(context) {
    byId("infoMeta").textContent = context.entity
      ? `已锁定：${context.entity.name}`
      : (context.tx ? "已锁定关系" : "当前未锁定实体");
    byId("summaryBody").innerHTML = context.entity
      ? entitySummaryCard(context.entity, context)
      : globalSummaryCard(context);
  }

  function renderTxCard(context) {
    const tx = context.tx;
    if (!tx) {
      byId("txBody").innerHTML = "<div class='empty-state'>点击右侧关系、地球连线或底部图谱中的连线后，这里会显示完整关系详情。</div>";
      return;
    }

    const sourceLinks = sourceLinksForTx(tx);
    byId("txBody").innerHTML = `
      <div class="tx-card">
        <div class="entity-title">${esc(entityTitle(tx.supplierFacilityId || tx.supplierCompanyId, tx.supplierCompany || tx.supplierFacility))} → ${esc(entityTitle(tx.buyerFacilityId || tx.buyerCompanyId, tx.buyerCompany || tx.buyerFacility))}</div>
        <div class="entity-sub">${esc(displayStage(tx.supplierStage))} → ${esc(displayStage(tx.buyerStage))}</div>
        <div class="kv-list">
          <div class="kv-row"><span>上游主体</span><span class="value">${esc(tx.supplierCompany || tx.supplierFacility || "未标注")}</span></div>
          <div class="kv-row"><span>下游主体</span><span class="value">${esc(tx.buyerCompany || tx.buyerFacility || "未标注")}</span></div>
          <div class="kv-row"><span>数量/规模</span><span class="value">${esc(formatAmount(tx))}</span></div>
          <div class="kv-row"><span>时间</span><span class="value">${esc(formatDate(tx))}</span></div>
          <div class="kv-row"><span>输入产品</span><span class="value">${esc(tx.inputCommodities.join(" / ") || "未标注")}</span></div>
          <div class="kv-row"><span>输出产品</span><span class="value">${esc(tx.outputCommodities.join(" / ") || "未标注")}</span></div>
          <div class="kv-row"><span>坐标来源</span><span class="value">${esc(displayPointOrigin(tx.sourcePointOrigin))} → ${esc(displayPointOrigin(tx.targetPointOrigin))}</span></div>
          <div class="kv-row"><span>证据条数</span><strong>${fmt.format(tx.sourceIds.length)}</strong></div>
        </div>
        ${tx.notes.length ? `<div class="section-title compact-top">证据备注</div><div class="subnote">${esc(tx.notes.join("； "))}</div>` : ""}
        ${sourceLinks.length ? `<div class="source-links">${sourceLinks.slice(0, 6).map((source) => `<a class="source-link" href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.host || source.url)}</a>`).join("")}</div>` : ""}
      </div>
    `;
  }

  function relationItemHtml(tx) {
    const active = tx.id === state.selectedTxId;
    return `
      <button class="relation-item ${active ? "is-active" : ""}" data-tx="${esc(tx.id)}">
        <div class="relation-title">${esc(entityTitle(tx.supplierFacilityId || tx.supplierCompanyId, tx.supplierCompany || tx.supplierFacility))} → ${esc(entityTitle(tx.buyerFacilityId || tx.buyerCompanyId, tx.buyerCompany || tx.buyerFacility))}</div>
        <div class="relation-meta">数量：${esc(formatAmount(tx))} | 时间：${esc(formatDate(tx))} | 证据：${fmt.format(tx.sourceIds.length)} 条</div>
        <div class="relation-route">
          <span class="route-piece"><span class="node-dot" style="--dot:${stageColor(tx.supplierStage)}"></span>${esc(displayStage(tx.supplierStage))}</span>
          <span class="route-arrow">→</span>
          <span class="route-piece"><span class="node-dot" style="--dot:${stageColor(tx.buyerStage)}"></span>${esc(displayStage(tx.buyerStage))}</span>
        </div>
      </button>
    `;
  }

  function renderRelationList(context) {
    const ordered = sortTransactionsForList(context.focus);
    byId("relationList").innerHTML = ordered.length
      ? ordered.map(relationItemHtml).join("")
      : "<div class='empty-state'>当前筛选条件下没有可展示的关系。</div>";
  }

  function setEvidenceVisibility(open) {
    const modal = byId("evidenceModal");
    const backdrop = byId("evidenceBackdrop");
    const openBtn = byId("openEvidenceBtn");
    const visible = Boolean(open);
    state.evidenceOpen = visible;
    modal.classList.toggle("is-hidden", !visible);
    backdrop.classList.toggle("is-hidden", !visible);
    modal.setAttribute("aria-hidden", visible ? "false" : "true");
    if (openBtn && !openBtn.classList.contains("is-hidden")) {
      openBtn.textContent = visible ? "隐藏证据链" : "证据链";
    }
  }

  function buildEvidenceProfile(entity, related) {
    const stage = dominantStageForEntity(entity.id);
    const stageBadge = stage ? `<span class="evidence-tag" style="--badge:${stageColor(stage)}">${esc(displayStage(stage))}</span>` : "";
    const sourceCount = new Set(related.flatMap((tx) => tx.sourceIds)).size;
    const quantityCount = related.filter((tx) => tx.hasQuantity).length;
    const dateCount = related.filter((tx) => tx.hasDate).length;
    const sourceHosts = [...new Set(related.flatMap((tx) => sourceLinksForTx(tx).map((source) => source.host || source.url)).filter(Boolean))].slice(0, 6);
    const evidenceNotes = [...new Set(related.flatMap((tx) => tx.notes).filter(Boolean))].slice(0, 6);

    let relatedEntities = [];
    if (entity.type === "company") {
      relatedEntities = (companyFacilities.get(entity.id) || [])
        .map((facilityId) => entities.get(facilityId))
        .filter(Boolean)
        .slice(0, 8)
        .map((item) => item.name);
    } else {
      const ownerId = facilityCompany.get(entity.id);
      const owner = ownerId ? entities.get(ownerId) : null;
      const siblings = ownerId
        ? (companyFacilities.get(ownerId) || []).filter((facilityId) => facilityId !== entity.id).slice(0, 6).map((facilityId) => entities.get(facilityId)?.name).filter(Boolean)
        : [];
      relatedEntities = [owner?.name, ...siblings].filter(Boolean);
    }

    return `
      <div class="evidence-profile-title">${esc(entity.name)}</div>
      <div class="evidence-chip-row">
        ${stageBadge}
        <span class="chip">${esc(displayEntityType(entity.type))}</span>
        <span class="chip">${esc(displayCountry(entity.country || ""))}</span>
      </div>
      <div class="evidence-profile-sub">${esc(entitySubtitle(entity))}</div>
      <div class="evidence-profile-group">
        <h4>证据概况</h4>
        <div class="kv-list">
          <div class="kv-row"><span>关联关系</span><strong>${fmt.format(related.length)}</strong></div>
          <div class="kv-row"><span>来源文档</span><strong>${fmt.format(sourceCount)}</strong></div>
          <div class="kv-row"><span>数量字段</span><strong>${fmt.format(quantityCount)}</strong></div>
          <div class="kv-row"><span>时间字段</span><strong>${fmt.format(dateCount)}</strong></div>
          <div class="kv-row"><span>地点</span><span class="value">${esc(safeText(entity.place, "未标注"))}</span></div>
        </div>
      </div>
      <div class="evidence-profile-group">
        <h4>${entity.type === "company" ? "关联设施" : "所属/相关主体"}</h4>
        <div class="evidence-mini-list">
          ${relatedEntities.length
            ? relatedEntities.map((item) => `<div class="evidence-mini-item">${esc(item)}</div>`).join("")
            : "<div class='empty-state'>当前数据里没有更多附属主体字段。</div>"}
        </div>
      </div>
      <div class="evidence-profile-group">
        <h4>来源站点</h4>
        <div class="evidence-mini-list">
          ${sourceHosts.length
            ? sourceHosts.map((item) => `<div class="evidence-mini-item">${esc(item)}</div>`).join("")
            : "<div class='empty-state'>当前关系没有外部来源链接。</div>"}
        </div>
      </div>
      <div class="evidence-profile-group">
        <h4>证据摘录</h4>
        <div class="evidence-mini-list">
          ${evidenceNotes.length
            ? evidenceNotes.map((item) => `<div class="evidence-mini-item">${esc(item)}</div>`).join("")
            : "<div class='empty-state'>当前关系没有附加备注。</div>"}
        </div>
      </div>
    `;
  }

  function evidenceCardHtml(tx, direction) {
    const upstream = direction === "upstream";
    const counterpartId = upstream
      ? (tx.supplierFacilityId || tx.supplierCompanyId)
      : (tx.buyerFacilityId || tx.buyerCompanyId);
    const counterpartName = upstream
      ? entityTitle(counterpartId, tx.supplierCompany || tx.supplierFacility)
      : entityTitle(counterpartId, tx.buyerCompany || tx.buyerFacility);
    const stage = upstream ? tx.supplierStage : tx.buyerStage;
    const roleLabel = upstream ? "供应方" : "采购方";
    const sourceLinks = sourceLinksForTx(tx);
    const active = tx.id === state.selectedTxId;

    return `
      <article class="evidence-card ${active ? "is-active" : ""}" data-tx="${esc(tx.id)}">
        <div class="evidence-card-head">
          <span class="evidence-tag" style="--badge:${stageColor(stage)}">${esc(displayStage(stage))}</span>
          <span class="meta">${esc(formatAmount(tx))}</span>
        </div>
        <div class="evidence-card-title">${esc(counterpartName)}</div>
        <dl class="evidence-kv">
          <dt>${roleLabel}</dt>
          <dd>${esc(upstream ? (tx.supplierCompany || tx.supplierFacility || "未标注") : (tx.buyerCompany || tx.buyerFacility || "未标注"))}</dd>
          <dt>商品</dt>
          <dd>${esc(transactionCommodity(tx))}</dd>
          <dt>时间</dt>
          <dd>${esc(formatDate(tx))}</dd>
          <dt>来源</dt>
          <dd>${sourceLinks.length
            ? sourceLinks.slice(0, 3).map((source) => `<a class="source-link" href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.host || "Link")}</a>`).join(" / ")
            : "未标注"}</dd>
        </dl>
        ${tx.notes.length ? `<div class="evidence-note">${esc(tx.notes.join("； "))}</div>` : ""}
      </article>
    `;
  }

  function renderEvidenceChain(context) {
    const openBtn = byId("openEvidenceBtn");
    const entity = context.entity;
    if (!entity) {
      openBtn.classList.add("is-hidden");
      setEvidenceVisibility(false);
      byId("evidenceProfile").innerHTML = "";
      byId("evidenceUpstream").innerHTML = "";
      byId("evidenceDownstream").innerHTML = "";
      return;
    }

    openBtn.classList.remove("is-hidden");
    openBtn.textContent = state.evidenceOpen ? "隐藏证据链" : "证据链";
    const scope = entityScopeIds(entity.id);
    const related = entityFocusedTransactions(context.base, entity.id);
    const upstream = sortTransactionsForList(related.filter((tx) => scope.has(tx.buyerCompanyId) || scope.has(tx.buyerFacilityId)));
    const downstream = sortTransactionsForList(related.filter((tx) => scope.has(tx.supplierCompanyId) || scope.has(tx.supplierFacilityId)));

    byId("evidenceMeta").textContent = `围绕 ${entity.name} 展开的来源与去向`;
    byId("evidenceUpstreamMeta").textContent = `${fmt.format(upstream.length)} 条`;
    byId("evidenceDownstreamMeta").textContent = `${fmt.format(downstream.length)} 条`;
    byId("evidenceProfile").innerHTML = buildEvidenceProfile(entity, related);
    byId("evidenceUpstream").innerHTML = upstream.length
      ? upstream.map((tx) => evidenceCardHtml(tx, "upstream")).join("")
      : "<div class='empty-state'>当前实体在现有数据中没有识别到上游采购记录。</div>";
    byId("evidenceDownstream").innerHTML = downstream.length
      ? downstream.map((tx) => evidenceCardHtml(tx, "downstream")).join("")
      : "<div class='empty-state'>当前实体在现有数据中没有识别到下游供给记录。</div>";

    setEvidenceVisibility(state.evidenceOpen);
  }

  function boundsFromPoints(points) {
    const lats = points.map((point) => point.lat);
    const lons = points.map((point) => point.lon);
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLon = Math.min(...lons);
    let maxLon = Math.max(...lons);
    const latPad = Math.max(2, (maxLat - minLat) * 0.18);
    const lonPad = Math.max(3, (maxLon - minLon) * 0.18);
    if (maxLat - minLat < 4) {
      minLat -= 2;
      maxLat += 2;
    }
    if (maxLon - minLon < 6) {
      minLon -= 3;
      maxLon += 3;
    }
    return {
      minLat: clamp(minLat - latPad, -85, 85),
      maxLat: clamp(maxLat + latPad, -85, 85),
      minLon: clamp(minLon - lonPad, -180, 180),
      maxLon: clamp(maxLon + lonPad, -180, 180)
    };
  }

  function projectRegionPoint(point, bounds, width, height, paddingX = 72, paddingY = 54) {
    const lonSpan = Math.max(1, bounds.maxLon - bounds.minLon);
    const latSpan = Math.max(1, bounds.maxLat - bounds.minLat);
    return {
      x: paddingX + ((point.lon - bounds.minLon) / lonSpan) * (width - paddingX * 2),
      y: height - paddingY - ((point.lat - bounds.minLat) / latSpan) * (height - paddingY * 2)
    };
  }

  function buildRegionModel(context) {
    const sourceTxs = context.mode === "entity" || context.mode === "transaction"
      ? context.focus
      : (cameraFocusedTransactions(context.base, cameraRadiusKm(state.view.altitude, 0.78)).length
          ? cameraFocusedTransactions(context.base, cameraRadiusKm(state.view.altitude, 0.78))
          : context.focus);

    const limit = context.mode === "global" ? 110 : 160;
    const stride = sourceTxs.length > limit ? Math.ceil(sourceTxs.length / limit) : 1;
    const pointMap = new Map();
    const links = [];

    sourceTxs.forEach((tx, index) => {
      const selected = tx.id === state.selectedTxId;
      if (index % stride && !selected) return;
      const source = sideNodeFromTx(tx, "source");
      const target = sideNodeFromTx(tx, "target");
      if (isNum(source.lat) && isNum(source.lon)) {
        if (!pointMap.has(source.key)) pointMap.set(source.key, { ...source, weight: 0, stages: new Map(), selected: false });
        const entry = pointMap.get(source.key);
        entry.weight += 1;
        entry.stages.set(source.stage, (entry.stages.get(source.stage) || 0) + 1);
        entry.selected = entry.selected || source.entityId === state.selectedEntityId;
      }
      if (isNum(target.lat) && isNum(target.lon)) {
        if (!pointMap.has(target.key)) pointMap.set(target.key, { ...target, weight: 0, stages: new Map(), selected: false });
        const entry = pointMap.get(target.key);
        entry.weight += 1;
        entry.stages.set(target.stage, (entry.stages.get(target.stage) || 0) + 1);
        entry.selected = entry.selected || target.entityId === state.selectedEntityId;
      }
      if (isNum(source.lat) && isNum(source.lon) && isNum(target.lat) && isNum(target.lon)) {
        links.push({ id: tx.id, source, target, tx, selected });
      }
    });

    const points = [...pointMap.values()].map((point) => ({
      ...point,
      dominantStage: [...point.stages.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || point.stage
    }));

    return { points, links };
  }

  function renderRegion(context) {
    const model = buildRegionModel(context);
    const svg = byId("regionSvg");
    const stats = byId("regionStats");
    const baseViewport = getSvgViewport(svg, 900, 320);
    const width = Math.max(baseViewport.width, 1040);
    const height = Math.max(baseViewport.height, 320);
    const paddingX = clamp(Math.round(width * 0.07), 46, 86);
    const paddingY = clamp(Math.round(height * 0.12), 34, 64);
    const labelFont = clamp(Math.round(height * 0.042), 12, 16);
    const metaFont = clamp(Math.round(height * 0.032), 10, 13);
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    if (!model.points.length) {
      byId("regionCaption").textContent = "当前视角内没有可投影到局部区域的落点。";
      stats.innerHTML = "";
      svg.innerHTML = `<foreignObject x="18" y="20" width="${width - 36}" height="${Math.max(180, height - 40)}"><div xmlns="http://www.w3.org/1999/xhtml" class="empty-state">请拖动地球到有节点的区域，或点击企业/关系后查看局部区域映射。</div></foreignObject>`;
      return;
    }

    const bounds = boundsFromPoints(model.points);
    const countries = new Set(model.points.map((point) => displayCountry(point.country)).filter(Boolean));
    const stageSet = new Set(model.points.map((point) => point.dominantStage).filter(Boolean));
    const projected = new Map(model.points.map((point) => [point.key, projectRegionPoint(point, bounds, width, height, paddingX, paddingY)]));

    byId("regionMeta").textContent = context.mode === "camera" ? "当前视角对应的地理窗口" : "当前焦点下的真实坐标投影";
    byId("regionCaption").textContent = `纬度 ${bounds.minLat.toFixed(1)}° 至 ${bounds.maxLat.toFixed(1)}°，经度 ${bounds.minLon.toFixed(1)}° 至 ${bounds.maxLon.toFixed(1)}°；共 ${fmt.format(model.points.length)} 个落点、${fmt.format(model.links.length)} 条关系。`;
    stats.innerHTML = [
      `国家 ${fmt.format(countries.size)}`,
      `环节 ${fmt.format(stageSet.size)}`,
      `视角中心 ${state.view.lat.toFixed(1)}°, ${state.view.lng.toFixed(1)}°`
    ].map((item) => `<span class="chip">${esc(item)}</span>`).join("");

    const gridLines = [];
    for (let i = 0; i <= 4; i += 1) {
      const x = paddingX + (i / 4) * (width - paddingX * 2);
      const y = paddingY + (i / 4) * (height - paddingY * 2);
      gridLines.push(`<line class="region-grid-line" x1="${x}" y1="${paddingY}" x2="${x}" y2="${height - paddingY}" />`);
      gridLines.push(`<line class="region-grid-line" x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}" />`);
    }

    const linkHtml = model.links.map((link) => {
      const source = projected.get(link.source.key);
      const target = projected.get(link.target.key);
      if (!source || !target) return "";
      const color = stageColor(link.source.stage);
      const widthValue = link.selected ? 3.8 : clamp(1.2 + (link.tx.sourceCount || 0) * 0.2, 1.2, 3);
      return `
        <path
          class="chain-edge"
          data-tx="${esc(link.id)}"
          d="M ${source.x} ${source.y} L ${target.x} ${target.y}"
          stroke="${color}"
          stroke-width="${widthValue}"
          stroke-opacity="${link.selected ? 0.96 : 0.48}"
        >
          <title>${esc(entityTitle(link.source.entityId, link.source.name))} → ${esc(entityTitle(link.target.entityId, link.target.name))}&#10;${esc(displayStage(link.source.stage))} → ${esc(displayStage(link.target.stage))}</title>
        </path>
      `;
    }).join("");

    const pointVisuals = model.points.map((point) => {
      const p = projected.get(point.key);
      if (!p) return null;
      const color = stageColor(point.dominantStage);
      const radius = point.selected ? 8.5 : clamp(4 + point.weight * 0.22, 4.5, 7.5);
      return { point, color, radius, p };
    }).filter(Boolean);

    const labelBounds = {
      minX: paddingX + 6,
      minY: paddingY + 6,
      maxX: width - paddingX - 6,
      maxY: height - paddingY - 26
    };
    const regionLabelCandidates = pointVisuals
      .slice()
      .sort((a, b) => Number(b.point.selected) - Number(a.point.selected) || b.point.weight - a.point.weight)
      .slice(0, width > 1500 ? 18 : width > 1260 ? 14 : 10)
      .map(({ point, radius, p }) => ({
        id: point.key,
        x: p.x,
        y: p.y,
        text: shortText(point.name, width > 1400 ? 30 : 22),
        fontSize: labelFont,
        nodeRadius: radius + 4,
        selected: point.selected,
        midX: width / 2,
        midY: height / 2
      }));
    const regionNodeBoxes = pointVisuals.map(({ radius, p }) => ({
      x1: p.x - radius - 6,
      y1: p.y - radius - 6,
      x2: p.x + radius + 6,
      y2: p.y + radius + 6
    }));
    const regionLabels = placeSmartLabels(regionLabelCandidates, labelBounds, {
      mode: "region",
      nodeBoxes: regionNodeBoxes
    });

    const pointHtml = pointVisuals.map(({ point, color, radius, p }) => {
      return `
        <g class="region-node" data-entity="${esc(point.entityId || "")}">
          <circle cx="${p.x}" cy="${p.y}" r="${radius + 4}" fill="${withAlpha(color, "22")}" />
          <circle cx="${p.x}" cy="${p.y}" r="${radius}" fill="${color}" stroke="${point.selected ? "#ffffff" : "rgba(255,255,255,.32)"}" stroke-width="${point.selected ? 2 : 1.1}" />
          <title>${esc(point.name)}&#10;${esc(displayStage(point.dominantStage))} | ${esc(displayCountry(point.country))}&#10;${esc(safeText(point.place, "未标注地点"))}</title>
        </g>
      `;
    }).join("");
    const labelHtml = regionLabels.map((label) => labelGroupHtml(label)).join("");

    svg.innerHTML = `
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(3,9,17,.34)"></rect>
      ${gridLines.join("")}
      ${linkHtml}
      ${pointHtml}
      ${labelHtml}
      <text class="chart-sub-label" x="${paddingX}" y="${height - 14}" font-size="${metaFont}">说明：点击节点查看实体，点击连线查看关系证据。</text>
    `;
  }

  function buildChainModel(context) {
    const seedTxs = context.mode === "entity" || context.mode === "transaction"
      ? context.focus
      : (cameraFocusedTransactions(context.base, cameraRadiusKm(state.view.altitude, 0.9)).length
          ? cameraFocusedTransactions(context.base, cameraRadiusKm(state.view.altitude, 0.9))
          : context.focus);

    if (!seedTxs.length) return { nodes: [], edges: [], stages: [] };

    const nodeMap = new Map();
    const edgeMap = new Map();
    const limit = context.entity ? 180 : 120;
    const stride = seedTxs.length > limit ? Math.ceil(seedTxs.length / limit) : 1;

    seedTxs.forEach((tx, index) => {
      const selected = tx.id === state.selectedTxId;
      if (index % stride && !selected) return;

      const source = sideNodeFromTx(tx, "source");
      const target = sideNodeFromTx(tx, "target");
      const sourceKey = `${source.key}::${source.stage}`;
      const targetKey = `${target.key}::${target.stage}`;

      if (!nodeMap.has(sourceKey)) nodeMap.set(sourceKey, { ...source, graphKey: sourceKey, count: 0, selected: false });
      if (!nodeMap.has(targetKey)) nodeMap.set(targetKey, { ...target, graphKey: targetKey, count: 0, selected: false });

      nodeMap.get(sourceKey).count += 1;
      nodeMap.get(targetKey).count += 1;
      nodeMap.get(sourceKey).selected = nodeMap.get(sourceKey).selected || source.entityId === state.selectedEntityId;
      nodeMap.get(targetKey).selected = nodeMap.get(targetKey).selected || target.entityId === state.selectedEntityId;

      const edgeKey = `${sourceKey}>>${targetKey}`;
      if (!edgeMap.has(edgeKey)) edgeMap.set(edgeKey, { sourceKey, targetKey, count: 0, txId: tx.id, selected: false });
      const edge = edgeMap.get(edgeKey);
      edge.count += 1;
      edge.selected = edge.selected || selected;
      if (selected) edge.txId = tx.id;
    });

    const stageBuckets = new Map();
    [...nodeMap.values()].forEach((node) => {
      if (!stageBuckets.has(node.stage)) stageBuckets.set(node.stage, []);
      stageBuckets.get(node.stage).push(node);
    });

    const stageLimit = context.entity ? 6 : 5;
    const keepKeys = new Set();
    const stages = stageOrder.filter((stage) => stageBuckets.has(stage));
    stages.forEach((stage) => {
      const bucket = stageBuckets.get(stage)
        .sort((a, b) => Number(b.selected) - Number(a.selected) || b.count - a.count || a.name.localeCompare(b.name, "en"))
        .slice(0, stageLimit);
      bucket.forEach((node) => keepKeys.add(node.graphKey));
    });

    const nodes = [...nodeMap.values()].filter((node) => keepKeys.has(node.graphKey));
    const edges = [...edgeMap.values()].filter((edge) => keepKeys.has(edge.sourceKey) && keepKeys.has(edge.targetKey));
    return { nodes, edges, stages };
  }

  function renderChain(context) {
    const model = buildChainModel(context);
    const svg = byId("chainSvg");
    const baseViewport = getSvgViewport(svg, 980, 320);
    const maxStageNodes = Math.max(...model.stages.map((stage) => model.nodes.filter((node) => node.stage === stage).length), 1);
    const width = Math.max(baseViewport.width, Math.max(1420, model.stages.length * 150 + 240));
    const height = Math.max(baseViewport.height, Math.min(520, 248 + maxStageNodes * 38));
    const stageFont = clamp(Math.round(height * 0.05), 12, 16);
    const nodeFont = clamp(Math.round(height * 0.04), 11, 14);
    const metaFont = clamp(Math.round(height * 0.034), 10, 12);
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    if (!model.nodes.length) {
      byId("chainCaption").textContent = "当前焦点下没有可展开的知识图谱结构。";
      svg.innerHTML = `<foreignObject x="18" y="20" width="${width - 36}" height="${Math.max(200, height - 40)}"><div xmlns="http://www.w3.org/1999/xhtml" class="empty-state">请先锁定一个企业、矿点或关系，再查看按供应链环节展开的知识图谱。</div></foreignObject>`;
      return;
    }

    const stageNodes = new Map();
    model.stages.forEach((stage) => stageNodes.set(stage, model.nodes.filter((node) => node.stage === stage)));
    const xPadding = 96;
    const top = 92;
    const bottom = 78;
    const stageStep = model.stages.length > 1 ? (width - xPadding * 2) / (model.stages.length - 1) : 0;
    const positioned = new Map();

    model.stages.forEach((stage, stageIndex) => {
      const nodes = stageNodes.get(stage) || [];
      const usableHeight = height - top - bottom;
      const step = nodes.length > 1 ? usableHeight / (nodes.length - 1) : 0;
      nodes.forEach((node, index) => {
        positioned.set(node.graphKey, {
          ...node,
          x: xPadding + stageStep * stageIndex,
          y: nodes.length > 1 ? top + step * index : top + usableHeight / 2
        });
      });
    });

    const stageGuides = model.stages.map((stage, index) => {
      const x = xPadding + stageStep * index;
      return `
        <line x1="${x}" y1="56" x2="${x}" y2="${height - 46}" stroke="rgba(111,200,255,.12)" stroke-width="1" />
        <text class="chart-label" x="${x}" y="34" text-anchor="middle" font-size="${stageFont}">${esc(displayStage(stage))}</text>
      `;
    }).join("");

    const edgeHtml = model.edges.map((edge) => {
      const source = positioned.get(edge.sourceKey);
      const target = positioned.get(edge.targetKey);
      if (!source || !target) return "";
      const curveX = (source.x + target.x) / 2;
      const color = stageColor(source.stage);
      const widthValue = edge.selected ? 4 : clamp(1.3 + edge.count * 0.35, 1.4, 4);
      return `
        <path
          class="chain-edge"
          data-tx="${esc(edge.txId)}"
          d="M ${source.x} ${source.y} C ${curveX} ${source.y}, ${curveX} ${target.y}, ${target.x} ${target.y}"
          stroke="${color}"
          stroke-width="${widthValue}"
          stroke-opacity="${edge.selected ? 1 : 0.58}"
        >
          <title>${esc(source.name)} → ${esc(target.name)}&#10;${esc(displayStage(source.stage))} → ${esc(displayStage(target.stage))}&#10;关系数：${fmt.format(edge.count)}</title>
        </path>
      `;
    }).join("");

    const positionedNodes = [...positioned.values()];
    const chainLabelBounds = {
      minX: 18,
      minY: 48,
      maxX: width - 18,
      maxY: height - 20
    };
    const chainNodeBoxes = positionedNodes.map((node) => ({
      x1: node.x - 18,
      y1: node.y - 18,
      x2: node.x + 18,
      y2: node.y + 18
    }));
    const stageLabelRanks = new Map();
    positionedNodes.forEach((node) => {
      const list = stageLabelRanks.get(node.stage) || [];
      list.push(node);
      stageLabelRanks.set(node.stage, list);
    });
    stageLabelRanks.forEach((list, stage) => {
      list.sort((a, b) => Number(b.selected) - Number(a.selected) || b.count - a.count || a.name.localeCompare(b.name));
      list.forEach((node, index) => {
        node.stageRank = index;
        node.stageSize = list.length;
      });
    });
    const chainLabelCandidates = positionedNodes
      .filter((node) => node.selected || node.count > 1 || node.stageRank < 2)
      .sort((a, b) => Number(b.selected) - Number(a.selected) || b.count - a.count || a.stageRank - b.stageRank)
      .slice(0, width > 1700 ? 28 : width > 1450 ? 22 : 16)
      .map((node) => ({
        id: node.graphKey,
        x: node.x,
        y: node.y,
        text: shortText(node.name, width > 1500 ? 22 : 18),
        fontSize: nodeFont,
        nodeRadius: node.selected ? 17 : 15,
        selected: node.selected,
        midX: width / 2,
        midY: height / 2
      }));
    const chainLabels = placeSmartLabels(chainLabelCandidates, chainLabelBounds, {
      mode: "chain",
      nodeBoxes: chainNodeBoxes
    });

    const nodeHtml = positionedNodes.map((node) => {
      const color = stageColor(node.stage);
      const countText = (node.selected || node.count > 1)
        ? `<text class="chart-sub-label" x="${node.x}" y="${node.y + 31}" text-anchor="middle" font-size="${metaFont}">${fmt.format(node.count)} 条</text>`
        : "";
      return `
        <g class="chain-node" data-entity="${esc(node.entityId || "")}">
          <circle cx="${node.x}" cy="${node.y}" r="${node.selected ? 17 : 15}" fill="${withAlpha(color, "22")}" stroke="${color}" stroke-width="1.2"></circle>
          <circle cx="${node.x}" cy="${node.y}" r="${node.selected ? 7.5 : 6.2}" fill="${color}" stroke="${node.selected ? "#fff" : "none"}" stroke-width="1.6"></circle>
          ${countText}
          <title>${esc(node.name)}&#10;${esc(displayStage(node.stage))} | ${esc(displayCountry(node.country))}&#10;${esc(safeText(node.place, "未标注地点"))}</title>
        </g>
      `;
    }).join("");
    const chainLabelHtml = chainLabels.map((label) => labelGroupHtml(label)).join("");

    byId("chainMeta").textContent = context.entity
      ? `围绕 ${context.entity.name} 展开的多类别节点关系`
      : (context.mode === "camera" ? "当前视角区域内的多类别节点关系" : "按供应链环节分层展开");
    byId("chainCaption").textContent = `当前图谱共展示 ${fmt.format(model.nodes.length)} 个节点、${fmt.format(model.edges.length)} 条关系。节点颜色代表所属环节类别，点击节点或连线可继续钻取。`;
    svg.innerHTML = `
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(3,9,17,.32)"></rect>
      ${stageGuides}
      ${edgeHtml}
      ${nodeHtml}
      ${chainLabelHtml}
      <text class="chart-sub-label" x="${xPadding}" y="${height - 12}" font-size="${metaFont}">说明：颜色表示环节类别；点击节点或连线可在右侧与证据链中联动。</text>
    `;
  }

  function buildHierarchyGroups(entity, list, direction) {
    const groups = new Map();
    list.forEach((tx) => {
      let include = false;
      let stage = "";
      let counterpartId = "";
      let counterpartName = "";
      let counterpartCountry = "";
      let route = "";

      if (direction === "upstream" && (tx.buyerCompanyId === entity.id || tx.buyerFacilityId === entity.id)) {
        include = true;
        stage = tx.supplierStage;
        counterpartId = tx.supplierFacilityId || tx.supplierCompanyId || "";
        counterpartName = entityTitle(counterpartId, tx.supplierCompany || tx.supplierFacility);
        counterpartCountry = tx.supplierCountry;
        route = `${displayStage(tx.supplierStage)} → ${displayStage(tx.buyerStage)}`;
      }

      if (direction === "downstream" && (tx.supplierCompanyId === entity.id || tx.supplierFacilityId === entity.id)) {
        include = true;
        stage = tx.buyerStage;
        counterpartId = tx.buyerFacilityId || tx.buyerCompanyId || "";
        counterpartName = entityTitle(counterpartId, tx.buyerCompany || tx.buyerFacility);
        counterpartCountry = tx.buyerCountry;
        route = `${displayStage(tx.supplierStage)} → ${displayStage(tx.buyerStage)}`;
      }

      if (!include) return;
      if (!groups.has(stage)) groups.set(stage, new Map());
      const bucket = groups.get(stage);
      const key = counterpartId || counterpartName;
      if (!bucket.has(key)) {
        bucket.set(key, {
          id: counterpartId,
          name: counterpartName,
          country: counterpartCountry,
          route,
          count: 0,
          txId: tx.id
        });
      }
      bucket.get(key).count += 1;
    });
    return groups;
  }

  function hierarchyColumnHtml(title, groups) {
    const html = [...groups.entries()]
      .sort((a, b) => stageOrder.indexOf(a[0]) - stageOrder.indexOf(b[0]))
      .map(([stage, items]) => `
        <div class="hierarchy-group">
          <div class="hierarchy-group-title">${esc(displayStage(stage))}</div>
          ${[...items.values()].sort((a, b) => b.count - a.count).map((item) => `
            <button class="hierarchy-item" data-entity="${esc(item.id || "")}" data-tx="${esc(item.txId)}">
              <strong>${esc(item.name)}</strong>
              <small>${esc(displayCountry(item.country || ""))} | ${fmt.format(item.count)} 条关系 | ${esc(item.route)}</small>
            </button>
          `).join("")}
        </div>
      `).join("");

    return `
      <div class="hierarchy-column">
        <h3>${title}</h3>
        ${html || `<div class="empty-state">当前焦点下暂无${title}关系。</div>`}
      </div>
    `;
  }

  function renderHierarchy(context) {
    const body = byId("hierarchyBody");
    if (!context.entity) {
      const routes = new Map();
      context.focus.forEach((tx) => {
        const key = `${displayStage(tx.supplierStage)} → ${displayStage(tx.buyerStage)}`;
        routes.set(key, (routes.get(key) || 0) + 1);
      });
      byId("hierarchyMeta").textContent = context.mode === "camera" ? "当前视角区域内的主路径" : "请先锁定一个实体";
      body.innerHTML = `
        <div class="empty-state">点击左侧搜索结果、地球节点或关系连线后，这里会按上游和下游分层展开详细主体。</div>
        <div class="kv-list">
          ${[...routes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([key, value]) => `
            <div class="kv-row"><span>${esc(key)}</span><strong>${fmt.format(value)}</strong></div>
          `).join("")}
        </div>
      `;
      return;
    }

    const upstream = buildHierarchyGroups(context.entity, context.focus, "upstream");
    const downstream = buildHierarchyGroups(context.entity, context.focus, "downstream");
    byId("hierarchyMeta").textContent = `围绕 ${context.entity.name} 展开`;
    body.innerHTML = `
      <div class="hierarchy-columns">
        ${hierarchyColumnHtml("上游", upstream)}
        ${hierarchyColumnHtml("下游", downstream)}
      </div>
    `;
  }

  function buildGlobeData(context) {
    const activeTxIds = new Set(context.focus.map((tx) => tx.id));
    const pointMap = new Map();
    const arcs = [];
    const sampleLimit = context.mode === "global"
      ? (state.dense ? 280 : 160)
      : (state.dense ? 420 : 260);
    const stride = context.base.length > sampleLimit ? Math.ceil(context.base.length / sampleLimit) : 1;

    context.base.forEach((tx, index) => {
      const active = activeTxIds.has(tx.id);
      const selected = tx.id === state.selectedTxId;
      if (index % stride && !active && !selected) return;

      const source = sideNodeFromTx(tx, "source");
      const target = sideNodeFromTx(tx, "target");
      [source, target].forEach((point) => {
        if (!isNum(point.lat) || !isNum(point.lon)) return;
        if (!pointMap.has(point.key)) {
          pointMap.set(point.key, {
            ...point,
            weight: 0,
            stageCounts: new Map(),
            active: false,
            selected: false
          });
        }
        const entry = pointMap.get(point.key);
        entry.weight += 1;
        entry.stageCounts.set(point.stage, (entry.stageCounts.get(point.stage) || 0) + 1);
        entry.active = entry.active || active;
        entry.selected = entry.selected || point.entityId === state.selectedEntityId;
      });

      if (isNum(source.lat) && isNum(source.lon) && isNum(target.lat) && isNum(target.lon)) {
        arcs.push({
          ...tx,
          active,
          selected,
          dashOffset: (index * 0.141) % 1,
          kind: "base",
          sourceColor: stageColor(tx.supplierStage),
          targetColor: stageColor(tx.buyerStage)
        });
        if (active || selected) {
          arcs.push({
            ...tx,
            active,
            selected,
            dashOffset: (index * 0.141) % 1,
            kind: "focus",
            sourceColor: stageColor(tx.supplierStage),
            targetColor: stageColor(tx.buyerStage)
          });
        }
      }
    });

    const points = [...pointMap.values()].map((point) => ({
      ...point,
      dominantStage: [...point.stageCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || point.stage
    }));

    const labelLimit = state.view.altitude < 1.2 ? 26 : (context.entity ? 18 : 12);
    const labels = state.labels
      ? points
          .filter((point) => point.selected || point.active || state.view.altitude < 1.15)
          .sort((a, b) => Number(b.selected) - Number(a.selected) || Number(b.active) - Number(a.active) || b.weight - a.weight)
          .slice(0, labelLimit)
          .map((point) => ({
            lat: point.lat,
            lng: point.lon,
            altitude: point.selected ? 0.065 : 0.038,
            text: shortText(point.name, 20),
            color: stageColor(point.dominantStage)
          }))
      : [];

    return { points, arcs, labels };
  }

  function focusPointsForCamera(context) {
    const list = [];
    const seen = new Set();
    context.focus.forEach((tx) => {
      [sideNodeFromTx(tx, "source"), sideNodeFromTx(tx, "target")].forEach((point) => {
        if (!point.entityId || !isNum(point.lat) || !isNum(point.lon)) return;
        const key = `${point.entityId}:${point.stage}`;
        if (seen.has(key)) return;
        seen.add(key);
        list.push(point);
      });
    });
    return list;
  }

  function averageLng(points) {
    if (!points.length) return state.view.lng;
    const sumX = points.reduce((sum, point) => sum + Math.cos(Number(point.lon) * Math.PI / 180), 0);
    const sumY = points.reduce((sum, point) => sum + Math.sin(Number(point.lon) * Math.PI / 180), 0);
    return Math.atan2(sumY, sumX) * 180 / Math.PI;
  }

  function computeFocusView(context) {
    if (!context.entity && !context.tx) return state.view;
    const points = focusPointsForCamera(context);
    if (!points.length) return null;
    const lat = points.reduce((sum, point) => sum + Number(point.lat), 0) / points.length;
    const lng = averageLng(points);
    const latSpan = Math.max(...points.map((point) => Number(point.lat))) - Math.min(...points.map((point) => Number(point.lat)));
    const lonSpan = Math.max(...points.map((point) => Number(point.lon))) - Math.min(...points.map((point) => Number(point.lon)));
    const span = Math.max(latSpan, lonSpan * 0.65);
    const altitude = context.entity || context.tx
      ? clamp(0.82 + span / 42, 0.82, 1.85)
      : clamp(1.0 + span / 52, 1.0, 2.35);
    return { lat, lng: normalizeLon(lng), altitude };
  }

  function setPointOfView(view, duration = 900) {
    if (!globe || !view) return;
    state.suppressViewSync = true;
    state.view = { lat: view.lat, lng: normalizeLon(view.lng), altitude: view.altitude };
    globe.pointOfView(state.view, duration);
    window.clearTimeout(viewSyncTimer);
    viewSyncTimer = window.setTimeout(() => {
      state.suppressViewSync = false;
    }, duration + 80);
  }

  function syncViewFromGlobe() {
    if (!globe || state.suppressViewSync) return;
    const view = globe.pointOfView();
    if (!view) return;
    state.view = {
      lat: Number(view.lat || 0),
      lng: normalizeLon(Number(view.lng || 0)),
      altitude: Number(view.altitude || 2.2)
    };
  }

  function ensureGlobe() {
    if (globe) return globe;
    if (typeof window.Globe !== "function") {
      setGlobeState("fallback", "三维地球组件没有成功加载，页面已切换到本地地球底图。");
      return null;
    }

    try {
      globe = new window.Globe(globeHost, {
        rendererConfig: { antialias: true, alpha: true, powerPreference: "high-performance" }
      })
        .width(globeHost.clientWidth || window.innerWidth)
        .height(globeHost.clientHeight || window.innerHeight)
        .backgroundColor("rgba(0,0,0,0)")
        .globeImageUrl(TEXTURES[state.texture].url)
        .bumpImageUrl("assets/earth_topology.png")
        .showAtmosphere(true)
        .atmosphereColor("#9fdcff")
        .atmosphereAltitude(0.17)
        .globeCurvatureResolution(3)
        .pointAltitude((point) => point.selected ? 0.05 : (point.active ? 0.036 : 0.022))
        .pointRadius((point) => point.selected ? 0.22 : clamp(0.07 + point.weight * 0.009, 0.08, 0.16))
        .arcAltitudeAutoScale(0.22)
        .arcStroke((arc) => arc.kind === "focus" ? (arc.selected ? 0.38 : 0.26) : 0.12)
        .arcDashLength((arc) => arc.kind === "focus" ? 0.24 : 1)
        .arcDashGap((arc) => arc.kind === "focus" ? 1 : 0)
        .arcDashInitialGap("dashOffset")
        .arcDashAnimateTime((arc) => arc.kind === "focus" ? 2300 : 0)
        .pointsTransitionDuration(0)
        .arcsTransitionDuration(0)
        .htmlTransitionDuration(0)
        .htmlLat("lat")
        .htmlLng("lng")
        .htmlAltitude("altitude")
        .htmlElement((item) => {
          const node = document.createElement("div");
          node.className = "glabel";
          node.innerHTML = `<span class="glabel-dot" style="--dot:${item.color}"></span><span>${esc(item.text)}</span>`;
          return node;
        })
        .onPointHover((point) => openTooltip(point ? `
          <div><strong>${esc(point.name)}</strong></div>
          <div>${esc(displayStage(point.dominantStage || point.stage))} | ${esc(displayCountry(point.country || ""))}</div>
          <div>${fmt.format(point.weight)} 条关联关系</div>
          <div>坐标来源：${esc(displayPointOrigin(point.pointOrigin))}</div>
          <div>${esc(safeText(point.place, "未标注地点"))}</div>
        ` : ""))
        .onPointClick((point) => {
          if (!point || !point.entityId) return;
          selectEntity(point.entityId);
        })
        .onArcHover((arc) => openTooltip(arc ? `
          <div><strong>${esc(entityTitle(arc.supplierFacilityId || arc.supplierCompanyId, arc.supplierCompany || arc.supplierFacility))} → ${esc(entityTitle(arc.buyerFacilityId || arc.buyerCompanyId, arc.buyerCompany || arc.buyerFacility))}</strong></div>
          <div>${esc(displayStage(arc.supplierStage))} → ${esc(displayStage(arc.buyerStage))}</div>
          <div>数量/规模：${esc(formatAmount(arc))}</div>
          <div>时间：${esc(formatDate(arc))}</div>
        ` : ""))
        .onArcClick((arc) => {
          if (!arc || !arc.id) return;
          selectTransaction(arc.id);
        });

      const controls = globe.controls ? globe.controls() : null;
      if (controls) {
        controls.enablePan = false;
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.36;
        controls.minDistance = 140;
        controls.maxDistance = 920;
        controls.zoomSpeed = 0.85;
        controls.rotateSpeed = 0.78;
        controls.addEventListener?.("change", () => {
          syncViewFromGlobe();
          if (state.suppressViewSync) return;
          window.clearTimeout(viewSyncTimer);
          viewSyncTimer = window.setTimeout(() => {
            renderAll({ recenter: false, updateGlobe: false });
          }, 120);
        });
      }

      globeHost.addEventListener("mousemove", (event) => {
        state.pointerX = event.clientX + 14;
        state.pointerY = event.clientY + 14;
        if (tooltip.style.display === "block") {
          tooltip.style.left = `${state.pointerX}px`;
          tooltip.style.top = `${state.pointerY}px`;
        }
      });
      globeHost.addEventListener("mouseleave", () => openTooltip(""));

      new ResizeObserver(() => {
        if (!globe) return;
        globe.width(globeHost.clientWidth || window.innerWidth).height(globeHost.clientHeight || window.innerHeight);
      }).observe(globeHost);

      globe.pointOfView(state.view, 0);
      setGlobeState("webgl", "");
      return globe;
    } catch (error) {
      console.error(error);
      setGlobeState("fallback", "三维地球初始化失败，页面已切换到本地地球底图。");
      return null;
    }
  }

  function renderGlobe(context, { recenter = true } = {}) {
    const g = ensureGlobe();
    if (!g) return;

    try {
      const data = buildGlobeData(context);
      g.pointsData(data.points)
        .pointLat("lat")
        .pointLng("lon")
        .pointColor((point) => {
          const color = stageColor(point.dominantStage);
          if (point.selected) return color;
          return point.active ? withAlpha(color, "cc") : withAlpha(color, "55");
        })
        .arcsData(data.arcs)
        .arcStartLat("sourceLat")
        .arcStartLng("sourceLon")
        .arcEndLat("targetLat")
        .arcEndLng("targetLon")
        .arcColor((arc) => {
          if (arc.kind === "focus") {
            return arc.selected
              ? ["rgba(255,255,255,.98)", "rgba(255,255,255,.28)"]
              : [withAlpha(arc.sourceColor, "f0"), withAlpha(arc.targetColor, "b8")];
          }
          return [withAlpha(arc.sourceColor, arc.active ? "80" : "28"), withAlpha(arc.targetColor, arc.active ? "80" : "28")];
        })
        .htmlElementsData(data.labels);

      const controls = g.controls ? g.controls() : null;
      if (controls) controls.autoRotate = state.autoRotate && !state.selectedEntityId && !state.selectedTxId;

      if (recenter) {
        const targetView = computeFocusView(context) || state.view;
        if (targetView) setPointOfView(targetView, 900);
      }

      setGlobeState("webgl", "");
    } catch (error) {
      console.error(error);
      setGlobeState("fallback", "三维地球渲染失败，页面已保留本地地球底图与图谱面板。");
    }
  }

  async function applyTextureProfile(profile) {
    const config = TEXTURES[profile] || TEXTURES.github;
    try {
      await preloadImage(config.url);
      state.texture = profile;
      state.textureNotice = config.hint;
      byId("textureSelect").value = profile;
      if (globe) globe.globeImageUrl(config.url);
    } catch (error) {
      const fallback = profile === "github" ? TEXTURES.sharp : TEXTURES.balanced;
      state.texture = profile === "github" ? "sharp" : "balanced";
      state.textureNotice = `${config.label} 加载失败，已自动切换到 ${fallback.label}。`;
      byId("textureSelect").value = state.texture;
      if (globe) globe.globeImageUrl(fallback.url);
    }
  }

  function renderStatus(context) {
    byId("queryMeta").textContent = context.entity
      ? `已锁定：${context.entity.name}`
      : (context.mode === "camera" ? "当前视角区域" : "全链路视角");
    byId("statusText").textContent = context.entity
      ? `围绕 ${context.entity.name} 显示 ${fmt.format(context.focus.length)} 条关系`
      : `当前显示 ${fmt.format(context.focus.length)} 条关系`;

    byId("chips").innerHTML = [
      `关系 ${fmt.format(context.focus.length)}`,
      `视角 ${state.view.lat.toFixed(1)}°, ${state.view.lng.toFixed(1)}°`,
      `影像 ${TEXTURES[state.texture].label}`,
      state.stage !== "all" ? `环节 ${displayStage(state.stage)}` : "",
      context.entity ? `实体 ${context.entity.name}` : "",
      state.globeMode === "fallback" ? "地球 底图模式" : ""
    ].filter(Boolean).map((item) => `<span class="chip">${esc(item)}</span>`).join("");

    byId("textureHint").textContent = [state.textureNotice, state.globeNotice, FILE_PROTOCOL_HINT].filter(Boolean).join(" ");
  }

  function renderAll(options = {}) {
    const { recenter = true, updateGlobe = true } = options;
    const context = computeContext();
    renderFocusChip(context);
    renderStatus(context);
    renderResults();
    renderSummary(context);
    renderTxCard(context);
    renderRelationList(context);
    renderEvidenceChain(context);
    renderRegion(context);
    renderChain(context);
    renderHierarchy(context);
    if (updateGlobe) renderGlobe(context, { recenter });
  }

  function selectEntity(entityId) {
    state.selectedEntityId = entityId || "";
    const base = stageFilteredTransactions();
    const related = entityId ? entityFocusedTransactions(base, entityId) : [];
    state.selectedTxId = related[0]?.id || "";
    state.evidenceOpen = Boolean(entityId);
    renderAll({ recenter: true, updateGlobe: true });
  }

  function selectTransaction(txId) {
    if (!txById.has(txId)) return;
    state.selectedTxId = txId;
    renderAll({ recenter: true, updateGlobe: true });
  }

  function resetAll() {
    state.selectedEntityId = "";
    state.selectedTxId = "";
    state.evidenceOpen = false;
    state.stage = "all";
    state.labels = true;
    state.dense = false;
    state.autoRotate = true;
    state.view = { lat: 16, lng: 102, altitude: 2.35 };
    byId("searchInput").value = "";
    byId("stageSelect").value = "all";
    byId("labelsBtn").classList.add("is-on");
    byId("densityBtn").classList.remove("is-on");
    byId("rotateBtn").classList.add("is-on");
    renderAll({ recenter: true, updateGlobe: true });
  }

  byId("stageSelect").innerHTML = `<option value="all">全部环节</option>${stageOrder.map((stage) => `<option value="${esc(stage)}">${esc(displayStage(stage))}</option>`).join("")}`;

  byId("results").addEventListener("click", (event) => {
    const button = event.target.closest("[data-entity]");
    if (!button) return;
    selectEntity(button.dataset.entity);
  });

  byId("relationList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tx]");
    if (!button) return;
    selectTransaction(button.dataset.tx);
  });

  byId("evidenceUpstream").addEventListener("click", (event) => {
    if (event.target.closest("a")) return;
    const card = event.target.closest("[data-tx]");
    if (!card) return;
    selectTransaction(card.dataset.tx);
  });

  byId("evidenceDownstream").addEventListener("click", (event) => {
    if (event.target.closest("a")) return;
    const card = event.target.closest("[data-tx]");
    if (!card) return;
    selectTransaction(card.dataset.tx);
  });

  byId("hierarchyBody").addEventListener("click", (event) => {
    const txButton = event.target.closest("[data-tx]");
    if (txButton) selectTransaction(txButton.dataset.tx);
    const entityButton = event.target.closest("[data-entity]");
    if (entityButton && entityButton.dataset.entity) selectEntity(entityButton.dataset.entity);
  });

  byId("regionSvg").addEventListener("click", (event) => {
    const txNode = event.target.closest("[data-tx]");
    if (txNode) {
      selectTransaction(txNode.dataset.tx);
      return;
    }
    const entityNode = event.target.closest("[data-entity]");
    if (entityNode && entityNode.dataset.entity) selectEntity(entityNode.dataset.entity);
  });

  byId("chainSvg").addEventListener("click", (event) => {
    const txNode = event.target.closest("[data-tx]");
    if (txNode) {
      selectTransaction(txNode.dataset.tx);
      return;
    }
    const entityNode = event.target.closest("[data-entity]");
    if (entityNode && entityNode.dataset.entity) selectEntity(entityNode.dataset.entity);
  });

  byId("searchInput").addEventListener("input", renderResults);
  byId("searchInput").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const first = byId("results").querySelector("[data-entity]");
    if (first) selectEntity(first.dataset.entity);
  });

  byId("stageSelect").addEventListener("change", (event) => {
    state.stage = event.target.value;
    renderAll({ recenter: true, updateGlobe: true });
  });

  byId("textureSelect").addEventListener("change", (event) => {
    applyTextureProfile(event.target.value).finally(() => renderAll({ recenter: false, updateGlobe: true }));
  });

  byId("clearBtn").addEventListener("click", () => {
    state.selectedEntityId = "";
    state.selectedTxId = "";
    state.evidenceOpen = false;
    byId("searchInput").value = "";
    renderAll({ recenter: false, updateGlobe: true });
  });

  byId("openEvidenceBtn").addEventListener("click", () => {
    if (!currentEntity()) return;
    setEvidenceVisibility(!state.evidenceOpen);
  });

  byId("closeEvidenceBtn").addEventListener("click", () => {
    setEvidenceVisibility(false);
  });

  byId("evidenceBackdrop").addEventListener("click", () => {
    setEvidenceVisibility(false);
  });

  byId("resetBtn").addEventListener("click", resetAll);

  byId("labelsBtn").addEventListener("click", (event) => {
    state.labels = !state.labels;
    event.currentTarget.classList.toggle("is-on", state.labels);
    renderAll({ recenter: false, updateGlobe: true });
  });

  byId("densityBtn").addEventListener("click", (event) => {
    state.dense = !state.dense;
    event.currentTarget.classList.toggle("is-on", state.dense);
    renderAll({ recenter: false, updateGlobe: true });
  });

  byId("rotateBtn").addEventListener("click", (event) => {
    state.autoRotate = !state.autoRotate;
    event.currentTarget.classList.toggle("is-on", state.autoRotate);
    renderAll({ recenter: false, updateGlobe: true });
  });

  byId("zoomInBtn").addEventListener("click", () => {
    const g = ensureGlobe();
    if (!g) return;
    const view = g.pointOfView();
    setPointOfView({
      lat: Number(view.lat),
      lng: Number(view.lng),
      altitude: clamp(Number(view.altitude) * 0.82, 0.72, 3.6)
    }, 420);
    window.setTimeout(() => renderAll({ recenter: false, updateGlobe: false }), 440);
  });

  byId("zoomOutBtn").addEventListener("click", () => {
    const g = ensureGlobe();
    if (!g) return;
    const view = g.pointOfView();
    setPointOfView({
      lat: Number(view.lat),
      lng: Number(view.lng),
      altitude: clamp(Number(view.altitude) * 1.2, 0.72, 3.6)
    }, 420);
    window.setTimeout(() => renderAll({ recenter: false, updateGlobe: false }), 440);
  });

  window.addEventListener("resize", () => {
    if (globe) globe.width(globeHost.clientWidth || window.innerWidth).height(globeHost.clientHeight || window.innerHeight);
  });

  buildLegend();
  setupFallbackEarth();
  setupFallbackInteraction();
  setGlobeState("fallback", "");
  applyTextureProfile(state.texture).finally(() => renderAll({ recenter: true, updateGlobe: true }));
})();
