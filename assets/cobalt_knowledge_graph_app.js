(() => {
  const DATA = window.COBALT_GEOSCENE_DATA;

  if (!DATA || !Array.isArray(DATA.transactions)) {
    document.body.innerHTML = "<div style='padding:32px;font-family:Segoe UI,Microsoft YaHei,sans-serif'>缺少数据文件，请先生成 cobalt knowledge graph 所需数据。</div>";
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
  const uniqueValues = (list) => {
    const seen = new Set();
    const result = [];
    toArray(list).forEach((item) => {
      const text = String(item ?? "").trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      result.push(text);
    });
    return result;
  };
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
    return text || "#7ab6ff";
  };
  const pushMapArray = (map, key, value) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
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
    netherlands: "荷兰",
    sweden: "瑞典",
    norway: "挪威",
    poland: "波兰",
    india: "印度",
    philippines: "菲律宾",
    luxembourg: "卢森堡",
    portugal: "葡萄牙",
    spain: "西班牙",
    italy: "意大利",
    austria: "奥地利",
    "south africa": "南非",
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

  const ENTITY_TYPE_LABELS = {
    company: "企业",
    facility: "矿点/设施"
  };

  const POINT_ORIGIN_LABELS = {
    facility: "设施坐标",
    company: "企业坐标",
    centroid: "区域中心点",
    inferred: "推定坐标"
  };

  const stageOrder = DATA.stageOrder || [];
  const stageColors = DATA.stageColors || {};
  const stageLookup = new Map(stageOrder.map((stage) => [String(stage).toLowerCase(), stage]));

  const entities = new Map((DATA.entities || []).map((entity) => [entity.id, entity]));
  const sources = new Map((DATA.sources || []).map((source) => [source.id, source]));
  const tooltip = byId("tooltip");
  const globeHost = byId("globe");
  const chain3dCanvas = byId("chain3dCanvas");
  const chain3dLegend = byId("chain3dLegend");

  const rawTransactions = (DATA.transactions || []).map((tx) => ({
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

  const transactionIdentityKey = (tx) => JSON.stringify([
    tx.supplierCompanyId || "",
    tx.supplierFacilityId || "",
    tx.buyerCompanyId || "",
    tx.buyerFacilityId || "",
    tx.supplierStage || "",
    tx.buyerStage || "",
    uniqueValues(tx.inputCommodityIds).join("|"),
    uniqueValues(tx.outputCommodityIds).join("|"),
    uniqueValues(tx.sourceIds).join("|"),
    tx.date || "",
    tx.expectedDate || "",
    tx.realised || "",
    tx.amountTonnesRaw || "",
    tx.amountUnitsRaw || "",
    tx.amountUsdRaw || "",
    tx.amountYuanRaw || "",
    tx.amountEnergyRaw || "",
    uniqueValues(tx.notes).join("|")
  ]);

  const transactions = [];
  const dedupedTransactions = new Map();
  rawTransactions.forEach((tx) => {
    const key = transactionIdentityKey(tx);
    const existing = dedupedTransactions.get(key);
    if (!existing) {
      const merged = { ...tx, rawCount: 1, rawIds: [tx.id] };
      dedupedTransactions.set(key, merged);
      transactions.push(merged);
      return;
    }
    existing.rawCount += 1;
    existing.rawIds.push(tx.id);
    existing.sourceIds = uniqueValues([...existing.sourceIds, ...tx.sourceIds]);
    existing.notes = uniqueValues([...existing.notes, ...tx.notes]);
    existing.inputCommodities = uniqueValues([...existing.inputCommodities, ...tx.inputCommodities]);
    existing.outputCommodities = uniqueValues([...existing.outputCommodities, ...tx.outputCommodities]);
    existing.inputCommodityIds = uniqueValues([...existing.inputCommodityIds, ...tx.inputCommodityIds]);
    existing.outputCommodityIds = uniqueValues([...existing.outputCommodityIds, ...tx.outputCommodityIds]);
    existing.sourceCount = Math.max(existing.sourceCount || 0, tx.sourceCount || 0, existing.sourceIds.length);
    existing.hasQuantity = existing.hasQuantity || tx.hasQuantity;
    existing.hasDate = existing.hasDate || tx.hasDate;
    if (!existing.date && tx.date) existing.date = tx.date;
    if (!existing.expectedDate && tx.expectedDate) existing.expectedDate = tx.expectedDate;
    if (!existing.realised && tx.realised) existing.realised = tx.realised;
    if (!existing.amountTonnesRaw && tx.amountTonnesRaw) existing.amountTonnesRaw = tx.amountTonnesRaw;
    if (!existing.amountUnitsRaw && tx.amountUnitsRaw) existing.amountUnitsRaw = tx.amountUnitsRaw;
    if (!existing.amountUsdRaw && tx.amountUsdRaw) existing.amountUsdRaw = tx.amountUsdRaw;
    if (!existing.amountYuanRaw && tx.amountYuanRaw) existing.amountYuanRaw = tx.amountYuanRaw;
    if (!existing.amountEnergyRaw && tx.amountEnergyRaw) existing.amountEnergyRaw = tx.amountEnergyRaw;
  });

  const txById = new Map(transactions.map((tx) => [tx.id, tx]));
  const companyFacilities = new Map();
  const facilityCompany = new Map();
  const txByEntity = new Map();
  const txBySupplierEntity = new Map();
  const txByBuyerEntity = new Map();
  const txBySupplierStageNode = new Map();
  const txByBuyerStageNode = new Map();

  (DATA.operatorPairs || []).forEach((pair) => {
    pushMapArray(companyFacilities, pair.companyId, pair.facilityId);
    if (pair.facilityId && !facilityCompany.has(pair.facilityId)) facilityCompany.set(pair.facilityId, pair.companyId);
  });

  const entityBaseLabelMap = new Map();
  const entityLabelCount = new Map();

  transactions.forEach((tx) => {
    [tx.supplierCompanyId, tx.buyerCompanyId, tx.supplierFacilityId, tx.buyerFacilityId].filter(Boolean).forEach((id) => pushMapArray(txByEntity, id, tx));
    [tx.supplierCompanyId, tx.supplierFacilityId].filter(Boolean).forEach((id) => pushMapArray(txBySupplierEntity, id, tx));
    [tx.buyerCompanyId, tx.buyerFacilityId].filter(Boolean).forEach((id) => pushMapArray(txByBuyerEntity, id, tx));
    [tx.supplierCompanyId && `${tx.supplierCompanyId}::${tx.supplierStage}`, tx.supplierFacilityId && `${tx.supplierFacilityId}::${tx.supplierStage}`]
      .filter(Boolean)
      .forEach((id) => pushMapArray(txBySupplierStageNode, id, tx));
    [tx.buyerCompanyId && `${tx.buyerCompanyId}::${tx.buyerStage}`, tx.buyerFacilityId && `${tx.buyerFacilityId}::${tx.buyerStage}`]
      .filter(Boolean)
      .forEach((id) => pushMapArray(txByBuyerStageNode, id, tx));
  });

  [...entities.values()].forEach((entity) => {
    const fallback = conciseEntityName(entity?.name || entity?.displayName || "");
    const label = preferredEntityLabel(entity, { fallback });
    entityBaseLabelMap.set(entity.id, label);
    const labelKey = normalizeLabelKey(label);
    entityLabelCount.set(labelKey, (entityLabelCount.get(labelKey) || 0) + 1);
  });

  function compactLabelText(value) {
    return String(value || "")
      .replace(/_\-_/g, ", ")
      .replace(/[|]/g, ", ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function conciseEntityName(value) {
    const text = compactLabelText(value);
    if (!text) return "";
    const trailingAcronymMatch = text.match(/[（(]([A-Z][A-Z0-9.&/\-]{1,12})[)）]\s*$/);
    if (trailingAcronymMatch && !/%/.test(trailingAcronymMatch[1])) return trailingAcronymMatch[1].trim();
    const bracketMatch = text.match(/^(.+?)\s*[（(]([^()（）]+)[)）]\s*$/);
    if (!bracketMatch) return text;
    const outside = compactLabelText(bracketMatch[1]);
    const inside = compactLabelText(bracketMatch[2]);
    if (!/%/.test(inside) && /^[A-Z][A-Z0-9.&/\-]{1,12}$/.test(inside)) return inside;
    return outside || text;
  }

  function normalizeLabelKey(value) {
    return compactLabelText(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
  }

  function genericFacilityToken(text) {
    return /^(headquarter|headquarters|office|plant|factory|facility|mine|smelter|refinery|project|warehouse)$/i.test(String(text || "").trim());
  }

  function firstAddressLabel(value) {
    const cleaned = compactLabelText(value);
    if (!cleaned) return "";
    const parts = cleaned.split(/,|\/|;/).map((item) => item.trim()).filter(Boolean);
    return parts.find((item) => item.length >= 5) || parts[0] || "";
  }

  function shortPlaceLabel(value) {
    const cleaned = compactLabelText(value);
    if (!cleaned) return "";
    const parts = cleaned.split(/,|\/|;/).map((item) => item.trim()).filter(Boolean);
    return parts[0] || "";
  }

  function looksLikeLocationOnlyLabel(label, place = "") {
    const text = compactLabelText(label);
    if (!text) return true;
    if (genericFacilityToken(text)) return true;
    if (/(company|co\.|corp|corporation|group|limited|ltd|inc|llc|plc|gmbh|sarl|sa|mine|mining|plant|factory|facility|refinery|smelter|industrial|technology|materials|battery|cobalt|nickel|metal|trading|works|project|park)/i.test(text)) return false;
    const placeKey = normalizeLabelKey(place);
    const textKey = normalizeLabelKey(text);
    if (!textKey) return true;
    return placeKey.includes(textKey) && text.split(/\s+/).length <= 3;
  }

  function ownerCompanyName(entity) {
    if (!entity || entity.type !== "facility") return "";
    const ownerId = facilityCompany.get(entity.id);
    return ownerId ? entities.get(ownerId)?.name || "" : "";
  }

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

  function preferredEntityLabel(entity, { companyName = "", facilityRaw = "", fallback = "" } = {}) {
    const parsed = parseFacilityText(facilityRaw);
    const ownerName = conciseEntityName(companyName || ownerCompanyName(entity));
    const entityName = entity?.type === "company"
      ? conciseEntityName(entity?.name || "")
      : compactLabelText(entity?.name || "");
    const displayName = compactLabelText(entity?.displayName || "");
    const entityPlace = compactLabelText(entity?.place || parsed.place || "");
    const typeLabel = displayFacilityType(parsed.type || entity?.facilityType || "");

    if (entity?.type === "company") {
      return compactLabelText(entityName || ownerName || conciseEntityName(fallback) || fallback) || "未命名主体";
    }
    if (entityName && !looksLikeLocationOnlyLabel(entityName, entityPlace) && !genericFacilityToken(entityName)) return entityName;
    if (displayName && !looksLikeLocationOnlyLabel(displayName, entityPlace) && !genericFacilityToken(displayName)) return displayName;
    if (ownerName && typeLabel && !/^(总部|办公室)$/.test(typeLabel)) {
      if (entityName && entityName.length <= 10 && !genericFacilityToken(entityName)) return `${compactLabelText(ownerName)} ${entityName}`;
      return `${compactLabelText(ownerName)} ${typeLabel}`;
    }
    if (ownerName && /^(总部|办公室)$/.test(typeLabel)) {
      const placeLabel = shortPlaceLabel(entityPlace);
      if (placeLabel) return `${compactLabelText(ownerName)} ${placeLabel}`;
    }
    if (ownerName) return compactLabelText(ownerName);
    const addressLabel = firstAddressLabel(entityPlace);
    if (addressLabel) return addressLabel;
    if (typeLabel) return typeLabel;
    return compactLabelText(entityName || fallback) || "未命名主体";
  }

  function entityPrimaryStage(entityId) {
    const counts = new Map();
    (txByEntity.get(entityId) || []).forEach((tx) => {
      if (tx.supplierCompanyId === entityId || tx.supplierFacilityId === entityId) counts.set(tx.supplierStage, (counts.get(tx.supplierStage) || 0) + 1);
      if (tx.buyerCompanyId === entityId || tx.buyerFacilityId === entityId) counts.set(tx.buyerStage, (counts.get(tx.buyerStage) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }

  function entityShortPlace(entityId, fallback = "") {
    const entity = entityId ? entities.get(entityId) : null;
    const parsed = parseFacilityText(fallback);
    return shortPlaceLabel(entity?.place || parsed.place || "");
  }

  function entityTitle(entityId, fallback = "", options = {}) {
    const { stage = "", includePlace = true } = options;
    const entity = entityId ? entities.get(entityId) : null;
    const conciseFallback = conciseEntityName(fallback);
    const baseLabel = entityBaseLabelMap.get(entityId) || preferredEntityLabel(entity, { fallback: conciseFallback || fallback });
    const labelKey = normalizeLabelKey(baseLabel);
    if ((entityLabelCount.get(labelKey) || 0) <= 1) return baseLabel;

    const resolvedStage = stage || entityPrimaryStage(entityId);
    const suffixes = [];
    if (resolvedStage) suffixes.push(displayStage(resolvedStage));

    const sameStageCount = resolvedStage
      ? [...entities.keys()].filter((id) => {
          const otherLabel = entityBaseLabelMap.get(id) || "";
          return normalizeLabelKey(otherLabel) === labelKey && entityPrimaryStage(id) === resolvedStage;
        }).length
      : 0;

    const place = includePlace ? entityShortPlace(entityId, fallback) : "";
    if (place && (!resolvedStage || sameStageCount > 1) && !suffixes.includes(place)) suffixes.push(place);
    return suffixes.length ? `${baseLabel} [${suffixes.join(" | ")}]` : baseLabel;
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

  function transactionCommodity(tx) {
    const inbound = tx.inputCommodities.join(" / ");
    const outbound = tx.outputCommodities.join(" / ");
    if (inbound && outbound && inbound !== outbound) return `${inbound} → ${outbound}`;
    return outbound || inbound || "未标注";
  }

  function stageColor(stage) {
    return stageColors[stage] || "#7ab6ff";
  }

  function sideNodeFromTx(tx, side) {
    const source = side === "source";
    const entityId = source ? (tx.supplierFacilityId || tx.supplierCompanyId) : (tx.buyerFacilityId || tx.buyerCompanyId);
    const entity = entityId ? entities.get(entityId) : null;
    const facilityRaw = source ? tx.supplierFacility : tx.buyerFacility;
    const companyRaw = source ? tx.supplierCompany : tx.buyerCompany;
    const parsed = parseFacilityText(facilityRaw);
    const label = preferredEntityLabel(entity, {
      companyName: companyRaw,
      facilityRaw,
      fallback: companyRaw || facilityRaw || "未命名主体"
    });
    return {
      key: entityId || `${source ? "supplier" : "buyer"}:${tx.id}`,
      entityId,
      companyId: source ? tx.supplierCompanyId : tx.buyerCompanyId,
      facilityId: source ? tx.supplierFacilityId : tx.buyerFacilityId,
      stage: source ? tx.supplierStage : tx.buyerStage,
      lat: Number(source ? tx.sourceLat : tx.targetLat),
      lon: Number(source ? tx.sourceLon : tx.targetLon),
      pointOrigin: source ? tx.sourcePointOrigin : tx.targetPointOrigin,
      country: entity?.country || (source ? tx.supplierCountry : tx.buyerCountry) || parsed.country || "",
      place: entity?.place || parsed.place || "",
      name: label
    };
  }

  const state = {
    selectedEntityId: "",
    selectedTxId: "",
    history: [],
    labels: true,
    autoRotate: true,
    pointerX: 0,
    pointerY: 0,
    regionOpen: false,
    evidenceOpen: false,
    view: { lat: 16, lng: 102, altitude: 2.35 },
    regionHoverKey: "",
    suppressViewSync: false,
    chain3d: {
      yaw: -0.48,
      pitch: 0.28,
      zoom: 1,
      hoverKey: "",
      dragActive: false,
      pointerDown: false,
      moved: false,
      lastX: 0,
      lastY: 0
    }
  };

  let globe = null;
  let viewSyncTimer = 0;
  let chain3dFrame = 0;
  let chain3dScene = { nodes: [], edges: [], projected: [] };

  function currentEntity() {
    return state.selectedEntityId ? entities.get(state.selectedEntityId) || null : null;
  }

  function currentTx() {
    return state.selectedTxId ? txById.get(state.selectedTxId) || null : null;
  }

  function selectionSnapshot() {
    return {
      entityId: state.selectedEntityId || "",
      txId: state.selectedTxId || ""
    };
  }

  function sameSelection(a, b) {
    return !!a && !!b &&
      String(a.entityId || "") === String(b.entityId || "") &&
      String(a.txId || "") === String(b.txId || "");
  }

  function pushSelectionHistory() {
    const snapshot = selectionSnapshot();
    const last = state.history[state.history.length - 1];
    if (sameSelection(snapshot, last)) return;
    state.history.push(snapshot);
    if (state.history.length > 24) state.history.shift();
  }

  function syncChain3DBackButton() {
    const btn = byId("chain3dBackBtn");
    if (!btn) return;
    const canBack = state.history.length > 0;
    btn.disabled = !canBack;
    btn.classList.toggle("is-on", canBack);
  }

  function goBackOneLevel() {
    const previous = state.history.pop();
    if (!previous) return;
    state.selectedEntityId = previous.entityId || "";
    state.selectedTxId = previous.txId || "";
    renderAll({ recenter: true, updateGlobe: true });
  }

  function graphSeedEntityIds(entityId) {
    const scope = new Set();
    if (!entityId) return scope;
    scope.add(entityId);
    const entity = entities.get(entityId);
    if (entity?.type === "company") {
      (companyFacilities.get(entity.id) || []).forEach((facilityId) => scope.add(facilityId));
    }
    return scope;
  }

  function txSideMatchesEntity(tx, side, entityId) {
    if (!entityId) return false;
    const supplierSide = side === "supplier";
    const companyId = supplierSide ? tx.supplierCompanyId : tx.buyerCompanyId;
    const facilityId = supplierSide ? tx.supplierFacilityId : tx.buyerFacilityId;
    const entity = entities.get(entityId);
    if (entity?.type === "facility") return facilityId === entityId;
    if (companyId === entityId) return true;
    if (entity?.type !== "company") return facilityId === entityId;
    if (!facilityId || !graphSeedEntityIds(entityId).has(facilityId)) return false;
    return !companyId || companyId === entityId;
  }

  function txTouchesEntity(tx, entityId) {
    return txSideMatchesEntity(tx, "supplier", entityId) || txSideMatchesEntity(tx, "buyer", entityId);
  }

  function matchesEntitySelection(point, entityId) {
    if (!entityId || !point) return false;
    return [point.entityId, point.companyId, point.facilityId].filter(Boolean).includes(entityId);
  }

  function entityFocusedTransactions(base, entityId) {
    return base.filter((tx) => txTouchesEntity(tx, entityId));
  }

  function txEntityIds(tx, side, options = {}) {
    const { preferFacility = true, includeCompanyFallback = true } = options;
    const companyId = side === "supplier" ? tx.supplierCompanyId : tx.buyerCompanyId;
    const facilityId = side === "supplier" ? tx.supplierFacilityId : tx.buyerFacilityId;
    if (preferFacility && facilityId) return [facilityId];
    if (companyId && includeCompanyFallback) return [companyId];
    if (facilityId) return [facilityId];
    return [];
  }

  function txStageNodeIds(tx, side, options = {}) {
    const { preferFacility = true, includeCompanyFallback = true } = options;
    const stage = side === "supplier" ? tx.supplierStage : tx.buyerStage;
    return txEntityIds(tx, side, { preferFacility, includeCompanyFallback }).map((id) => `${id}::${stage}`);
  }

  function expandEntityChainTransactions(base, entityId, options = {}) {
    const { maxDepth = 7 } = options;
    const allowedTxIds = new Set(base.map((tx) => tx.id));
    const collected = new Map();

    const walk = (seedIds, indexMap, nextSide) => {
      const seen = new Set(seedIds);
      let frontier = [...seedIds];
      let depth = 0;
      while (frontier.length && depth < maxDepth) {
        const nextFrontier = [];
        frontier.forEach((entityKey) => {
          (indexMap.get(entityKey) || []).forEach((tx) => {
            if (!allowedTxIds.has(tx.id)) return;
            if (!collected.has(tx.id)) collected.set(tx.id, tx);
            txStageNodeIds(tx, nextSide, { preferFacility: true, includeCompanyFallback: true }).forEach((nextId) => {
              if (!nextId || seen.has(nextId)) return;
              seen.add(nextId);
              nextFrontier.push(nextId);
            });
          });
        });
        frontier = nextFrontier;
        depth += 1;
      }
    };

    const downstreamSeeds = new Set();
    const upstreamSeeds = new Set();
    entityFocusedTransactions(base, entityId).forEach((tx) => {
      if (!allowedTxIds.has(tx.id)) return;
      const matchesSupplier = txSideMatchesEntity(tx, "supplier", entityId);
      const matchesBuyer = txSideMatchesEntity(tx, "buyer", entityId);
      if (!matchesSupplier && !matchesBuyer) return;
      collected.set(tx.id, tx);
      if (matchesSupplier) txStageNodeIds(tx, "buyer", { preferFacility: true, includeCompanyFallback: true }).forEach((id) => downstreamSeeds.add(id));
      if (matchesBuyer) txStageNodeIds(tx, "supplier", { preferFacility: true, includeCompanyFallback: true }).forEach((id) => upstreamSeeds.add(id));
    });

    walk([...downstreamSeeds], txBySupplierStageNode, "buyer");
    walk([...upstreamSeeds], txByBuyerStageNode, "supplier");
    return [...collected.values()];
  }

  function transactionNeighborhood(base, tx) {
    const scopedIds = new Set([
      tx.supplierCompanyId,
      tx.buyerCompanyId,
      tx.supplierFacilityId,
      tx.buyerFacilityId
    ].filter(Boolean));
    return base.filter((item) =>
      item.id === tx.id ||
      scopedIds.has(item.supplierCompanyId) ||
      scopedIds.has(item.buyerCompanyId) ||
      scopedIds.has(item.supplierFacilityId) ||
      scopedIds.has(item.buyerFacilityId)
    );
  }

  function averageLng(points) {
    if (!points.length) return 102;
    const sumX = points.reduce((sum, point) => sum + Math.cos(Number(point.lon) * Math.PI / 180), 0);
    const sumY = points.reduce((sum, point) => sum + Math.sin(Number(point.lon) * Math.PI / 180), 0);
    return Math.atan2(sumY, sumX) * 180 / Math.PI;
  }

  function normalizeLon(lon) {
    let value = Number(lon);
    while (value <= -180) value += 360;
    while (value > 180) value -= 360;
    return value;
  }

  function computeFocusView(list) {
    if (!list.length) return { lat: 16, lng: 102, altitude: 2.35 };
    const points = [];
    const seen = new Set();
    list.forEach((tx) => {
      [sideNodeFromTx(tx, "source"), sideNodeFromTx(tx, "target")].forEach((point) => {
        if (!point.entityId || !isNum(point.lat) || !isNum(point.lon)) return;
        const key = `${point.entityId}:${point.stage}`;
        if (seen.has(key)) return;
        seen.add(key);
        points.push(point);
      });
    });
    if (!points.length) return { lat: 16, lng: 102, altitude: 2.35 };
    const lat = points.reduce((sum, point) => sum + Number(point.lat), 0) / points.length;
    const lng = averageLng(points);
    const latSpan = Math.max(...points.map((point) => Number(point.lat))) - Math.min(...points.map((point) => Number(point.lat)));
    const lonSpan = Math.max(...points.map((point) => Number(point.lon))) - Math.min(...points.map((point) => Number(point.lon)));
    const span = Math.max(latSpan, lonSpan * 0.66);
    return {
      lat,
      lng: normalizeLon(lng),
      altitude: clamp(0.86 + span / 44, 0.84, 2.0)
    };
  }

  const searchCatalog = [...entities.values()].map((entity) => ({
    id: entity.id,
    type: entity.type,
    name: entity.name,
    country: entity.country || "",
    count: (txByEntity.get(entity.id) || []).length,
    label: entityTitle(entity.id, entity.name),
    blob: [
      entity.name,
      entity.searchLabel,
      entity.displayName,
      entity.place,
      entity.country,
      entity.facilityType,
      entityTitle(entity.id, entity.name)
    ].filter(Boolean).join(" ").toLowerCase()
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "en"));

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

  function currentModeLabel(context) {
    if (context.mode === "entity" && context.entity) {
      return context.chainStage
        ? `当前锁定：${entityTitle(context.entity.id, context.entity.name)} / ${displayStage(context.chainStage)}`
        : `围绕 ${entityTitle(context.entity.id, context.entity.name)}`;
    }
    if (context.mode === "transaction" && context.tx) return "关系邻域";
    if (context.mode === "camera") return "当前视角区域";
    return "全球总览";
  }

  function currentModeSub(context) {
    if (context.mode === "entity" && context.entity) {
      return context.chainStage
        ? "当前仅显示这个阶段节点对应的真实上下游链条，不再混入同主体其他阶段的支线。"
        : "当前围绕该实体的供应链关系、空间落点与上下游主体联动展示。";
    }
    if (context.mode === "transaction" && context.tx) return "已聚焦当前关系及其相关企业/设施。点击其他关系可继续钻取。";
    if (context.mode === "camera") return `视角中心 ${state.view.lat.toFixed(1)}°, ${state.view.lng.toFixed(1)}°；半径约 ${fmt.format(Math.round(context.cameraRadiusKm))} 公里。`;
    return "拖动或缩放地球后，页面会自动切换到当前视角对应的区域关系。";
  }

  function computeContext() {
    const base = transactions;
    const entity = currentEntity();
    const tx = currentTx();
    let focus = base;
    if (entity) focus = entityFocusedTransactions(base, entity.id);
    else if (tx) focus = transactionNeighborhood(base, tx);
    const chainFocus = entity
      ? expandEntityChainTransactions(base, entity.id, { includeFacilities: entity.type === "facility" })
      : focus;
    return { base, entity, tx, focus, chainFocus };
  }

  function buildGlobeData(context) {
    const renderList = context.entity ? context.chainFocus : context.focus;
    const pointMap = new Map();
    const arcMap = new Map();

    renderList.forEach((tx, index) => {
      const source = sideNodeFromTx(tx, "source");
      const target = sideNodeFromTx(tx, "target");
      if (![source, target].every((point) => isNum(point.lat) && isNum(point.lon))) return;

      [source, target].forEach((point) => {
        const pointKey = `${point.entityId || point.key}::${point.stage}`;
        if (!pointMap.has(pointKey)) {
          pointMap.set(pointKey, {
            key: pointKey,
            entityId: point.entityId,
            stage: point.stage,
            lat: Number(point.lat),
            lng: Number(point.lon),
            lon: Number(point.lon),
            pointOrigin: point.pointOrigin,
            companyId: point.companyId,
            facilityId: point.facilityId,
            country: point.country,
            place: point.place,
            name: point.name,
            weight: 0,
            selected: false
          });
        }
        const entry = pointMap.get(pointKey);
        entry.weight += 1;
        entry.selected = entry.selected || matchesEntitySelection(point, state.selectedEntityId);
      });

      const sourceKey = `${source.entityId || source.key}::${source.stage}`;
      const targetKey = `${target.entityId || target.key}::${target.stage}`;
      const arcKey = `${sourceKey}=>${targetKey}`;
      if (!arcMap.has(arcKey)) {
        arcMap.set(arcKey, {
          key: arcKey,
          sourceKey,
          targetKey,
          startLat: Number(source.lat),
          startLng: Number(source.lon),
          endLat: Number(target.lat),
          endLng: Number(target.lon),
          sourceColor: stageColor(tx.supplierStage),
          targetColor: stageColor(tx.buyerStage),
          relation: `${displayStage(tx.supplierStage)} 閳?${displayStage(tx.buyerStage)}`,
          count: 0,
          weight: 0,
          txIds: [],
          sampleTxId: tx.id,
          sampleTitle: `${entityTitle(tx.supplierFacilityId || tx.supplierCompanyId, tx.supplierCompany || tx.supplierFacility, { stage: tx.supplierStage })} 閳?${entityTitle(tx.buyerFacilityId || tx.buyerCompanyId, tx.buyerCompany || tx.buyerFacility, { stage: tx.buyerStage })}`
        });
      }
      const arc = arcMap.get(arcKey);
      arc.count += 1;
      arc.weight += Number(tx.amountTonnesValue || tx.amountUnitsValue || 1) || 1;
      arc.txIds.push(tx.id);
      arc.dashOffset = (index * 0.137) % 1;
    });

    const points = [...pointMap.values()];
    const arcs = [...arcMap.values()];
    const labelLimit = context.entity ? 34 : 20;
    const labels = state.labels
      ? points
          .sort((a, b) => Number(b.selected) - Number(a.selected) || b.weight - a.weight)
          .slice(0, labelLimit)
          .map((point) => ({
            lat: point.lat,
            lng: point.lng,
            altitude: point.selected ? 0.08 : 0.05,
            text: point.selected ? entityTitle(point.entityId, point.name, { stage: point.stage }) : shortText(entityTitle(point.entityId, point.name, { stage: point.stage }), 22),
            color: stageColor(point.stage)
          }))
      : [];
    return { points, arcs, labels };
  }

  function renderLegend() {
    byId("legendList").innerHTML = stageOrder.map((stage) => `
      <span class="legend-pill">
        <span class="legend-dot" style="--dot:${stageColor(stage)}"></span>
        ${esc(displayStage(stage))}
      </span>
    `).join("");
  }

  function renderSearchResults() {
    const query = byId("searchInput").value.trim().toLowerCase();
    const items = (query ? searchCatalog.filter((item) => item.blob.includes(query)) : searchCatalog).slice(0, 16);
    byId("results").innerHTML = items.length
      ? items.map((item) => `
        <button class="result-item ${item.id === state.selectedEntityId ? "is-active" : ""}" type="button" data-entity="${esc(item.id)}">
          <div>
            <div class="result-name">${esc(item.label)}</div>
            <div class="result-meta">${esc(displayCountry(item.country))} | ${esc(displayEntityType(item.type))} | ${fmt.format(item.count)} 条关联关系</div>
          </div>
          <span class="result-tag">${item.type === "company" ? "企业" : "设施"}</span>
        </button>
      `).join("")
      : "<div class='empty-state'>没有找到匹配的企业、矿点或设施，请尝试更换关键词。</div>";
  }

  function buildFocusCard(context) {
    if (context.entity) {
      return `
        <div class="focus-title">${esc(entityTitle(context.entity.id, context.entity.name))}</div>
        <div class="focus-sub">${esc(currentModeSub(context))}</div>
      `;
    }
    return `
      <div class="focus-title">全球完整视图</div>
      <div class="focus-sub">${esc(currentModeSub(context))}</div>
    `;
  }

  function dominantStageForEntity(entityId) {
    const counts = new Map();
    (txByEntity.get(entityId) || []).forEach((tx) => {
      if (tx.supplierCompanyId === entityId || tx.supplierFacilityId === entityId) counts.set(tx.supplierStage, (counts.get(tx.supplierStage) || 0) + 1);
      if (tx.buyerCompanyId === entityId || tx.buyerFacilityId === entityId) counts.set(tx.buyerStage, (counts.get(tx.buyerStage) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }

  function entitySubtitle(entity) {
    if (!entity) return "未锁定实体";
    const tags = [displayEntityType(entity.type), displayCountry(entity.country || "")];
    if (entity.facilityType) tags.push(displayFacilityType(entity.facilityType));
    const stage = dominantStageForEntity(entity.id);
    if (stage) tags.push(`主导类别：${displayStage(stage)}`);
    return tags.filter(Boolean).join(" | ");
  }

  function renderSummary(context) {
    const host = byId("summaryBody");
    const list = context.entity ? context.chainFocus : context.focus;

    if (!context.entity) {
      const countries = new Set();
      const nodes = new Set();
      list.forEach((tx) => {
        if (tx.supplierCountry) countries.add(displayCountry(tx.supplierCountry));
        if (tx.buyerCountry) countries.add(displayCountry(tx.buyerCountry));
        [tx.supplierCompanyId, tx.buyerCompanyId, tx.supplierFacilityId, tx.buyerFacilityId].filter(Boolean).forEach((id) => nodes.add(id));
      });
      host.innerHTML = `
        <div class="summary-card">
          <div class="summary-title">全局概况</div>
          <div class="summary-sub">当前展示的是完整钴供应链主图，覆盖主要主体、空间落点与来源文档。</div>
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-key">链路关系</div><div class="stat-value">${fmt.format(list.length)}</div></div>
            <div class="stat-card"><div class="stat-key">主体节点</div><div class="stat-value">${fmt.format(nodes.size)}</div></div>
            <div class="stat-card"><div class="stat-key">覆盖国家</div><div class="stat-value">${fmt.format(countries.size)}</div></div>
            <div class="stat-card"><div class="stat-key">来源文档</div><div class="stat-value">${fmt.format(DATA.meta?.sourceDocuments || DATA.meta?.sources || 0)}</div></div>
          </div>
        </div>
      `;
      return;
    }

    const entity = context.entity;
    const related = entityFocusedTransactions(context.base, entity.id);
    const upstream = new Set();
    const downstream = new Set();
    const stages = new Set();
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
    });

    host.innerHTML = `
      <div class="summary-card">
        <div class="summary-title">${esc(entityTitle(entity.id, entity.name))}</div>
        <div class="summary-sub">${esc(entitySubtitle(entity))}</div>
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-key">相关记录</div><div class="stat-value">${fmt.format(related.length)}</div></div>
          <div class="stat-card"><div class="stat-key">链路规模</div><div class="stat-value">${fmt.format(context.chainFocus.length)}</div></div>
          <div class="stat-card"><div class="stat-key">上游主体</div><div class="stat-value">${fmt.format(upstream.size)}</div></div>
          <div class="stat-card"><div class="stat-key">下游主体</div><div class="stat-value">${fmt.format(downstream.size)}</div></div>
        </div>
        <div class="kv-list">
          <div class="kv-row"><span>主体类型</span><span class="value">${esc(displayEntityType(entity.type))}</span></div>
          <div class="kv-row"><span>所在国家</span><span class="value">${esc(displayCountry(entity.country || ""))}</span></div>
          <div class="kv-row"><span>地点</span><span class="value">${esc(safeText(entity.place, "未标注"))}</span></div>
          <div class="kv-row"><span>涉及环节</span><strong>${fmt.format(stages.size)}</strong></div>
        </div>
      </div>
    `;
  }

  function renderStageStats(context) {
    const list = context.entity ? context.chainFocus : context.focus;
    const counts = new Map();
    list.forEach((tx) => {
      counts.set(tx.supplierStage, (counts.get(tx.supplierStage) || 0) + 1);
      counts.set(tx.buyerStage, (counts.get(tx.buyerStage) || 0) + 1);
    });
    byId("stageStats").innerHTML = stageOrder
      .filter((stage) => counts.has(stage))
      .map((stage) => `
        <span class="chip">
          <span class="node-dot" style="--dot:${stageColor(stage)}"></span>
          ${esc(displayStage(stage))}
          <strong>${fmt.format(counts.get(stage) || 0)}</strong>
        </span>
      `).join("") || "<div class='empty-state'>当前视图内暂未识别到环节分布。</div>";
  }

  function txScopeRole(tx, scope) {
    const supplierInScope = scope.has(tx.supplierCompanyId) || scope.has(tx.supplierFacilityId);
    const buyerInScope = scope.has(tx.buyerCompanyId) || scope.has(tx.buyerFacilityId);
    return {
      supplierInScope,
      buyerInScope,
      internal: supplierInScope && buyerInScope,
      upstreamExternal: buyerInScope && !supplierInScope,
      downstreamExternal: supplierInScope && !buyerInScope
    };
  }

  function relationPrimaryLabel(tx, side) {
    const source = side === "supplier";
    const entityId = source ? (tx.supplierFacilityId || tx.supplierCompanyId) : (tx.buyerFacilityId || tx.buyerCompanyId);
    const fallback = source ? (tx.supplierCompany || tx.supplierFacility) : (tx.buyerCompany || tx.buyerFacility);
    const stage = source ? tx.supplierStage : tx.buyerStage;
    const place = source ? tx.supplierFacility : tx.buyerFacility;
    return entityTitle(entityId, fallback, { stage, includePlace: true, place });
  }

  function relationTitle(tx, relationKind = "") {
    const sourceLabel = relationPrimaryLabel(tx, "supplier");
    const targetLabel = relationPrimaryLabel(tx, "buyer");
    if (sourceLabel !== targetLabel) return `${sourceLabel} \u2192 ${targetLabel}`;
    const kindPrefix = relationKind === "internal" ? "\u5185\u90e8\u6d41\u8f6c | " : "";
    return `${kindPrefix}${sourceLabel} [${displayStage(tx.supplierStage)}] \u2192 ${sourceLabel} [${displayStage(tx.buyerStage)}]`;
  }

  function relationMeta(tx, relationKind = "") {
    const kindText = relationKind === "internal"
      ? "\u5185\u90e8\u9636\u6bb5\u6d41\u8f6c"
      : relationKind === "upstream"
        ? "\u5916\u90e8\u4e0a\u6e38"
        : relationKind === "downstream"
          ? "\u5916\u90e8\u4e0b\u6e38"
          : relationKind === "chain"
            ? "\u94fe\u8def\u5ef6\u4f38"
          : "\u5173\u952e\u5173\u7cfb";
    return `${kindText} | ${displayStage(tx.supplierStage)} \u2192 ${displayStage(tx.buyerStage)} | ${transactionCommodity(tx)} | ${formatDate(tx)}`;
  }

  function stageRank(stage) {
    const index = stageOrder.indexOf(stage);
    return index >= 0 ? index : stageOrder.length + 1;
  }

  function entityStageLabel(entityId, fallback, stage) {
    return entityTitle(entityId, fallback, { stage });
  }

  function buildHierarchyGroups(entity, list, direction) {
    const groups = new Map();
    const scope = graphSeedEntityIds(entity.id);
    const selectedLabel = entityTitle(entity.id, entity.name);
    list.forEach((tx) => {
      const role = txScopeRole(tx, scope);
      let include = false;
      let stage = "";
      let counterpartId = "";
      let counterpartName = "";
      let counterpartCountry = "";
      let route = "";

      if (direction === "upstream" && role.upstreamExternal) {
        include = true;
        stage = tx.supplierStage;
        counterpartId = tx.supplierFacilityId || tx.supplierCompanyId || "";
        counterpartName = entityTitle(counterpartId, tx.supplierCompany || tx.supplierFacility, { stage: tx.supplierStage });
        counterpartCountry = tx.supplierCountry;
        route = `${displayStage(tx.supplierStage)} 閳?${displayStage(tx.buyerStage)}`;
      }

      if (direction === "downstream" && role.downstreamExternal) {
        include = true;
        stage = tx.buyerStage;
        counterpartId = tx.buyerFacilityId || tx.buyerCompanyId || "";
        counterpartName = entityTitle(counterpartId, tx.buyerCompany || tx.buyerFacility, { stage: tx.buyerStage });
        counterpartCountry = tx.buyerCountry;
        route = `${displayStage(tx.supplierStage)} 閳?${displayStage(tx.buyerStage)}`;
      }

      if (!include) return;
      if (counterpartName === selectedLabel) {
        counterpartName = `${counterpartName} [${displayStage(stage)}]`;
      }
      if (!groups.has(stage)) groups.set(stage, new Map());
      const bucket = groups.get(stage);
      const key = counterpartId || counterpartName;
      if (!bucket.has(key)) bucket.set(key, { id: counterpartId, name: counterpartName, country: counterpartCountry, route, count: 0, txId: tx.id });
      bucket.get(key).count += 1;
    });
    return groups;
  }

  function hierarchyColumnHtml(title, groups) {
    const html = [...groups.entries()]
      .sort((a, b) => stageOrder.indexOf(a[0]) - stageOrder.indexOf(b[0]))
      .map(([stage, items]) => `
        <div>
          <div class="hierarchy-group-title">${esc(displayStage(stage))}</div>
          ${[...items.values()].sort((a, b) => b.count - a.count).slice(0, 8).map((item) => `
            <button class="hierarchy-item" type="button" data-entity="${esc(item.id || "")}" data-tx="${esc(item.txId)}">
              <div class="hierarchy-title">${esc(item.name)}</div>
              <div class="hierarchy-meta">${esc(displayCountry(item.country || ""))} | ${fmt.format(item.count)} 条关系 | ${esc(item.route)}</div>
            </button>
          `).join("")}
        </div>
      `).join("");

    return `
      <div class="hierarchy-column">
        <h3>${esc(title)}</h3>
        ${html || `<div class="empty-state">当前没有可展示的${esc(title)}节点。</div>`}
      </div>
    `;
  }

  function renderHierarchy(context) {
    const body = byId("hierarchyBody");
    if (!context.entity) {
      body.innerHTML = "<div class='empty-state'>请先点击一个节点或在左侧搜索主体，再查看该主体的上下游分层。</div>";
      return;
    }
    const upstream = buildHierarchyGroups(context.entity, context.chainFocus, "upstream");
    const downstream = buildHierarchyGroups(context.entity, context.chainFocus, "downstream");
    body.innerHTML = `
      <div class="hierarchy-columns">
        ${hierarchyColumnHtml("上游", upstream)}
        ${hierarchyColumnHtml("下游", downstream)}
      </div>
    `;
  }

  function renderRelations(context) {
    const host = byId("relationList");
    if (!context.entity) {
      const list = context.focus
        .slice()
        .sort((a, b) =>
          stageRank(a.supplierStage) - stageRank(b.supplierStage) ||
          stageRank(a.buyerStage) - stageRank(b.buyerStage) ||
          Number(b.id === state.selectedTxId) - Number(a.id === state.selectedTxId) ||
          (b.sourceCount || 0) - (a.sourceCount || 0)
        )
        .slice(0, 18);

      host.innerHTML = list.length
        ? list.map((tx) => `
          <button class="relation-item" type="button" data-tx="${esc(tx.id)}">
            <div class="relation-title">${esc(relationTitle(tx))}</div>
            <div class="relation-meta">${esc(relationMeta(tx))}</div>
          </button>
        `).join("")
        : "<div class='empty-state'>\u5f53\u524d\u6ca1\u6709\u53ef\u663e\u793a\u7684\u5173\u7cfb\u3002</div>";
      return;
    }

    const scope = graphSeedEntityIds(context.entity.id);
    const list = context.chainFocus
      .map((tx) => ({ tx, role: txScopeRole(tx, scope) }))
      .sort((a, b) => {
        return stageRank(a.tx.supplierStage) - stageRank(b.tx.supplierStage) ||
          stageRank(a.tx.buyerStage) - stageRank(b.tx.buyerStage) ||
          Number(b.role.upstreamExternal || b.role.downstreamExternal || b.role.internal) - Number(a.role.upstreamExternal || a.role.downstreamExternal || a.role.internal) ||
          Number(a.role.internal) - Number(b.role.internal) ||
          Number(b.tx.id === state.selectedTxId) - Number(a.tx.id === state.selectedTxId) ||
          (b.tx.sourceCount || 0) - (a.tx.sourceCount || 0);
      });

    host.innerHTML = list.length
      ? list.map(({ tx, role }) => {
        const kind = role.internal
          ? "internal"
          : role.upstreamExternal
            ? "upstream"
            : role.downstreamExternal
              ? "downstream"
              : "chain";
        return `
          <button class="relation-item" type="button" data-tx="${esc(tx.id)}">
            <div class="relation-title">${esc(relationTitle(tx, kind))}</div>
            <div class="relation-meta">${esc(relationMeta(tx, kind))}</div>
          </button>
        `;
      }).join("")
      : "<div class='empty-state'>\u5f53\u524d\u4e3b\u4f53\u6ca1\u6709\u53ef\u5355\u72ec\u663e\u793a\u7684\u5916\u90e8\u4e0a\u4e0b\u6e38\u5173\u7cfb\u3002</div>";
  }

  function buildRegionModel(context) {
    const list = context.entity ? context.chainFocus : context.focus;
    const pointMap = new Map();
    const links = [];
    list.forEach((tx) => {
      const source = sideNodeFromTx(tx, "source");
      const target = sideNodeFromTx(tx, "target");
      if (isNum(source.lat) && isNum(source.lon)) {
        if (!pointMap.has(source.key)) pointMap.set(source.key, {
          ...source,
          weight: 0,
          label: entityStageLabel(source.entityId, source.name, source.stage),
          selected: matchesEntitySelection(source, state.selectedEntityId)
        });
        pointMap.get(source.key).weight += 1;
      }
      if (isNum(target.lat) && isNum(target.lon)) {
        if (!pointMap.has(target.key)) pointMap.set(target.key, {
          ...target,
          weight: 0,
          label: entityStageLabel(target.entityId, target.name, target.stage),
          selected: matchesEntitySelection(target, state.selectedEntityId)
        });
        pointMap.get(target.key).weight += 1;
      }
      if (isNum(source.lat) && isNum(source.lon) && isNum(target.lat) && isNum(target.lon)) {
        links.push({
          id: tx.id,
          source: { ...source, label: entityStageLabel(source.entityId, source.name, source.stage) },
          target: { ...target, label: entityStageLabel(target.entityId, target.name, target.stage) },
          tx
        });
      }
    });
    return { points: [...pointMap.values()], links };
  }

  function boundsFromPoints(points) {
    const lats = points.map((point) => point.lat);
    const lons = points.map((point) => point.lon);
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLon = Math.min(...lons);
    let maxLon = Math.max(...lons);
    const latPad = Math.max(2, (maxLat - minLat) * 0.15);
    const lonPad = Math.max(3, (maxLon - minLon) * 0.15);
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

  function projectRegionPoint(point, bounds, width, height, paddingX = 68, paddingY = 52) {
    const lonSpan = Math.max(1, bounds.maxLon - bounds.minLon);
    const latSpan = Math.max(1, bounds.maxLat - bounds.minLat);
    return {
      x: paddingX + ((point.lon - bounds.minLon) / lonSpan) * (width - paddingX * 2),
      y: height - paddingY - ((point.lat - bounds.minLat) / latSpan) * (height - paddingY * 2)
    };
  }

  function renderRegion(context) {
    const model = buildRegionModel(context);
    const svg = byId("regionSvg");
    const listHost = byId("regionList");
    const statsHost = byId("regionStats");
    const hoverKey = state.regionHoverKey;
    const width = 1180;
    const height = 620;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    if (!model.points.length) {
      byId("regionCaption").textContent = "当前焦点下没有可投影到区域映射中的落点。";
      listHost.innerHTML = "<div class='empty-state'>当前没有可显示的区域映射节点。</div>";
      statsHost.innerHTML = "";
      svg.innerHTML = `<foreignObject x="20" y="20" width="${width - 40}" height="${height - 40}"><div xmlns="http://www.w3.org/1999/xhtml" class="empty-state">请先点击一个节点或搜索主体，再查看对应链条的区域映射。</div></foreignObject>`;
      return;
    }

    const bounds = boundsFromPoints(model.points);
    const projected = new Map(model.points.map((point) => [point.key, projectRegionPoint(point, bounds, width, height)]));
    const countries = new Set(model.points.map((point) => displayCountry(point.country)).filter(Boolean));
    const stages = new Set(model.points.map((point) => point.stage).filter(Boolean));
    byId("regionMeta").textContent = context.entity
      ? `${entityTitle(context.entity.id, context.entity.name)} 的空间投影`
      : "当前焦点下的区域映射";
    byId("regionCaption").textContent = `纬度 ${bounds.minLat.toFixed(1)}° 至 ${bounds.maxLat.toFixed(1)}°，经度 ${bounds.minLon.toFixed(1)}° 至 ${bounds.maxLon.toFixed(1)}°。`;
    statsHost.innerHTML = [
      `落点 ${fmt.format(model.points.length)}`,
      `关系 ${fmt.format(model.links.length)}`,
      `国家 ${fmt.format(countries.size)}`,
      `环节 ${fmt.format(stages.size)}`
    ].map((item) => `<span class="chip">${esc(item)}</span>`).join("");

    const gridLines = [];
    for (let i = 0; i <= 4; i += 1) {
      const x = 68 + (i / 4) * (width - 136);
      const y = 52 + (i / 4) * (height - 104);
      gridLines.push(`<line class="region-grid-line" x1="${x}" y1="52" x2="${x}" y2="${height - 52}" />`);
      gridLines.push(`<line class="region-grid-line" x1="68" y1="${y}" x2="${width - 68}" y2="${y}" />`);
    }

    const linkHtml = model.links.map((link) => {
      const source = projected.get(link.source.key);
      const target = projected.get(link.target.key);
      if (!source || !target) return "";
      const isHover = hoverKey && (hoverKey === link.source.key || hoverKey === link.target.key);
      const isDim = hoverKey && !isHover;
      return `
        <path
          class="region-link${isHover ? " is-hover" : ""}"
          data-region-key="${esc(link.source.key)}"
          data-target-region-key="${esc(link.target.key)}"
          d="M ${source.x} ${source.y} C ${(source.x + target.x) / 2} ${source.y}, ${(source.x + target.x) / 2} ${target.y}, ${target.x} ${target.y}"
          stroke="${stageColor(link.source.stage)}"
          stroke-opacity="${isDim ? "0.08" : (isHover ? "0.92" : "0.34")}"
          stroke-width="${isHover ? "3" : "1.8"}"
        >
          <title>${esc(link.source.label)} ? ${esc(link.target.label)}</title>
        </path>
      `;
    }).join("");

    const pointHtml = model.points.map((point) => {
      const p = projected.get(point.key);
      const isHover = hoverKey === point.key;
      const isDim = hoverKey && !isHover;
      const radius = point.selected ? 8.5 : clamp(4 + point.weight * 0.3, 4.5, 7.6);
      return `
        <g class="region-point${isHover ? " is-hover" : ""}" data-entity="${esc(point.entityId || "")}" data-region-key="${esc(point.key)}" opacity="${isDim ? "0.26" : "1"}">
          <circle cx="${p.x}" cy="${p.y}" r="${radius + (isHover ? 7 : 4)}" fill="${withAlpha(stageColor(point.stage), isHover ? "28" : "1f")}"></circle>
          <circle cx="${p.x}" cy="${p.y}" r="${radius + (isHover ? 1 : 0)}" fill="${stageColor(point.stage)}" stroke="#ffffff" stroke-width="${isHover ? "2.2" : "1.4"}"></circle>
          <title>${esc(point.label)} | ${esc(displayStage(point.stage))} | ${esc(displayCountry(point.country || ""))}</title>
        </g>
      `;
    }).join("");

    svg.innerHTML = `
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(248, 250, 251, 0.96)"></rect>
      ${gridLines.join("")}
      ${linkHtml}
      ${pointHtml}
    `;

    listHost.innerHTML = model.points
      .slice()
      .sort((a, b) => Number(matchesEntitySelection(b, state.selectedEntityId)) - Number(matchesEntitySelection(a, state.selectedEntityId)) || stageRank(a.stage) - stageRank(b.stage) || b.weight - a.weight)
      .map((point) => `
        <button class="region-item${hoverKey === point.key ? " is-hover" : ""}" type="button" data-entity="${esc(point.entityId || "")}" data-region-key="${esc(point.key)}">
          <div class="region-item-title">
            <span class="node-dot" style="--dot:${stageColor(point.stage)}"></span>
            ${esc(point.label)}
          </div>
          <div class="region-item-meta">${esc(displayStage(point.stage))} | ${esc(displayCountry(point.country || ""))}</div>
          <div class="region-item-meta">${esc(safeText(point.place, "未标注地点"))}</div>
        </button>
      `).join("");
  }

  function setRegionHover(key = "") {
    const next = key || "";
    if (state.regionHoverKey === next) return;
    state.regionHoverKey = next;
    renderRegion(computeContext());
  }

  function buildEvidenceProfile(entity, related) {
    const sourcesCount = new Set(related.flatMap((tx) => tx.sourceIds)).size;
    const commodities = new Set(related.flatMap((tx) => [...tx.inputCommodities, ...tx.outputCommodities]));
    const countries = new Set();
    related.forEach((tx) => {
      if (tx.supplierCountry) countries.add(displayCountry(tx.supplierCountry));
      if (tx.buyerCountry) countries.add(displayCountry(tx.buyerCountry));
    });
    return `
      <div class="evidence-profile-title">${esc(entityTitle(entity.id, entity.name))}</div>
      <div class="evidence-profile-sub">${esc(entitySubtitle(entity))}</div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-key">相关记录</div><div class="stat-value">${fmt.format(related.length)}</div></div>
        <div class="stat-card"><div class="stat-key">来源文档</div><div class="stat-value">${fmt.format(sourcesCount)}</div></div>
        <div class="stat-card"><div class="stat-key">覆盖国家</div><div class="stat-value">${fmt.format(countries.size)}</div></div>
        <div class="stat-card"><div class="stat-key">涉及商品</div><div class="stat-value">${fmt.format(commodities.size)}</div></div>
      </div>
    `;
  }

  function groupedEvidenceTransactions(list, direction) {
    const grouped = new Map();
    list.forEach((tx) => {
      const counterpartId = direction === "upstream"
        ? (tx.supplierFacilityId || tx.supplierCompanyId)
        : (tx.buyerFacilityId || tx.buyerCompanyId);
      const key = counterpartId || tx.id;
      if (!grouped.has(key)) grouped.set(key, { ...tx, groupedCount: 0, groupedSourceIds: new Set(tx.sourceIds) });
      const entry = grouped.get(key);
      entry.groupedCount += 1;
      tx.sourceIds.forEach((id) => entry.groupedSourceIds.add(id));
    });
    return [...grouped.values()].sort((a, b) => b.groupedCount - a.groupedCount);
  }

  function evidenceCardHtml(tx, direction) {
    const upstream = direction === "upstream";
    const counterpartId = upstream ? (tx.supplierFacilityId || tx.supplierCompanyId) : (tx.buyerFacilityId || tx.buyerCompanyId);
    const counterpartStage = upstream ? tx.supplierStage : tx.buyerStage;
    const counterpartName = upstream
      ? entityTitle(counterpartId, tx.supplierCompany || tx.supplierFacility, { stage: counterpartStage })
      : entityTitle(counterpartId, tx.buyerCompany || tx.buyerFacility, { stage: counterpartStage });
    const commoditySummary = transactionCommodity(tx);
    const sourceLinks = [...(tx.groupedSourceIds || new Set(tx.sourceIds))].map((id) => sources.get(id)).filter(Boolean);
    return `
      <article class="evidence-card">
        <div class="evidence-title">${esc(counterpartName)}</div>
        <div class="subline">${esc(displayStage(tx.supplierStage))} → ${esc(displayStage(tx.buyerStage))}</div>
        <dl>
          <dt>产品</dt><dd>${esc(commoditySummary)}</dd>
          <dt>时间</dt><dd>${esc(formatDate(tx))}</dd>
          <dt>规模</dt><dd>${esc(formatAmount(tx))}</dd>
          <dt>来源</dt><dd>${sourceLinks.length ? sourceLinks.slice(0, 3).map((source) => `<a class="source-link" href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.host || "来源链接")}</a>`).join(" / ") : "未附来源"}</dd>
        </dl>
        ${tx.notes.length ? `<div class="evidence-note">${esc(tx.notes.join("；"))}</div>` : ""}
      </article>
    `;
  }

  function renderEvidence(context) {
    const btn = byId("openEvidenceBtn");
    if (!context.entity) {
      btn.disabled = true;
      byId("evidenceMeta").textContent = "\u8bf7\u5148\u9501\u5b9a\u4e00\u4e2a\u4e3b\u4f53";
      byId("evidenceProfile").innerHTML = "<div class='empty-state'>\u70b9\u51fb\u8282\u70b9\u6216\u641c\u7d22\u4e3b\u4f53\u540e\uff0c\u8fd9\u91cc\u4f1a\u663e\u793a\u5b83\u7684\u4e0a\u4e0b\u6e38\u8bc1\u636e\u94fe\u6761\u3002</div>";
      byId("evidenceUpstream").innerHTML = "";
      byId("evidenceDownstream").innerHTML = "";
      byId("evidenceUpstreamMeta").textContent = "";
      byId("evidenceDownstreamMeta").textContent = "";
      return;
    }

    btn.disabled = false;
    const scope = graphSeedEntityIds(context.entity.id);
    const related = entityFocusedTransactions(context.base, context.entity.id);
    const upstream = groupedEvidenceTransactions(related.filter((tx) => txScopeRole(tx, scope).upstreamExternal), "upstream");
    const downstream = groupedEvidenceTransactions(related.filter((tx) => txScopeRole(tx, scope).downstreamExternal), "downstream");
    const internalCount = related.filter((tx) => txScopeRole(tx, scope).internal).length;

    byId("evidenceMeta").textContent = `\u56f4\u7ed5 ${entityTitle(context.entity.id, context.entity.name)} \u5c55\u5f00\u7684\u4e0a\u4e0b\u6e38\u8bc1\u636e`;
    byId("evidenceProfile").innerHTML = `${buildEvidenceProfile(context.entity, related)}
      ${internalCount ? `<div class="helper-text" style="margin-top:12px;">\u53e6\u5916\u8bc6\u522b\u5230 ${fmt.format(internalCount)} \u6761\u5185\u90e8\u9636\u6bb5\u6d41\u8f6c\u8bb0\u5f55\uff0c\u5b83\u4eec\u4e0d\u4f1a\u88ab\u5f53\u6210\u5916\u90e8\u4e0a\u6e38\u6216\u4e0b\u6e38\u4e3b\u4f53\u3002</div>` : ""}
    `;
    byId("evidenceUpstreamMeta").textContent = `${fmt.format(upstream.length)} \u4e2a\u6765\u6e90\u4e3b\u4f53`;
    byId("evidenceDownstreamMeta").textContent = `${fmt.format(downstream.length)} \u4e2a\u53bb\u5411\u4e3b\u4f53`;
    byId("evidenceUpstream").innerHTML = upstream.length ? upstream.map((tx) => evidenceCardHtml(tx, "upstream")).join("") : "<div class='empty-state'>\u5f53\u524d\u4e3b\u4f53\u6ca1\u6709\u8bc6\u522b\u5230\u4e0a\u6e38\u6765\u6e90\u8bb0\u5f55\u3002</div>";
    byId("evidenceDownstream").innerHTML = downstream.length ? downstream.map((tx) => evidenceCardHtml(tx, "downstream")).join("") : "<div class='empty-state'>\u5f53\u524d\u4e3b\u4f53\u6ca1\u6709\u8bc6\u522b\u5230\u4e0b\u6e38\u53bb\u5411\u8bb0\u5f55\u3002</div>";
  }

  function buildChain3DModel(context) {
    const list = context.entity ? context.chainFocus : context.focus;
    const nodeMap = new Map();
    const edgeMap = new Map();

    list.forEach((tx) => {
      const source = sideNodeFromTx(tx, "source");
      const target = sideNodeFromTx(tx, "target");
      const sourceKey = `${source.entityId || source.key}::${source.stage}`;
      const targetKey = `${target.entityId || target.key}::${target.stage}`;

      if (!nodeMap.has(sourceKey)) {
        nodeMap.set(sourceKey, {
          key: sourceKey,
          entityId: source.entityId,
          stage: source.stage,
          country: source.country,
          place: source.place,
          label: entityStageLabel(source.entityId, source.name, source.stage),
          baseLabel: entityTitle(source.entityId, source.name),
          weight: 0,
          selected: matchesEntitySelection(source, state.selectedEntityId)
        });
      }
      if (!nodeMap.has(targetKey)) {
        nodeMap.set(targetKey, {
          key: targetKey,
          entityId: target.entityId,
          stage: target.stage,
          country: target.country,
          place: target.place,
          label: entityStageLabel(target.entityId, target.name, target.stage),
          baseLabel: entityTitle(target.entityId, target.name),
          weight: 0,
          selected: matchesEntitySelection(target, state.selectedEntityId)
        });
      }

      nodeMap.get(sourceKey).weight += 1;
      nodeMap.get(targetKey).weight += 1;

      const edgeKey = `${sourceKey}=>${targetKey}`;
      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, {
          key: edgeKey,
          sourceKey,
          targetKey,
          sourceStage: tx.supplierStage,
          targetStage: tx.buyerStage,
          sampleTxId: tx.id,
          count: 0
        });
      }
      edgeMap.get(edgeKey).count += 1;
    });

    const stages = stageOrder.filter((stage) => [...nodeMap.values()].some((node) => node.stage === stage));
    const stageGap = 176;
    const yGap = 110;
    const zGap = 126;
    const nodes = [...nodeMap.values()];

    stages.forEach((stage, stageIndex) => {
      const bucket = nodes
        .filter((node) => node.stage === stage)
        .sort((a, b) => Number(b.selected) - Number(a.selected) || b.weight - a.weight || a.label.localeCompare(b.label, "en"));
      const cols = Math.max(1, Math.ceil(Math.sqrt(bucket.length)));
      const rows = Math.max(1, Math.ceil(bucket.length / cols));
      const x = (stageIndex - (stages.length - 1) / 2) * stageGap;
      bucket.forEach((node, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        node.x = x;
        node.y = (row - (rows - 1) / 2) * yGap;
        node.z = (col - (cols - 1) / 2) * zGap + ((row % 2) ? 22 : -22);
        node.radius = clamp(9 + Math.sqrt(node.weight) * 3.6 + (node.selected ? 6 : 0), 9, 26);
      });
    });

    const edges = [...edgeMap.values()].map((edge) => ({
      ...edge,
      source: nodeMap.get(edge.sourceKey),
      target: nodeMap.get(edge.targetKey)
    })).filter((edge) => edge.source && edge.target);

    return { nodes, edges, stages };
  }

  function rotate3D(point, yaw, pitch) {
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    const x1 = point.x * cosY - point.z * sinY;
    const z1 = point.x * sinY + point.z * cosY;
    const y1 = point.y * cosP - z1 * sinP;
    const z2 = point.y * sinP + z1 * cosP;
    return { x: x1, y: y1, z: z2 };
  }

  function project3D(point, width, height, viewport = {}) {
    const rotated = rotate3D(point, state.chain3d.yaw, state.chain3d.pitch);
    const camera = 1080;
    const zoom = 1.22 * state.chain3d.zoom;
    const depth = camera + rotated.z;
    const scale = zoom * camera / Math.max(240, depth);
    const centerX = Number.isFinite(viewport.centerX) ? viewport.centerX : width / 2;
    const centerY = Number.isFinite(viewport.centerY) ? viewport.centerY : height / 2;
    return {
      x: centerX + rotated.x * scale,
      y: centerY + rotated.y * scale,
      depth,
      scale
    };
  }

  function drawArrow(ctx, x1, y1, x2, y2, color, size = 8) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - Math.cos(angle - Math.PI / 7) * size, y2 - Math.sin(angle - Math.PI / 7) * size);
    ctx.lineTo(x2 - Math.cos(angle + Math.PI / 7) * size, y2 - Math.sin(angle + Math.PI / 7) * size);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function renderChain3D(context) {
    if (!chain3dCanvas) return;
    const rect = chain3dCanvas.getBoundingClientRect();
    const width = Math.max(960, Math.round(rect.width || chain3dCanvas.clientWidth || 960));
    const height = Math.max(920, Math.round(rect.height || chain3dCanvas.clientHeight || 920));
    const dpr = window.devicePixelRatio || 1;
    if (chain3dCanvas.width !== Math.round(width * dpr) || chain3dCanvas.height !== Math.round(height * dpr)) {
      chain3dCanvas.width = Math.round(width * dpr);
      chain3dCanvas.height = Math.round(height * dpr);
    }
    const ctx = chain3dCanvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const scene = buildChain3DModel(context);
    chain3dScene = { ...scene, projected: [] };
    byId("chain3dMeta").textContent = context.entity
      ? `${entityTitle(context.entity.id, context.entity.name)} \u7684\u4e09\u7ef4\u77e5\u8bc6\u56fe\u8c31`
      : "\u5b8c\u6574\u94b4\u4f9b\u5e94\u94fe\u4e09\u7ef4\u77e5\u8bc6\u56fe\u8c31";
    byId("chain3dStatus").textContent = context.entity
      ? `\u5f53\u524d\u663e\u793a\uff1a${entityTitle(context.entity.id, context.entity.name)} \u7684\u5b8c\u6574\u4e0a\u4e0b\u6e38\u94fe`
      : "\u5f53\u524d\u663e\u793a\uff1a\u5b8c\u6574\u5168\u7403\u94b4\u4f9b\u5e94\u94fe";
    byId("chain3dHint").textContent = context.entity
      ? "\u62d6\u52a8\u4e09\u7ef4\u56fe\u8c31\u53ef\u65cb\u8f6c\uff0c\u6eda\u8f6e\u53ef\u7f29\u653e\uff1b\u5f53\u524d\u5df2\u8fc7\u6ee4\u5230\u6240\u9009\u4e3b\u4f53\u7684\u5b8c\u6574\u4e0a\u4e0b\u6e38\u94fe\u3002"
      : "\u62d6\u52a8\u4e09\u7ef4\u56fe\u8c31\u53ef\u65cb\u8f6c\uff0c\u6eda\u8f6e\u53ef\u7f29\u653e\uff1b\u70b9\u51fb\u8282\u70b9\u540e\u4f1a\u5207\u6362\u4e3a\u8be5\u4e3b\u4f53\u7684\u5b8c\u6574\u4e0a\u4e0b\u6e38\u94fe\u3002";
    syncChain3DBackButton();
    if (chain3dLegend) {
      chain3dLegend.innerHTML = scene.stages.map((stage) => `
        <span class="chain3d-legend-pill">
          <span class="chain3d-legend-dot" style="--dot:${stageColor(stage)}"></span>
          ${esc(displayStage(stage))}
        </span>
      `).join("");
    }
    ctx.fillStyle = "rgba(252, 251, 247, 0.96)";
    ctx.fillRect(0, 0, width, height);
    ctx.textBaseline = "middle";
    const guideTop = 28;
    const plotBottom = height - 108;
    const plotCenterY = (guideTop + plotBottom) / 2;
    const stageMarks = scene.stages.map((stage, index) => {
      const x = ((index + 0.5) / Math.max(1, scene.stages.length)) * width;
      return { stage, x };
    });
    stageMarks.forEach((mark) => {
      ctx.strokeStyle = "rgba(16, 34, 49, 0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mark.x, guideTop);
      ctx.lineTo(mark.x, plotBottom);
      ctx.stroke();
    });
    const projectedNodes = scene.nodes.map((node) => {
      const projected = project3D(node, width, height, { centerY: plotCenterY });
      const radius = node.radius * projected.scale * 0.34;
      return { ...node, sx: projected.x, sy: projected.y, depth: projected.depth, sr: clamp(radius, 4, 26) };
    });
    chain3dScene.projected = projectedNodes;
    const projectedLookup = new Map(projectedNodes.map((node) => [node.key, node]));
    const projectedEdges = scene.edges
      .map((edge) => ({ ...edge, sourceNode: projectedLookup.get(edge.sourceKey), targetNode: projectedLookup.get(edge.targetKey) }))
      .filter((edge) => edge.sourceNode && edge.targetNode)
      .sort((a, b) => (b.sourceNode.depth + b.targetNode.depth) - (a.sourceNode.depth + a.targetNode.depth));
    projectedEdges.forEach((edge) => {
      const source = edge.sourceNode;
      const target = edge.targetNode;
      const mx = (source.sx + target.sx) / 2;
      const my = (source.sy + target.sy) / 2 - clamp(Math.abs(target.sx - source.sx) * 0.08, 10, 34);
      const alpha = edge.sampleTxId === state.selectedTxId ? 0.82 : clamp(0.22 + edge.count * 0.06, 0.22, 0.56);
      ctx.beginPath();
      ctx.moveTo(source.sx, source.sy);
      ctx.quadraticCurveTo(mx, my, target.sx, target.sy);
      ctx.strokeStyle = withAlpha(stageColor(edge.sourceStage), Math.round(alpha * 255).toString(16).padStart(2, "0"));
      ctx.lineWidth = edge.sampleTxId === state.selectedTxId ? 2.8 : clamp(1 + edge.count * 0.3, 1, 2.4);
      ctx.stroke();
      drawArrow(ctx, mx, my, target.sx, target.sy, stageColor(edge.targetStage), edge.sampleTxId === state.selectedTxId ? 10 : 7);
    });
    projectedNodes
      .slice()
      .sort((a, b) => b.depth - a.depth)
      .forEach((node, index) => {
        const isHover = node.key === state.chain3d.hoverKey;
        ctx.beginPath();
        ctx.arc(node.sx, node.sy, node.sr * 2.1, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(stageColor(node.stage), isHover || node.selected ? "1f" : "12");
        ctx.fill();
        ctx.beginPath();
        ctx.arc(node.sx, node.sy, node.sr, 0, Math.PI * 2);
        ctx.fillStyle = stageColor(node.stage);
        ctx.fill();
        ctx.lineWidth = node.selected ? 3 : (isHover ? 2.4 : 1.2);
        ctx.strokeStyle = node.selected ? "#d83c3c" : (isHover ? "#ffffff" : "rgba(255,255,255,0.86)");
        ctx.stroke();
        if (node.selected || isHover || index < 18) {
          const label = node.selected ? node.label : shortText(node.label, context.entity ? 24 : 20);
          ctx.font = `${node.selected ? 700 : 600} ${node.selected ? 15 : 12}px 'Segoe UI', 'Microsoft YaHei', sans-serif`;
          const tw = ctx.measureText(label).width;
          const lx = clamp(node.sx - tw / 2 - 10, 12, width - tw - 20);
          const ly = clamp(node.sy + node.sr + 12, guideTop + 8, height - 42);
          ctx.fillStyle = node.selected ? "rgba(255, 245, 245, 0.96)" : "rgba(255, 255, 255, 0.92)";
          ctx.strokeStyle = node.selected ? "rgba(216, 60, 60, 0.28)" : "rgba(16, 34, 49, 0.08)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(lx, ly, tw + 20, node.selected ? 30 : 26, 13);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = node.selected ? "#b32222" : "#112738";
          ctx.textAlign = "left";
          ctx.fillText(label, lx + 10, ly + (node.selected ? 20 : 17));
        }
      });
  }  function setPointOfView(view, duration = 1000) {
    if (!globe || !view) return;
    state.suppressViewSync = true;
    state.view = { lat: view.lat, lng: normalizeLon(view.lng), altitude: view.altitude };
    globe.pointOfView(state.view, duration);
    window.clearTimeout(viewSyncTimer);
    viewSyncTimer = window.setTimeout(() => {
      state.suppressViewSync = false;
    }, duration + 120);
  }

  function syncViewFromGlobe() {
    if (!globe || state.suppressViewSync) return;
    const view = globe.pointOfView();
    if (!view) return;
    state.view = {
      lat: Number(view.lat || 0),
      lng: normalizeLon(Number(view.lng || 0)),
      altitude: Number(view.altitude || 2.35)
    };
  }

  function ensureGlobe() {
    if (globe) return globe;
    if (typeof window.Globe !== "function") return null;

    globe = new window.Globe(globeHost, {
      rendererConfig: { antialias: true, alpha: true, powerPreference: "high-performance" }
    })
      .width(globeHost.clientWidth || 960)
      .height(globeHost.clientHeight || 740)
      .backgroundColor("rgba(0,0,0,0)")
      .globeImageUrl("assets/earth_github_4096.jpg")
      .bumpImageUrl("assets/earth_topology.png")
      .showAtmosphere(true)
      .atmosphereColor("#7fc4ff")
      .atmosphereAltitude(0.18)
      .globeCurvatureResolution(4)
      .pointAltitude((point) => point.selected ? 0.07 : clamp(0.022 + point.weight * 0.003, 0.024, 0.055))
      .pointRadius((point) => point.selected ? 0.22 : clamp(0.09 + point.weight * 0.012, 0.1, 0.18))
      .arcAltitudeAutoScale(0.26)
      .arcStroke((arc) => arc.count >= 2 ? 0.42 : 0.22)
      .arcDashLength(0.24)
      .arcDashGap(1)
      .arcDashInitialGap("dashOffset")
      .arcDashAnimateTime(2200)
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
        <div><strong>${esc(entityTitle(point.entityId, point.name, { stage: point.stage }))}</strong></div>
        <div>${esc(displayStage(point.stage))} | ${esc(displayCountry(point.country || ""))}</div>
        <div>${fmt.format(point.weight)} 条关联关系</div>
        <div>坐标来源：${esc(displayPointOrigin(point.pointOrigin))}</div>
        <div>${esc(safeText(point.place, "未标注地点"))}</div>
      ` : ""))
      .onPointClick((point) => {
        if (!point || !point.entityId) return;
        selectEntity(point.entityId);
      })
      .onArcHover((arc) => openTooltip(arc ? `
        <div><strong>${esc(arc.sampleTitle)}</strong></div>
        <div>${esc(arc.relation)}</div>
        <div>${fmt.format(arc.count)} 条关系</div>
      ` : ""))
      .onArcClick((arc) => {
        if (!arc || !arc.sampleTxId) return;
        selectTransaction(arc.sampleTxId);
      });

    if (typeof globe.arcDirectionalParticles === "function") {
      globe
        .arcDirectionalParticles((arc) => arc.count >= 2 ? 3 : 2)
        .arcDirectionalParticleSpeed(0.004)
        .arcDirectionalParticleWidth((arc) => arc.count >= 2 ? 2.6 : 1.8)
        .arcDirectionalParticleColor((arc) => arc.sourceColor);
    }

    const controls = globe.controls ? globe.controls() : null;
    if (controls) {
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.autoRotate = state.autoRotate;
      controls.autoRotateSpeed = 0.42;
      controls.minDistance = 140;
      controls.maxDistance = 920;
      controls.rotateSpeed = 0.78;
      controls.zoomSpeed = 0.86;
      controls.addEventListener?.("change", () => {
        syncViewFromGlobe();
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

    window.addEventListener("resize", () => {
      if (!globe) return;
      globe.width(globeHost.clientWidth || 960).height(globeHost.clientHeight || 740);
    });

    globe.pointOfView(state.view, 0);
    return globe;
  }

  function renderGlobe(context, options = {}) {
    const { recenter = true } = options;
    const g = ensureGlobe();
    if (!g) return;
    const data = buildGlobeData(context);
    g.pointsData(data.points)
      .pointLat("lat")
      .pointLng("lng")
      .pointColor((point) => stageColor(point.stage))
      .arcsData(data.arcs)
      .arcStartLat("startLat")
      .arcStartLng("startLng")
      .arcEndLat("endLat")
      .arcEndLng("endLng")
      .arcColor((arc) => [withAlpha(arc.sourceColor, "ef"), withAlpha(arc.targetColor, "92")])
      .htmlElementsData(data.labels);
    if (recenter) setPointOfView(computeFocusView(context.entity ? context.chainFocus : context.focus), 1000);
    const controls = g.controls ? g.controls() : null;
    if (controls) controls.autoRotate = state.autoRotate && !context.entity;
  }

  function renderStatus(context) {
    const list = context.entity ? context.chainFocus : context.focus;
    byId("queryMeta").textContent = context.entity ? `当前锁定：${entityTitle(context.entity.id, context.entity.name)}` : "全球全链";
    byId("detailMeta").textContent = context.entity
      ? `链路记录 ${fmt.format(context.chainFocus.length)} 条`
      : `当前记录 ${fmt.format(list.length)} 条`;
    byId("globeMeta").textContent = context.entity
      ? `${entityTitle(context.entity.id, context.entity.name)} 的完整上下游链`
      : "完整全球钴供应链主图";
    byId("globeStatus").textContent = currentModeLabel(context);
    byId("globeHint").textContent = currentModeSub(context);
    byId("focusCard").innerHTML = buildFocusCard(context);
  }

  function setRegionVisibility(open) {
    state.regionOpen = open;
    byId("regionBackdrop").classList.toggle("is-hidden", !open);
    byId("regionModal").classList.toggle("is-hidden", !open);
  }

  function setEvidenceVisibility(open) {
    state.evidenceOpen = open;
    byId("evidenceBackdrop").classList.toggle("is-hidden", !open);
    byId("evidenceModal").classList.toggle("is-hidden", !open);
  }

  function nearestChain3DNode(clientX, clientY) {
    if (!chain3dCanvas || !chain3dScene.projected?.length) return null;
    const rect = chain3dCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let winner = null;
    let best = Infinity;
    chain3dScene.projected.forEach((node) => {
      const dx = node.sx - x;
      const dy = node.sy - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const threshold = Math.max(10, node.sr + 8);
      if (distance <= threshold && distance < best) {
        best = distance;
        winner = node;
      }
    });
    return winner;
  }

  function bindChain3DInteractions() {
    if (!chain3dCanvas || chain3dCanvas.dataset.bound === "1") return;
    chain3dCanvas.dataset.bound = "1";
    chain3dCanvas.addEventListener("pointerdown", (event) => {
      state.chain3d.pointerDown = true;
      state.chain3d.dragActive = true;
      state.chain3d.moved = false;
      state.chain3d.lastX = event.clientX;
      state.chain3d.lastY = event.clientY;
      chain3dCanvas.classList.add("is-dragging");
      chain3dCanvas.setPointerCapture?.(event.pointerId);
    });
    chain3dCanvas.addEventListener("pointermove", (event) => {
      state.pointerX = event.clientX + 14;
      state.pointerY = event.clientY + 14;
      if (state.chain3d.pointerDown) {
        const dx = event.clientX - state.chain3d.lastX;
        const dy = event.clientY - state.chain3d.lastY;
        state.chain3d.lastX = event.clientX;
        state.chain3d.lastY = event.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 1) state.chain3d.moved = true;
        state.chain3d.yaw += dx * 0.008;
        state.chain3d.pitch = clamp(state.chain3d.pitch + dy * 0.006, -1.02, 1.02);
        renderChain3D(computeContext());
        return;
      }
      const hover = nearestChain3DNode(event.clientX, event.clientY);
      const hoverKey = hover?.key || "";
      if (hoverKey !== state.chain3d.hoverKey) {
        state.chain3d.hoverKey = hoverKey;
        renderChain3D(computeContext());
      }
      openTooltip(hover ? `
        <div><strong>${esc(hover.label)}</strong></div>
        <div>${esc(displayStage(hover.stage))} | ${esc(displayCountry(hover.country || ""))}</div>
        <div>${fmt.format(hover.weight)} \u6761\u76f8\u5173\u94fe\u8def</div>
        <div>${esc(safeText(hover.place, "\u672a\u6807\u6ce8\u5730\u70b9"))}</div>
      ` : "");
    });
    const finishPointer = () => {
      state.chain3d.pointerDown = false;
      state.chain3d.dragActive = false;
      chain3dCanvas.classList.remove("is-dragging");
    };
    chain3dCanvas.addEventListener("pointerup", (event) => {
      const hover = nearestChain3DNode(event.clientX, event.clientY);
      const shouldSelect = !state.chain3d.moved && hover?.entityId;
      finishPointer();
      if (shouldSelect) selectEntity(hover.entityId);
    });
    chain3dCanvas.addEventListener("pointercancel", finishPointer);
    chain3dCanvas.addEventListener("mouseleave", () => {
      if (!state.chain3d.pointerDown && state.chain3d.hoverKey) {
        state.chain3d.hoverKey = "";
        renderChain3D(computeContext());
      }
      if (!state.chain3d.pointerDown) openTooltip("");
    });
    chain3dCanvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      state.chain3d.zoom = clamp(state.chain3d.zoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.66, 1.9);
      renderChain3D(computeContext());
    }, { passive: false });
    byId("chain3dZoomInBtn")?.addEventListener("click", () => {
      state.chain3d.zoom = clamp(state.chain3d.zoom * 1.12, 0.66, 1.9);
      renderChain3D(computeContext());
    });
    byId("chain3dZoomOutBtn")?.addEventListener("click", () => {
      state.chain3d.zoom = clamp(state.chain3d.zoom * 0.9, 0.66, 1.9);
      renderChain3D(computeContext());
    });
    byId("chain3dResetBtn")?.addEventListener("click", () => {
      state.chain3d.yaw = -0.48;
      state.chain3d.pitch = 0.28;
      state.chain3d.zoom = 1;
      renderChain3D(computeContext());
    });
    byId("chain3dBackBtn")?.addEventListener("click", () => {
      goBackOneLevel();
    });
    window.addEventListener("resize", () => {
      window.cancelAnimationFrame(chain3dFrame);
      chain3dFrame = window.requestAnimationFrame(() => renderChain3D(computeContext()));
    });
  }
  function renderAll(options = {}) {
    const { recenter = true, updateGlobe = true } = options;
    const context = computeContext();
    renderSearchResults();
    renderStatus(context);
    renderSummary(context);
    renderStageStats(context);
    renderHierarchy(context);
    renderRelations(context);
    renderEvidence(context);
    renderRegion(context);
    renderChain3D(context);
    if (updateGlobe) renderGlobe(context, { recenter });
  }
  function selectEntity(entityId, options = {}) {
    const { pushHistory = true } = options;
    const nextEntityId = entityId || "";
    const related = nextEntityId ? entityFocusedTransactions(transactions, nextEntityId) : [];
    const nextSelection = { entityId: nextEntityId, txId: related[0]?.id || "" };
    if (sameSelection(selectionSnapshot(), nextSelection)) return;
    if (pushHistory) pushSelectionHistory();
    state.selectedEntityId = nextSelection.entityId;
    state.selectedTxId = nextSelection.txId;
    renderAll({ recenter: true, updateGlobe: true });
  }
  function selectTransaction(txId, options = {}) {
    const { pushHistory = true } = options;
    if (!txById.has(txId)) return;
    const nextSelection = { entityId: state.selectedEntityId || "", txId };
    if (sameSelection(selectionSnapshot(), nextSelection)) return;
    if (pushHistory) pushSelectionHistory();
    state.selectedTxId = txId;
    renderAll({ recenter: false, updateGlobe: true });
  }
  function resetAll() {
    state.selectedEntityId = "";
    state.selectedTxId = "";
    state.history = [];
    renderAll({ recenter: true, updateGlobe: true });
  }

  function trySelectFromSearch() {
    const query = byId("searchInput").value.trim().toLowerCase();
    if (!query) {
      resetAll();
      return;
    }
    const exact = searchCatalog.find((item) =>
      item.label.toLowerCase() === query ||
      item.name.toLowerCase() === query ||
      normalizeLabelKey(item.label) === normalizeLabelKey(query)
    );
    const fuzzy = exact || searchCatalog.find((item) => item.blob.includes(query));
    if (fuzzy) selectEntity(fuzzy.id);
  }

  function applyInitialQuery() {
    const params = new URLSearchParams(window.location.search);
    const entityQuery = params.get("entity");
    if (!entityQuery) return;
    byId("searchInput").value = entityQuery;
    trySelectFromSearch();
  }

  renderLegend();
  bindChain3DInteractions();
  renderAll({ recenter: true, updateGlobe: true });
  applyInitialQuery();

  byId("searchInput").addEventListener("input", () => {
    renderSearchResults();
  });

  byId("searchInput").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    trySelectFromSearch();
  });

  byId("results").addEventListener("click", (event) => {
    const target = event.target.closest("[data-entity]");
    if (!target) return;
    selectEntity(target.dataset.entity);
  });

  byId("relationList").addEventListener("click", (event) => {
    const target = event.target.closest("[data-tx]");
    if (!target) return;
    selectTransaction(target.dataset.tx);
  });

  byId("hierarchyBody").addEventListener("click", (event) => {
    const item = event.target.closest(".hierarchy-item");
    if (!item) return;
    if (item.dataset.entity) selectEntity(item.dataset.entity);
    else if (item.dataset.tx) selectTransaction(item.dataset.tx);
  });

  byId("regionList").addEventListener("click", (event) => {
    const target = event.target.closest("[data-entity]");
    if (!target) return;
    selectEntity(target.dataset.entity);
    setRegionVisibility(false);
  });

  byId("regionList").addEventListener("mouseover", (event) => {
    const target = event.target.closest("[data-region-key]");
    setRegionHover(target?.dataset.regionKey || "");
  });
  byId("regionList").addEventListener("mouseleave", () => setRegionHover(""));

  byId("regionSvg").addEventListener("click", (event) => {
    const target = event.target.closest("[data-entity]");
    if (!target) return;
    selectEntity(target.dataset.entity);
    setRegionVisibility(false);
  });
  byId("regionSvg").addEventListener("mousemove", (event) => {
    const target = event.target.closest("[data-region-key]");
    setRegionHover(target?.dataset.regionKey || "");
  });
  byId("regionSvg").addEventListener("mouseleave", () => setRegionHover(""));

  byId("clearBtn").addEventListener("click", () => {
    byId("searchInput").value = "";
    resetAll();
  });

  byId("labelsBtn").addEventListener("click", () => {
    state.labels = !state.labels;
    byId("labelsBtn").classList.toggle("is-on", state.labels);
    renderAll({ recenter: false, updateGlobe: true });
  });

  byId("rotateBtn").addEventListener("click", () => {
    state.autoRotate = !state.autoRotate;
    byId("rotateBtn").classList.toggle("is-on", state.autoRotate);
    const controls = globe?.controls ? globe.controls() : null;
    if (controls) controls.autoRotate = state.autoRotate && !state.selectedEntityId;
  });

  byId("openRegionBtn").addEventListener("click", () => {
    renderRegion(computeContext());
    setRegionVisibility(true);
  });

  byId("closeRegionBtn").addEventListener("click", () => setRegionVisibility(false));
  byId("regionBackdrop").addEventListener("click", () => setRegionVisibility(false));

  byId("openEvidenceBtn").addEventListener("click", () => {
    if (!state.selectedEntityId) return;
    renderEvidence(computeContext());
    setEvidenceVisibility(true);
  });

  byId("closeEvidenceBtn").addEventListener("click", () => setEvidenceVisibility(false));
  byId("evidenceBackdrop").addEventListener("click", () => setEvidenceVisibility(false));
})();
