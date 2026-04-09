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
  const shortTextMiddle = (value, limit = 24, tail = 10) => {
    const text = safeText(value, "未命名");
    if (text.length <= limit) return text;
    const safeTail = Math.max(4, Math.min(tail, limit - 5));
    const head = Math.max(3, limit - safeTail - 1);
    return `${text.slice(0, head)}…${text.slice(-safeTail)}`;
  };
  const visualTextUnits = (value) => [...String(value || "")].reduce((total, char) => {
    if (/[\u4e00-\u9fa5]/.test(char)) return total + 1.06;
    if (/\s/.test(char)) return total + 0.34;
    if (/[A-Z0-9]/.test(char)) return total + 0.7;
    return total + 0.62;
  }, 0);
  const estimateLabelWidth = (value, fontSize = 16, padding = 20) =>
    Math.max(44, Math.round(visualTextUnits(value) * fontSize * 0.72 + padding));
  const rectsOverlap = (a, b, padding = 0) => !(
    a.right + padding <= b.left
    || a.left >= b.right + padding
    || a.bottom + padding <= b.top
    || a.top >= b.bottom + padding
  );
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
  const stageColorOverrides = {
    "Artisanal mining": "#42d6c4",
    "Electric car manufacturing": "#68a8ff",
    "Electric scooter manufacturing": "#f3ead8"
  };
  const stageLookup = new Map(stageOrder.map((stage) => [String(stage).toLowerCase(), stage]));

  const entities = new Map((DATA.entities || []).map((entity) => [entity.id, entity]));
  const sources = new Map((DATA.sources || []).map((source) => [source.id, source]));
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
      const merged = {
        ...tx,
        rawCount: 1,
        rawIds: [tx.id]
      };
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
    [tx.supplierCompanyId, tx.supplierFacilityId].filter(Boolean).forEach((id) => pushMapArray(txBySupplierEntity, id, tx));
    [tx.buyerCompanyId, tx.buyerFacilityId].filter(Boolean).forEach((id) => pushMapArray(txByBuyerEntity, id, tx));
    [tx.supplierCompanyId && `${tx.supplierCompanyId}::${tx.supplierStage}`, tx.supplierFacilityId && `${tx.supplierFacilityId}::${tx.supplierStage}`]
      .filter(Boolean)
      .forEach((id) => pushMapArray(txBySupplierStageNode, id, tx));
    [tx.buyerCompanyId && `${tx.buyerCompanyId}::${tx.buyerStage}`, tx.buyerFacilityId && `${tx.buyerFacilityId}::${tx.buyerStage}`]
      .filter(Boolean)
      .forEach((id) => pushMapArray(txByBuyerStageNode, id, tx));
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
    selectedChainStage: "",
    selectedTxId: "",
    evidenceOpen: false,
    chainOpen: false,
    chainFullZoom: 1,
    chainFullZoomMode: "fit",
    chainFullVisibleStages: [],
    regionOpen: false,
    view: { lat: 16, lng: 102, altitude: 3.08 },
    textureNotice: "",
    globeNotice: "",
    globeMode: "pending",
    pointerX: 0,
    pointerY: 0,
    suppressViewSync: false,
    regionHoverKey: ""
  };

  let globe = null;
  let viewSyncTimer = 0;
  let regionHoverModel = { plotBox: null, points: [] };

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
    if (trailingAcronymMatch && !/%/.test(trailingAcronymMatch[1])) {
      return trailingAcronymMatch[1].trim();
    }

    const bracketMatch = text.match(/^(.+?)\s*[（(]([^()（）]+)[)）]\s*$/);
    if (!bracketMatch) return text;

    const outside = compactLabelText(bracketMatch[1]);
    const inside = compactLabelText(bracketMatch[2]);
    if (!/%/.test(inside) && /^[A-Z][A-Z0-9.&/\-]{1,12}$/.test(inside)) return inside;
    if (outside) return outside;
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

  function looksLikeLocationOnlyLabel(label, place = "") {
    const text = compactLabelText(label);
    if (!text) return true;
    if (genericFacilityToken(text)) return true;
    if (/(company|co\.|corp|corporation|group|limited|ltd|inc|llc|plc|gmbh|sarl|sa|mine|mining|plant|factory|facility|refinery|smelter|industrial|technology|materials|battery|cobalt|nickel|metal|trading|works|project|park)/i.test(text)) {
      return false;
    }
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

  function chainSubjectIdentity(entity, { companyName = "", facilityRaw = "", fallback = "" } = {}) {
    const ownerId = entity?.type === "company"
      ? entity.id
      : (entity?.id ? facilityCompany.get(entity.id) || "" : "");
    const ownerEntity = ownerId ? entities.get(ownerId) : null;
    const ownerName = compactLabelText(
      conciseEntityName(companyName)
      || conciseEntityName(ownerEntity?.name)
      || ownerCompanyName(entity)
      || ""
    );
    const name = ownerName || preferredEntityLabel(entity, { companyName, facilityRaw, fallback });
    const entityId = ownerEntity?.id || (entity?.type === "company" ? entity.id : entity?.id || "");
    return {
      entityId,
      name,
      key: entityId || `subject:${normalizeLabelKey(name || fallback || facilityRaw)}`
    };
  }

  function shortPlaceLabel(value) {
    const cleaned = compactLabelText(value);
    if (!cleaned) return "";
    const parts = cleaned.split(/,|\/|;/).map((item) => item.trim()).filter(Boolean);
    return parts[0] || "";
  }

  function dedupeTextList(list) {
    const seen = new Set();
    const result = [];
    list.forEach((item) => {
      const text = compactLabelText(item);
      const key = normalizeLabelKey(text);
      if (!text || !key || seen.has(key)) return;
      seen.add(key);
      result.push(text);
    });
    return result;
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
      return compactLabelText(entityName || ownerName || conciseEntityName(fallback) || fallback) || "未命名实体";
    }

    if (entityName && !looksLikeLocationOnlyLabel(entityName, entityPlace) && !genericFacilityToken(entityName)) {
      return entityName;
    }

    if (displayName && !looksLikeLocationOnlyLabel(displayName, entityPlace) && !genericFacilityToken(displayName)) {
      return displayName;
    }

    if (ownerName && typeLabel && !/^(总部|办公点)$/.test(typeLabel)) {
      if (entityName && entityName.length <= 10 && !genericFacilityToken(entityName)) {
        return `${compactLabelText(ownerName)} ${entityName}`;
      }
      return `${compactLabelText(ownerName)} ${typeLabel}`;
    }

    if (ownerName && /^(总部|办公点)$/.test(typeLabel)) {
      const placeLabel = shortPlaceLabel(entityPlace);
      if (placeLabel) return `${compactLabelText(ownerName)} ${placeLabel}`;
    }

    if (ownerName) {
      return compactLabelText(ownerName);
    }

    const addressLabel = firstAddressLabel(entityPlace);
    if (addressLabel) return addressLabel;

    if (typeLabel) return typeLabel;

    return compactLabelText(entityName || fallback) || "未命名实体";
  }

  function pointOwnerName(point) {
    if (!point?.companyId) return "";
    return conciseEntityName(entities.get(point.companyId)?.name || "");
  }

  function regionPointDetail(point) {
    const entity = point?.entityId ? entities.get(point.entityId) : null;
    const ownerName = pointOwnerName(point);
    const entityName = compactLabelText(entity?.name || "");
    const displayName = compactLabelText(entity?.displayName || "");
    const placeLabel = shortPlaceLabel(entity?.place || point?.place || "");
    const candidates = [];

    if (entity?.type === "facility") {
      if (entityName && !genericFacilityToken(entityName) && normalizeLabelKey(entityName) !== normalizeLabelKey(ownerName)) {
        candidates.push(entityName);
      }
      if (displayName && !genericFacilityToken(displayName) && !looksLikeLocationOnlyLabel(displayName, entity?.place || point?.place || "")) {
        candidates.push(displayName);
      }
      if (placeLabel) candidates.push(placeLabel);
    } else if (placeLabel) {
      candidates.push(placeLabel);
    }

    return dedupeTextList(candidates)[0] || "";
  }

  function buildRegionPointLabel(point, points, limit = 24) {
    const composeLabel = (item, includeStage = false) => {
      const entity = item?.entityId ? entities.get(item.entityId) : null;
      const baseName = compactLabelText(item?.name || item?.chainName || entity?.name || "");
      const ownerName = pointOwnerName(item);
      const detailName = regionPointDetail(item);
      const placeLabel = shortPlaceLabel(item?.place) || displayCountry(item?.country || "");
      const typeLabel = displayFacilityType(entity?.facilityType || entity?.displayName || "");
      const sameOwnerCount = item?.companyId
        ? points.filter((candidate) => candidate.companyId && candidate.companyId === item.companyId).length
        : 0;
      const sameStageOwnerCount = item?.companyId
        ? points.filter((candidate) => candidate.companyId && candidate.companyId === item.companyId && candidate.dominantStage === item.dominantStage).length
        : 0;
      const sameBaseCount = baseName
        ? points.filter((candidate) => normalizeLabelKey(candidate.name || candidate.chainName || "") === normalizeLabelKey(baseName)).length
        : 0;
      const detailKey = normalizeLabelKey(detailName);
      const typeKey = normalizeLabelKey(typeLabel);
      const ownerKey = normalizeLabelKey(ownerName);
      let label = ownerName || baseName || "未命名实体";

      if (entity?.type === "facility" && ownerName) {
        if (sameOwnerCount > 1 || sameStageOwnerCount > 1) {
          if (detailName && detailKey && detailKey !== ownerKey) {
            label = `${ownerName} ${detailName}`;
          } else {
            label = ownerName;
          }
        } else {
          label = ownerName;
        }
      }

      const sameDetailCount = detailKey
        ? points.filter((candidate) => normalizeLabelKey(regionPointDetail(candidate)) === detailKey).length
        : 0;
      if (entity?.type === "facility" && sameDetailCount > 1 && typeLabel && typeKey) {
        const labelKey = normalizeLabelKey(label);
        if (!labelKey.includes(typeKey)) label = `${label} ${typeLabel}`;
      }

      if (placeLabel) {
        const placeKey = normalizeLabelKey(placeLabel);
        const labelKey = normalizeLabelKey(label);
        if ((sameBaseCount > 1 || sameOwnerCount > 1 || sameStageOwnerCount > 1 || sameDetailCount > 1) && placeKey && labelKey && !labelKey.includes(placeKey)) {
          label = `${label} ${placeLabel}`;
        }
      }

      if (includeStage && item?.dominantStage) {
        const stageLabel = displayStage(item.dominantStage);
        const stageKey = normalizeLabelKey(stageLabel);
        const labelKey = normalizeLabelKey(label);
        if (stageKey && !labelKey.includes(stageKey)) label = `${label} ${stageLabel}`;
      }

      return compactLabelText(label);
    };

    const baseLabel = composeLabel(point, false);
    const baseKey = normalizeLabelKey(baseLabel);
    const sameLabelCount = baseKey
      ? points.filter((item) => normalizeLabelKey(composeLabel(item, false)) === baseKey).length
      : 0;
    const finalLabel = sameLabelCount > 1 ? composeLabel(point, true) : baseLabel;
    return shortTextMiddle(finalLabel, limit, 12);
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
    const conciseFallback = conciseEntityName(fallback);
    return preferredEntityLabel(entity, { fallback: conciseFallback || fallback });
  }

  function displayNodeKey(node) {
    return `${node.stage}::${normalizeLabelKey(node.name)}`;
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
    const fallbackName = companyRaw || facilityRaw || "Unknown entity";
    const preferredName = preferredEntityLabel(entity, {
      companyName: companyRaw,
      facilityRaw,
      fallback: companyRaw || facilityRaw || "未命名实体"
    });
    const chainSubject = entity?.type === "facility" && entity.id === state.selectedEntityId
      ? {
          entityId: entity.id,
          key: entity.id,
          name: preferredName
        }
      : chainSubjectIdentity(entity, {
          companyName: companyRaw,
          facilityRaw,
          fallback: fallbackName
        });
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
      chainEntityId: chainSubject.entityId,
      chainKey: chainSubject.key,
      chainName: chainSubject.name,
      name: preferredName
    };
  }

  function currentEntity() {
    return state.selectedEntityId ? entities.get(state.selectedEntityId) || null : null;
  }

  function currentTx() {
    return state.selectedTxId ? txById.get(state.selectedTxId) || null : null;
  }

  function entityScopeIds(entityId, options = {}) {
    const { includeCompanyFacilities = true, includeOwnerCompany = false } = options;
    const scope = new Set();
    if (!entityId) return scope;
    scope.add(entityId);
    const entity = entities.get(entityId);
    if (entity?.type === "company" && includeCompanyFacilities) {
      (companyFacilities.get(entity.id) || []).forEach((facilityId) => scope.add(facilityId));
    } else if (includeOwnerCompany) {
      const ownerId = facilityCompany.get(entityId);
      if (ownerId) scope.add(ownerId);
    }
    return scope;
  }

  function graphSeedEntityIds(entityId) {
    return entityScopeIds(entityId, { includeCompanyFacilities: true, includeOwnerCompany: false });
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

    // Some facilities are reused across companies in the raw data.
    // For company-mode matching, only treat a facility hit as valid when
    // the company on that side is the selected company or is missing.
    return !companyId || companyId === entityId;
  }

  function txTouchesEntity(tx, entityId) {
    return txSideMatchesEntity(tx, "supplier", entityId) || txSideMatchesEntity(tx, "buyer", entityId);
  }

  function matchesEntitySelection(point, entityId) {
    if (!entityId || !point) return false;
    return [point.entityId, point.chainEntityId, point.companyId, point.facilityId]
      .filter(Boolean)
      .includes(entityId);
  }

  function matchesSelectedEntity(point) {
    return matchesEntitySelection(point, state.selectedEntityId);
  }

  function stageFilteredTransactions() {
    if (state.stage === "all") return transactions;
    return transactions.filter((tx) => tx.supplierStage === state.stage || tx.buyerStage === state.stage);
  }

  function entityFocusedTransactions(base, entityId) {
    return base.filter((tx) => txTouchesEntity(tx, entityId));
  }

  function txEntityIds(tx, side, options = {}) {
    const { includeFacilities = true } = options;
    const ids = side === "supplier"
      ? [tx.supplierCompanyId, includeFacilities ? tx.supplierFacilityId : ""]
      : [tx.buyerCompanyId, includeFacilities ? tx.buyerFacilityId : ""];
    return uniqueValues(ids);
  }

  function txStageNodeIds(tx, side, options = {}) {
    const { includeFacilities = true } = options;
    const stage = side === "supplier" ? tx.supplierStage : tx.buyerStage;
    return txEntityIds(tx, side, { includeFacilities }).map((id) => `${id}::${stage}`);
  }

  function expandEntityChainTransactions(base, entityId, options = {}) {
    const {
      maxDepth = 7,
      startStage = "",
      includeFacilities = null
    } = options;
    const allowedTxIds = new Set(base.map((tx) => tx.id));
    const collected = new Map();
    const entity = entities.get(entityId);
    const useFacilities = includeFacilities ?? (entity?.type === "facility");
    const stageFilter = String(startStage || "");
    const touchesSelectedStage = (tx, side) => {
      if (!stageFilter) return true;
      return side === "supplier" ? tx.supplierStage === stageFilter : tx.buyerStage === stageFilter;
    };

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
            txStageNodeIds(tx, nextSide, { includeFacilities: useFacilities }).forEach((nextId) => {
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
      const matchesSupplier = txSideMatchesEntity(tx, "supplier", entityId) && touchesSelectedStage(tx, "supplier");
      const matchesBuyer = txSideMatchesEntity(tx, "buyer", entityId) && touchesSelectedStage(tx, "buyer");
      if (!matchesSupplier && !matchesBuyer) return;
      collected.set(tx.id, tx);
      if (matchesSupplier) {
        txStageNodeIds(tx, "buyer", { includeFacilities: useFacilities }).forEach((id) => downstreamSeeds.add(id));
      }
      if (matchesBuyer) {
        txStageNodeIds(tx, "supplier", { includeFacilities: useFacilities }).forEach((id) => upstreamSeeds.add(id));
      }
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
    const chainFocus = entity
      ? expandEntityChainTransactions(base, entity.id, {
          startStage: state.selectedChainStage,
          includeFacilities: entity?.type === "facility"
        })
      : focus;

    return {
      base,
      focus,
      chainFocus,
      entity,
      chainStage: state.selectedChainStage,
      tx,
      mode,
      cameraRadiusKm: cameraRadiusKm(state.view.altitude)
    };
  }

  function activeChainSelectionLabel(context) {
    if (!context?.entity) return "";
    const entityLabel = entityTitle(context.entity.id, context.entity.name);
    if (!context.chainStage) return entityLabel;
    return `${entityLabel} / ${displayStage(context.chainStage)}`;
  }

  function currentModeLabel(context) {
    if (context.mode === "entity" && context.entity) {
      return context.chainStage
        ? `当前锁定：${activeChainSelectionLabel(context)}`
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
    root.style.setProperty("--earth-fallback-image", "url('assets/earth_github_4096.jpg')");
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
    return stageColorOverrides[stage] || stageColors[stage] || "#7fd0ff";
  }

  function buildLegend() {
    byId("legendList").innerHTML = stageOrder
      .map((stage) => `
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
            <div class="result-name">${esc(item.type === "company" ? conciseEntityName(item.name) : item.name)}</div>
            <div class="result-meta">${esc(displayCountry(item.country))} | ${esc(displayEntityType(item.type))} | ${fmt.format(item.count)} 条关联关系</div>
          </div>
          <span class="tag">${item.type === "company" ? "企业" : "设施"}</span>
        </button>
      `).join("")
      : "<div class='empty-state'>没有匹配结果，请尝试换一个关键词。</div>";
  }

  function renderFocusChip(context) {
    const chip = document.querySelector(".focus-chip");
    const title = byId("focusTitle");
    const sub = byId("focusSub");
    const stageLocked = Boolean(context.entity && context.chainStage);
    if (chip) chip.classList.toggle("is-stage-locked", stageLocked);
    if (!title || !sub) return;
    title.classList.toggle("is-stage-locked", stageLocked);
    sub.classList.toggle("is-stage-locked", stageLocked);
    title.textContent = currentModeLabel(context);
    sub.textContent = currentModeSub(context);
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
    const entityLabel = entityTitle(entity.id, entity.name);
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
        <div class="entity-title">${esc(entityLabel)}</div>
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
      ? (context.chainStage
          ? `当前锁定：${activeChainSelectionLabel(context)}`
          : `已锁定：${entityTitle(context.entity.id, context.entity.name)}`)
      : (context.tx ? "已锁定关系" : "当前未锁定实体");
    byId("infoMeta").classList.toggle("is-stage-locked", Boolean(context.entity && context.chainStage));
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
          ${tx.rawCount > 1 ? `<div class="kv-row"><span>原始记录</span><strong>${fmt.format(tx.rawCount)}</strong></div>` : ""}
        </div>
        ${tx.notes.length ? `<div class="section-title compact-top">证据备注</div><div class="subnote">${esc(tx.notes.join("； "))}</div>` : ""}
        ${sourceLinks.length ? `<div class="source-links">${sourceLinks.slice(0, 6).map((source) => `<a class="source-link" href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.host || source.url)}</a>`).join("")}</div>` : ""}
      </div>
    `;
  }

  function relationItemHtml(tx) {
    const active = tx.id === state.selectedTxId;
    const mergedMeta = tx.rawCount > 1 ? ` | 合并 ${fmt.format(tx.rawCount)} 条` : "";
    return `
      <button class="relation-item ${active ? "is-active" : ""}" data-tx="${esc(tx.id)}">
        <div class="relation-title">${esc(entityTitle(tx.supplierFacilityId || tx.supplierCompanyId, tx.supplierCompany || tx.supplierFacility))} → ${esc(entityTitle(tx.buyerFacilityId || tx.buyerCompanyId, tx.buyerCompany || tx.buyerFacility))}</div>
        <div class="relation-meta">数量：${esc(formatAmount(tx))} | 时间：${esc(formatDate(tx))} | 证据：${fmt.format(tx.sourceIds.length)} 条${esc(mergedMeta)}</div>
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

  function setChainVisibility(open) {
    const modal = byId("chainModal");
    const backdrop = byId("chainBackdrop");
    if (!modal || !backdrop) return;
    const visible = Boolean(open);
    state.chainOpen = visible;
    if (visible) {
      state.chainFullZoomMode = "fit";
      state.chainFullVisibleStages = [];
    }
    modal.classList.toggle("is-hidden", !visible);
    backdrop.classList.toggle("is-hidden", !visible);
    modal.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible) {
      window.requestAnimationFrame(() => renderChain(computeContext()));
    }
  }

  function updateChainZoomLabel() {
    const label = byId("chainZoomLabel");
    if (!label) return;
    label.textContent = `${Math.round((state.chainFullZoom || 1) * 100)}%`;
  }

  function setChainFullZoom(nextZoom, mode = "manual") {
    state.chainFullZoom = clamp(Number(nextZoom) || 1, 0.22, 2.4);
    state.chainFullZoomMode = mode;
    updateChainZoomLabel();
  }

  function setupChainFullViewportControls() {
    const scroll = byId("chainFullScroll");
    if (!scroll || scroll.dataset.bound === "1") return;
    scroll.dataset.bound = "1";
    scroll.classList.add("chain-pan-surface");

    let drag = null;
    let suppressClickUntil = 0;

    const endDrag = () => {
      if (!drag) return;
      scroll.classList.remove("is-dragging");
      drag = null;
    };

    scroll.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      drag = {
        startX: event.clientX,
        startY: event.clientY,
        startLeft: scroll.scrollLeft,
        startTop: scroll.scrollTop,
        moved: false
      };
      scroll.classList.add("is-dragging");
      event.preventDefault();
    });

    window.addEventListener("mousemove", (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      scroll.scrollLeft = drag.startLeft - dx;
      scroll.scrollTop = drag.startTop - dy;
    });

    window.addEventListener("mouseup", () => {
      if (drag?.moved) suppressClickUntil = Date.now() + 180;
      endDrag();
    });

    scroll.addEventListener("wheel", (event) => {
      if (!state.chainOpen) return;
      const oldZoom = state.chainFullZoom || 1;
      const nextZoom = clamp(oldZoom * (event.deltaY < 0 ? 1.12 : 0.89), 0.22, 2.4);
      if (Math.abs(nextZoom - oldZoom) < 0.001) return;

      const rect = scroll.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const contentX = (scroll.scrollLeft + offsetX) / oldZoom;
      const contentY = (scroll.scrollTop + offsetY) / oldZoom;

      event.preventDefault();
      setChainFullZoom(nextZoom, "manual");
      renderChain(computeContext());

      window.requestAnimationFrame(() => {
        scroll.scrollLeft = Math.max(0, contentX * nextZoom - offsetX);
        scroll.scrollTop = Math.max(0, contentY * nextZoom - offsetY);
      });
    }, { passive: false });

    scroll.addEventListener("click", (event) => {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }

  function setRegionVisibility(open) {
    const modal = byId("regionModal");
    const backdrop = byId("regionBackdrop");
    if (!modal || !backdrop) return;
    const visible = Boolean(open);
    state.regionOpen = visible;
    if (!visible) state.regionHoverKey = "";
    modal.classList.toggle("is-hidden", !visible);
    backdrop.classList.toggle("is-hidden", !visible);
    modal.setAttribute("aria-hidden", visible ? "false" : "true");
    const controls = globe?.controls ? globe.controls() : null;
    if (controls) {
      controls.autoRotate = state.autoRotate && !state.selectedEntityId && !state.selectedTxId && !visible;
    }
    if (visible) {
      window.requestAnimationFrame(() => renderRegion(computeContext()));
    }
  }

  function setRegionHover(regionKey = "") {
    const nextKey = String(regionKey || "");
    if (state.regionHoverKey === nextKey) return;
    state.regionHoverKey = nextKey;
    if (!state.regionOpen) return;
    window.requestAnimationFrame(() => renderRegion(computeContext()));
  }

  function regionHoverKeyFromPointer(event) {
    const labelKey = event.target.closest?.(".region-label-item[data-region-key]")?.dataset?.regionKey;
    if (labelKey) return labelKey;
    const directKey = event.target.closest?.("[data-region-key]")?.dataset?.regionKey || "";

    const svg = event.currentTarget;
    const plotBox = regionHoverModel.plotBox;
    if (!svg || !plotBox || !regionHoverModel.points.length) return directKey;

    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox?.baseVal;
    if (!rect.width || !rect.height || !viewBox?.width || !viewBox?.height) return directKey;

    const x = (event.clientX - rect.left) * (viewBox.width / rect.width);
    const y = (event.clientY - rect.top) * (viewBox.height / rect.height);
    if (x < plotBox.left - 12 || x > plotBox.right + 12 || y < plotBox.top - 12 || y > plotBox.bottom + 12) return directKey;

    let best = null;
    regionHoverModel.points.forEach((point) => {
      const dx = x - point.x;
      const dy = y - point.y;
      const distanceSq = (dx * dx) + (dy * dy);
      if (distanceSq > point.hitRadius * point.hitRadius) return;
      if (!best || distanceSq < best.distanceSq || (distanceSq === best.distanceSq && point.priority > best.priority)) {
        best = { key: point.key, distanceSq, priority: point.priority };
      }
    });

    return best?.key || directKey;
  }

  function bindChainHover(svgId) {
    const svg = byId(svgId);
    if (!svg || svg.dataset.hoverBound === "1") return;
    svg.dataset.hoverBound = "1";

    let activeNode = null;
    const setActiveNode = (nextNode) => {
      if (activeNode === nextNode) return;
      if (activeNode) activeNode.classList.remove("is-hovered");
      activeNode = nextNode || null;
      if (activeNode) {
        activeNode.classList.add("is-hovered");
        activeNode.parentNode?.appendChild(activeNode);
      }
    };

    svg.addEventListener("mouseover", (event) => {
      const node = event.target.closest?.("g.chain-node");
      if (!node || !svg.contains(node)) return;
      setActiveNode(node);
    });

    svg.addEventListener("mousemove", (event) => {
      const node = event.target.closest?.("g.chain-node");
      if (!node || !svg.contains(node)) return;
      setActiveNode(node);
    });

    svg.addEventListener("mouseleave", () => {
      setActiveNode(null);
    });
  }

  function computeChainFullscreenLabelLayout(nodes, options = {}) {
    const {
      top = 0,
      bottom = 0,
      height = 0,
      fontSize = 16,
      stageCount = 1
    } = options;
    const safeTop = top + 10;
    const safeBottom = height - bottom - 10;
    const occupied = [];
    const nodeBounds = nodes.map((node) => ({
      left: node.x - (node.selected ? 26 : 18),
      right: node.x + (node.selected ? 26 : 18),
      top: node.y - (node.selected ? 26 : 18),
      bottom: node.y + (node.selected ? 26 : 18)
    }));
    const layouts = new Map();
    const ordered = [...nodes].sort((a, b) =>
      Number(b.selected) - Number(a.selected)
      || a.stageIndex - b.stageIndex
      || a.y - b.y
      || b.count - a.count
    );

    ordered.forEach((node) => {
      const displayLabel = shortText(node.name, node.selected ? 20 : 17);
      const labelWidth = estimateLabelWidth(displayLabel, node.selected ? fontSize + 2 : fontSize, 22);
      const labelHeight = Math.max(24, Math.round((node.selected ? fontSize + 2 : fontSize) + 10));
      const preferRight = node.stageIndex <= (stageCount - 1) / 2;
      const primaryAnchor = preferRight ? "start" : "end";
      const secondaryAnchor = preferRight ? "end" : "start";
      const candidates = [
        { anchor: primaryAnchor, dx: preferRight ? 18 : -18, dy: -42 },
        { anchor: primaryAnchor, dx: preferRight ? 18 : -18, dy: 40 },
        { anchor: primaryAnchor, dx: preferRight ? 22 : -22, dy: -72 },
        { anchor: primaryAnchor, dx: preferRight ? 22 : -22, dy: 70 },
        { anchor: secondaryAnchor, dx: preferRight ? -18 : 18, dy: -34 },
        { anchor: secondaryAnchor, dx: preferRight ? -18 : 18, dy: 34 },
        { anchor: primaryAnchor, dx: preferRight ? 26 : -26, dy: 0 }
      ];

      let best = null;
      candidates.forEach((candidate, index) => {
        const labelX = node.x + candidate.dx;
        const labelY = clamp(node.y + candidate.dy, safeTop + labelHeight / 2, safeBottom - labelHeight / 2);
        const rectX = candidate.anchor === "start"
          ? labelX - 10
          : labelX - labelWidth + 10;
        const rectY = Math.round(labelY - labelHeight / 2 - 1);
        const rect = {
          left: rectX - 6,
          right: rectX + labelWidth + 6,
          top: rectY - 4,
          bottom: rectY + labelHeight + 4
        };
        const collisionCount = occupied.filter((item) => rectsOverlap(rect, item, 8)).length;
        const nodeCollisionCount = nodeBounds.filter((item) => rectsOverlap(rect, item, 4)).length;
        const penalty = collisionCount * 100 + nodeCollisionCount * 18 + index * 2 + Math.abs(candidate.dy) * 0.08;
        if (!best || penalty < best.penalty) {
          best = {
            penalty,
            anchor: candidate.anchor,
            labelX,
            labelY,
            labelWidth,
            labelHeight,
            rectX,
            rectY
          };
        }
      });

      if (!best) return;
      occupied.push({
        left: best.rectX - 6,
        right: best.rectX + best.labelWidth + 6,
        top: best.rectY - 4,
        bottom: best.rectY + best.labelHeight + 4
      });
      layouts.set(node.graphKey, {
        ...best,
        displayLabel
      });
    });

    return layouts;
  }

  function buildEvidenceProfile(entity, related) {
    const entityLabel = entityTitle(entity.id, entity.name);
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
        .map((item) => entityTitle(item.id, item.name));
    } else {
      const ownerId = facilityCompany.get(entity.id);
      const owner = ownerId ? entities.get(ownerId) : null;
      const siblings = ownerId
        ? (companyFacilities.get(ownerId) || []).filter((facilityId) => facilityId !== entity.id).slice(0, 6).map((facilityId) => {
          const item = entities.get(facilityId);
          return item ? entityTitle(item.id, item.name) : "";
        }).filter(Boolean)
        : [];
      relatedEntities = [owner ? entityTitle(owner.id, owner.name) : "", ...siblings].filter(Boolean);
    }

    return `
      <div class="evidence-profile-title">${esc(entityLabel)}</div>
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

  function evidenceCounterpartMeta(tx, direction) {
    const upstream = direction === "upstream";
    const companyId = upstream ? tx.supplierCompanyId : tx.buyerCompanyId;
    const facilityId = upstream ? tx.supplierFacilityId : tx.buyerFacilityId;
    const companyRaw = compactLabelText(upstream ? tx.supplierCompany : tx.buyerCompany);
    const facilityRaw = upstream ? tx.supplierFacility : tx.buyerFacility;
    const entityId = facilityId || companyId || "";
    const entity = entityId ? entities.get(entityId) : null;
    const ownerId = entity?.type === "facility"
      ? (facilityCompany.get(entity.id) || companyId || "")
      : (companyId || entityId);
    const ownerEntity = ownerId ? entities.get(ownerId) : null;
    const subjectName = compactLabelText(
      conciseEntityName(companyRaw)
      || conciseEntityName(ownerEntity?.name)
      || ownerCompanyName(entity)
      || preferredEntityLabel(entity, {
        companyName: companyRaw,
        facilityRaw,
        fallback: companyRaw || facilityRaw || "未标注"
      })
    ) || "未标注";
    const facilityLabel = entity?.type === "facility"
      ? preferredEntityLabel(entity, {
        companyName: companyRaw || ownerEntity?.name || "",
        facilityRaw,
        fallback: facilityRaw || subjectName
      })
      : "";
    const showFacility = Boolean(
      facilityLabel
      && normalizeLabelKey(facilityLabel) !== normalizeLabelKey(subjectName)
      && !normalizeLabelKey(facilityLabel).includes(normalizeLabelKey(subjectName))
    );

    return {
      subjectKey: ownerId || companyId || facilityId || `subject:${normalizeLabelKey(subjectName || facilityLabel || tx.id)}`,
      subjectName,
      facilityLabel: showFacility ? facilityLabel : "",
      entityId: ownerId || companyId || facilityId || "",
      rawRoleName: compactLabelText(conciseEntityName(companyRaw) || facilityRaw || subjectName || "未标注")
    };
  }

  function summarizeEvidenceValues(values, { empty = "未标注", limit = 3 } = {}) {
    const list = dedupeTextList(
      (values || [])
        .map((item) => compactLabelText(item))
        .filter((item) => item && item !== empty)
    );
    if (!list.length) return empty;
    if (list.length <= limit) return list.join("； ");
    return `${list.slice(0, limit).join("； ")} 等${fmt.format(list.length)}项`;
  }

  function groupedEvidenceTransactions(list, direction) {
    const upstream = direction === "upstream";
    const groups = new Map();

    list.forEach((tx) => {
      const counterpart = evidenceCounterpartMeta(tx, direction);
      const stage = upstream ? tx.supplierStage : tx.buyerStage;
      const signature = [
        counterpart.subjectKey || counterpart.subjectName,
        stage
      ].join("::");

      if (!groups.has(signature)) {
        groups.set(signature, {
          ...tx,
          counterpartMeta: counterpart,
          txIds: [...(tx.rawIds || [tx.id])],
          rawCount: tx.rawCount || 1,
          commodityValues: [transactionCommodity(tx)],
          dateValues: [formatDate(tx)],
          amountValues: [formatAmount(tx)]
        });
        return;
      }

      const entry = groups.get(signature);
      entry.txIds = uniqueValues([...entry.txIds, ...(tx.rawIds || [tx.id])]);
      entry.rawCount += tx.rawCount || 1;
      entry.sourceIds = uniqueValues([...entry.sourceIds, ...tx.sourceIds]);
      entry.notes = uniqueValues([...entry.notes, ...tx.notes]);
      entry.sourceCount = Math.max(entry.sourceCount || 0, tx.sourceCount || 0, entry.sourceIds.length);
      entry.commodityValues = uniqueValues([...(entry.commodityValues || []), transactionCommodity(tx)]);
      entry.dateValues = uniqueValues([...(entry.dateValues || []), formatDate(tx)]);
      entry.amountValues = uniqueValues([...(entry.amountValues || []), formatAmount(tx)]);
    });

    return sortTransactionsForList([...groups.values()]);
  }

  function evidenceCardHtml(tx, direction) {
    const upstream = direction === "upstream";
    const counterpart = tx.counterpartMeta || evidenceCounterpartMeta(tx, direction);
    const counterpartName = counterpart.subjectName || "未标注";
    const stage = upstream ? tx.supplierStage : tx.buyerStage;
    const roleLabel = upstream ? "供应方" : "采购方";
    const sourceLinks = sourceLinksForTx(tx);
    const active = tx.id === state.selectedTxId || (tx.txIds || []).includes(state.selectedTxId);
    const mergedMeta = tx.rawCount > 1 ? ` | 合并 ${fmt.format(tx.rawCount)} 条记录` : "";
    const amountSummary = summarizeEvidenceValues(tx.amountValues || [formatAmount(tx)], { limit: 2 });
    const commoditySummary = summarizeEvidenceValues(tx.commodityValues || [transactionCommodity(tx)]);
    const dateSummary = summarizeEvidenceValues(tx.dateValues || [formatDate(tx)]);

    return `
      <article class="evidence-card ${active ? "is-active" : ""}" data-tx="${esc(tx.id)}">
        <div class="evidence-card-head">
          <span class="evidence-tag" style="--badge:${stageColor(stage)}">${esc(displayStage(stage))}</span>
          <span class="meta">${esc(`${amountSummary}${mergedMeta}`)}</span>
        </div>
        <div class="evidence-card-title">${esc(counterpartName)}</div>
        <dl class="evidence-kv">
          <dt>${roleLabel}</dt>
          <dd>${esc(counterpartName)}</dd>
          ${counterpart.facilityLabel ? `<dt>设施</dt><dd>${esc(counterpart.facilityLabel)}</dd>` : ""}
          <dt>商品</dt>
          <dd>${esc(commoditySummary)}</dd>
          <dt>时间</dt>
          <dd>${esc(dateSummary)}</dd>
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
    const scope = graphSeedEntityIds(entity.id);
    const related = entityFocusedTransactions(context.base, entity.id);
    const upstream = groupedEvidenceTransactions(
      related.filter((tx) => scope.has(tx.buyerCompanyId) || scope.has(tx.buyerFacilityId)),
      "upstream"
    );
    const downstream = groupedEvidenceTransactions(
      related.filter((tx) => scope.has(tx.supplierCompanyId) || scope.has(tx.supplierFacilityId)),
      "downstream"
    );

    byId("evidenceMeta").textContent = `围绕 ${entityTitle(entity.id, entity.name)} 展开的来源与去向`;
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

  function projectRegionPointToBox(point, bounds, box) {
    const lonSpan = Math.max(1, bounds.maxLon - bounds.minLon);
    const latSpan = Math.max(1, bounds.maxLat - bounds.minLat);
    return {
      x: box.left + ((point.lon - bounds.minLon) / lonSpan) * Math.max(1, box.right - box.left),
      y: box.bottom - ((point.lat - bounds.minLat) / latSpan) * Math.max(1, box.bottom - box.top)
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
        entry.selected = entry.selected || matchesSelectedEntity(source);
      }
      if (isNum(target.lat) && isNum(target.lon)) {
        if (!pointMap.has(target.key)) pointMap.set(target.key, { ...target, weight: 0, stages: new Map(), selected: false });
        const entry = pointMap.get(target.key);
        entry.weight += 1;
        entry.stages.set(target.stage, (entry.stages.get(target.stage) || 0) + 1);
        entry.selected = entry.selected || matchesSelectedEntity(target);
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

  function buildRegionLabelLayout(points, projected, width, height, paddingX, paddingY, plotBox, labelFont) {
    const crowdRadius = width > 1500 ? 40 : (width > 1200 ? 34 : 28);
    const crowdRadiusSq = crowdRadius * crowdRadius;
    const crowdData = points.map((point, index) => {
      const p = projected.get(point.key);
      let crowd = 0;
      points.forEach((other) => {
        if (other.key === point.key) return;
        const o = projected.get(other.key);
        if (!o) return;
        const dx = p.x - o.x;
        const dy = p.y - o.y;
        if ((dx * dx) + (dy * dy) <= crowdRadiusSq) crowd += 1;
      });
      return { ...point, p, crowd, index };
    });

    const labelLimit = points.length <= 14 ? points.length : (width > 1500 ? 12 : 10);
    const prioritized = crowdData
      .sort((a, b) =>
        Number(b.selected) - Number(a.selected)
        || Number(b.crowd >= 2) - Number(a.crowd >= 2)
        || b.weight - a.weight
        || a.name.localeCompare(b.name, "en")
      );

    const chosen = [];
    prioritized.forEach((point) => {
      if (chosen.length >= labelLimit) return;
      if (point.selected || point.crowd >= 2 || point.weight >= 2.9) chosen.push(point);
    });
    prioritized.forEach((point) => {
      if (chosen.length >= labelLimit) return;
      if (chosen.some((item) => item.key === point.key)) return;
      chosen.push(point);
    });

    const uniqueChosen = [];
    const seenPoints = new Set();
    chosen.forEach((item) => {
      if (!item.key || seenPoints.has(item.key)) return;
      seenPoints.add(item.key);
      uniqueChosen.push(item);
    });

    const panelWidth = clamp(Math.round(width * 0.32), 320, 430);
    const displayLimit = width > 1400 ? 38 : 32;
    const panel = {
      left: plotBox.right + 18,
      right: Math.min(width - paddingX, plotBox.right + 18 + panelWidth),
      top: plotBox.top,
      bottom: plotBox.bottom,
      headerHeight: 28
    };
    const innerPad = 12;
    const itemHeight = labelFont + 12;
    const rowGap = 8;
    const columnWidth = Math.floor(panel.right - panel.left - innerPad * 2);
    const layout = new Map();
    const headers = [];

    const dedupedChosen = [];
    const seenDisplayPoints = new Set();
    uniqueChosen.forEach((item) => {
      const displayText = buildRegionPointLabel(item, uniqueChosen, displayLimit);
      const displayKey = `${normalizeLabelKey(displayText)}::${Math.round((item.lat || 0) * 100)}::${Math.round((item.lon || 0) * 100)}`;
      if (seenDisplayPoints.has(displayKey)) return;
      seenDisplayPoints.add(displayKey);
      dedupedChosen.push(item);
    });

    const sortedChosen = dedupedChosen
      .sort((a, b) =>
        Number(b.selected) - Number(a.selected)
        || stageOrder.indexOf(a.dominantStage) - stageOrder.indexOf(b.dominantStage)
        || b.weight - a.weight
        || a.name.localeCompare(b.name, "en")
      );

    let cursorY = panel.top + panel.headerHeight + 10;
    let lastStage = "";
    sortedChosen.forEach((item) => {
      if (item.dominantStage !== lastStage) {
        if (lastStage) cursorY += 6;
        headers.push({
          stage: item.dominantStage,
          x: panel.left + innerPad,
          y: cursorY + 12
        });
        cursorY += 22;
        lastStage = item.dominantStage;
      }
      const rectX = panel.left + innerPad;
      const rectY = cursorY;
      const labelY = rectY + itemHeight / 2 + 4;
      layout.set(item.key, {
        crowded: item.crowd >= 2,
        text: buildRegionPointLabel(item, dedupedChosen, displayLimit),
        textX: rectX + 18,
        rectX,
        rectY,
        rectWidth: columnWidth,
        rectHeight: itemHeight,
        lineEndX: rectX - 8,
        bendX: plotBox.right + 10,
        labelY,
        anchor: "start",
        dotX: rectX + 10,
        dotY: rectY + itemHeight / 2,
        color: stageColor(item.dominantStage),
        stage: item.dominantStage
      });
      cursorY += itemHeight + rowGap;
    });

    return { layout, panel, count: dedupedChosen.length, headers };
  }

  function renderRegion(context) {
    const model = buildRegionModel(context);
    const svg = byId("regionSvg");
    const stats = byId("regionStats");
    const baseViewport = getSvgViewport(svg, 1260, 520);
    const width = Math.max(baseViewport.width, 1280);
    const height = Math.max(baseViewport.height, 520);
    const paddingX = clamp(Math.round(width * 0.07), 54, 96);
    const paddingY = clamp(Math.round(height * 0.12), 42, 78);
    const labelFont = clamp(Math.round(height * 0.034), 12, 17);
    const metaFont = clamp(Math.round(height * 0.032), 10, 13);
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    if (!model.points.length) {
      regionHoverModel = { plotBox: null, points: [] };
      byId("regionCaption").textContent = "当前视角内没有可投影到局部区域的落点。";
      stats.innerHTML = "";
      svg.innerHTML = `<foreignObject x="18" y="20" width="${width - 36}" height="${Math.max(180, height - 40)}"><div xmlns="http://www.w3.org/1999/xhtml" class="empty-state">请拖动地球到有节点的区域，或点击企业/关系后查看局部区域映射。</div></foreignObject>`;
      return;
    }

    const bounds = boundsFromPoints(model.points);
    const countries = new Set(model.points.map((point) => displayCountry(point.country)).filter(Boolean));
    const stageSet = new Set(model.points.map((point) => point.dominantStage).filter(Boolean));
    const plotBox = {
      left: paddingX + clamp(Math.round(width * 0.06), 82, 126),
      right: width - paddingX - clamp(Math.round(width * 0.13), 180, 262),
      top: paddingY + 8,
      bottom: height - paddingY - 20
    };
    const projected = new Map(model.points.map((point) => [point.key, projectRegionPointToBox(point, bounds, plotBox)]));
    const regionLabels = buildRegionLabelLayout(model.points, projected, width, height, paddingX, paddingY, plotBox, labelFont);
    const labelLayout = regionLabels.layout;
    const labelPanel = regionLabels.panel;
    const hoverKey = state.regionHoverKey;
    regionHoverModel = {
      plotBox: { ...plotBox },
      points: model.points.map((point) => {
        const p = projected.get(point.key);
        if (!p) return null;
        const radius = point.selected ? 8.5 : clamp(4 + point.weight * 0.22, 4.5, 7.5);
        return {
          key: point.key,
          x: p.x,
          y: p.y,
          hitRadius: Math.max(radius + (labelLayout.has(point.key) ? 8 : 6), labelLayout.has(point.key) ? 13 : 11),
          priority: (labelLayout.has(point.key) ? 2 : 0) + (point.selected ? 1 : 0) + Math.min(point.weight, 3)
        };
      }).filter(Boolean)
    };
    const panelHeaderHtml = (regionLabels.headers || []).map((item) => `
      <text class="chart-sub-label region-panel-stage" x="${item.x}" y="${item.y}" font-size="${metaFont}">${esc(displayStage(item.stage))}</text>
    `).join("");

    byId("regionMeta").textContent = context.mode === "camera" ? "当前视角对应的地理窗口" : "当前焦点下的真实坐标投影";
    byId("regionCaption").textContent = `纬度 ${bounds.minLat.toFixed(1)}° 至 ${bounds.maxLat.toFixed(1)}°，经度 ${bounds.minLon.toFixed(1)}° 至 ${bounds.maxLon.toFixed(1)}°；共 ${fmt.format(model.points.length)} 个落点、${fmt.format(model.links.length)} 条关系。`;
    stats.innerHTML = [
      `国家 ${fmt.format(countries.size)}`,
      `环节 ${fmt.format(stageSet.size)}`,
      `视角中心 ${state.view.lat.toFixed(1)}°, ${state.view.lng.toFixed(1)}°`
    ].map((item) => `<span class="chip">${esc(item)}</span>`).join("");

    const gridLines = [];
    for (let i = 0; i <= 4; i += 1) {
      const x = plotBox.left + (i / 4) * (plotBox.right - plotBox.left);
      const y = plotBox.top + (i / 4) * (plotBox.bottom - plotBox.top);
      gridLines.push(`<line class="region-grid-line" x1="${x}" y1="${plotBox.top}" x2="${x}" y2="${plotBox.bottom}" />`);
      gridLines.push(`<line class="region-grid-line" x1="${plotBox.left}" y1="${y}" x2="${plotBox.right}" y2="${y}" />`);
    }

    const linkHtml = model.links.map((link) => {
      const source = projected.get(link.source.key);
      const target = projected.get(link.target.key);
      if (!source || !target) return "";
      const color = stageColor(link.source.stage);
      const relatedToHover = hoverKey && (link.source.key === hoverKey || link.target.key === hoverKey);
      const widthValue = hoverKey
        ? (relatedToHover ? Math.max(link.selected ? 3.8 : clamp(1.2 + (link.tx.sourceCount || 0) * 0.2, 1.2, 3), 2.8) : 1)
        : (link.selected ? 3.8 : clamp(1.2 + (link.tx.sourceCount || 0) * 0.2, 1.2, 3));
      const strokeOpacity = hoverKey
        ? (relatedToHover ? (link.selected ? 1 : 0.96) : 0.08)
        : (link.selected ? 0.96 : 0.48);
      return `
        <path
          class="chain-edge${relatedToHover ? " is-active" : ""}"
          data-tx="${esc(link.id)}"
          d="M ${source.x} ${source.y} L ${target.x} ${target.y}"
          stroke="${color}"
          stroke-width="${widthValue}"
          stroke-opacity="${strokeOpacity}"
        >
          <title>${esc(entityTitle(link.source.entityId, link.source.chainName || link.source.name))} → ${esc(entityTitle(link.target.entityId, link.target.chainName || link.target.name))}&#10;${esc(displayStage(link.source.stage))} → ${esc(displayStage(link.target.stage))}</title>
        </path>
      `;
    }).join("");

    const orderedPoints = [...model.points].sort((a, b) =>
      Number(Boolean(a.key === hoverKey)) - Number(Boolean(b.key === hoverKey))
      || Number(Boolean(labelLayout.has(a.key))) - Number(Boolean(labelLayout.has(b.key)))
      || Number(Boolean(a.selected)) - Number(Boolean(b.selected))
      || a.weight - b.weight
    );

    const pointHtml = orderedPoints.map((point) => {
      const p = projected.get(point.key);
      if (!p) return "";
      const color = stageColor(point.dominantStage);
      const isActive = Boolean(hoverKey && point.key === hoverKey);
      const dimmed = Boolean(hoverKey && !isActive);
      const radius = point.selected ? 8.5 : clamp(4 + point.weight * 0.22, 4.5, 7.5);
      const labelInfo = labelLayout.get(point.key);
      const label = labelInfo
        ? `
          <g class="region-label-item${isActive ? " is-active" : ""}" data-entity="${esc(point.entityId || "")}" data-region-key="${esc(point.key)}" opacity="${dimmed ? 0.24 : 1}">
            <rect
              class="region-label-chip"
              x="${labelInfo.rectX}"
              y="${labelInfo.rectY}"
              width="${labelInfo.rectWidth}"
              height="${labelInfo.rectHeight}"
              rx="8"
              stroke-width="${isActive ? 1.6 : 1}"
              stroke="${isActive ? withAlpha(color, "e8") : "rgba(122, 190, 255, 0.14)"}"
              fill="${isActive ? "rgba(14, 37, 62, 0.98)" : "rgba(6, 15, 27, 0.82)"}"
            />
            <circle cx="${labelInfo.dotX}" cy="${labelInfo.dotY}" r="${isActive ? 5.2 : 4}" fill="${labelInfo.color}" stroke="${isActive ? "#ffffff" : "none"}" stroke-width="${isActive ? 1.2 : 0}" />
            <line
              class="region-label-line${labelInfo.crowded ? " is-crowded" : ""}"
              x1="${p.x}"
              y1="${p.y}"
              x2="${labelInfo.bendX}"
              y2="${p.y}"
              stroke="${withAlpha(color, isActive ? "f0" : "76")}"
              stroke-width="${isActive ? 1.5 : 0.9}"
            />
            <line
              class="region-label-line${labelInfo.crowded ? " is-crowded" : ""}"
              x1="${labelInfo.bendX}"
              y1="${p.y}"
              x2="${labelInfo.lineEndX}"
              y2="${labelInfo.labelY - 5}"
              stroke="${withAlpha(color, isActive ? "f0" : (labelInfo.crowded ? "a8" : "76"))}"
              stroke-width="${isActive ? 1.5 : (labelInfo.crowded ? 1.05 : 0.88)}"
            />
            <text class="chart-label region-point-label" x="${labelInfo.textX}" y="${labelInfo.labelY}" text-anchor="${labelInfo.anchor}" font-size="${labelFont}" fill="${isActive ? "#f4fbff" : "#e4f3ff"}">${esc(labelInfo.text)}</text>
          </g>
        `
        : "";
      return `
        <g class="region-node${isActive ? " is-active" : ""}" data-entity="${esc(point.entityId || "")}" data-region-key="${esc(point.key)}" opacity="${dimmed ? 0.22 : 1}">
          <circle cx="${p.x}" cy="${p.y}" r="${radius + (isActive ? 7 : 4)}" fill="${withAlpha(color, isActive ? "40" : "1f")}" />
          <circle cx="${p.x}" cy="${p.y}" r="${isActive ? radius + 1.35 : radius}" fill="${color}" stroke="${isActive ? "#ffffff" : (point.selected ? "#ffffff" : "rgba(255,255,255,.32)")}" stroke-width="${isActive ? 2.8 : (point.selected ? 2 : 1.1)}" />
          <title>${esc(point.chainName || point.name)}&#10;${esc(displayStage(point.dominantStage))} | ${esc(displayCountry(point.country))}&#10;${esc(safeText(point.place, "未标注地点"))}</title>
          ${label}
        </g>
      `;
    }).join("");

    svg.innerHTML = `
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(3,9,17,.34)"></rect>
      <rect x="${plotBox.left}" y="${plotBox.top}" width="${plotBox.right - plotBox.left}" height="${plotBox.bottom - plotBox.top}" rx="18" fill="rgba(5, 12, 22, .26)" stroke="rgba(110,198,255,.08)" stroke-width="1"></rect>
      <rect x="${labelPanel.left}" y="${labelPanel.top}" width="${labelPanel.right - labelPanel.left}" height="${labelPanel.bottom - labelPanel.top}" rx="16" fill="rgba(5, 12, 22, .18)" stroke="rgba(110,198,255,.08)" stroke-width="1"></rect>
      <text class="chart-sub-label" x="${labelPanel.left + 14}" y="${labelPanel.top + 20}" font-size="${metaFont}">重点实体标签</text>
      ${panelHeaderHtml}
      ${gridLines.join("")}
      ${linkHtml}
      ${pointHtml}
      <text class="chart-sub-label" x="${paddingX}" y="${height - 14}" font-size="${metaFont}">说明：点击节点查看实体，点击连线查看关系证据。</text>
    `;
  }

  function buildChainModel(context, options = {}) {
    const { fullscreen = false, visibleStages = null } = options;
    const seedTxs = context.mode === "entity" || context.mode === "transaction"
      ? (context.entity ? context.chainFocus : context.focus)
      : (cameraFocusedTransactions(context.base, cameraRadiusKm(state.view.altitude, 0.9)).length
          ? cameraFocusedTransactions(context.base, cameraRadiusKm(state.view.altitude, 0.9))
          : context.focus);

    if (!seedTxs.length) return { nodes: [], edges: [], stages: [] };

    const nodeMap = new Map();
    const edgeMap = new Map();
    const limit = context.entity ? Math.max(seedTxs.length, 1) : 120;
    const stride = seedTxs.length > limit ? Math.ceil(seedTxs.length / limit) : 1;

    seedTxs.forEach((tx, index) => {
      const selected = tx.id === state.selectedTxId;
      if (index % stride && !selected) return;

      const source = sideNodeFromTx(tx, "source");
      const target = sideNodeFromTx(tx, "target");
      const sourceKey = `${source.chainKey || source.key}::${source.stage}`;
      const targetKey = `${target.chainKey || target.key}::${target.stage}`;

      if (!nodeMap.has(sourceKey)) {
        nodeMap.set(sourceKey, {
          ...source,
          entityId: source.chainEntityId || source.entityId,
          name: source.chainName || source.name,
          graphKey: sourceKey,
          count: 0,
          selected: false
        });
      }
      if (!nodeMap.has(targetKey)) {
        nodeMap.set(targetKey, {
          ...target,
          entityId: target.chainEntityId || target.entityId,
          name: target.chainName || target.name,
          graphKey: targetKey,
          count: 0,
          selected: false
        });
      }

      nodeMap.get(sourceKey).count += 1;
      nodeMap.get(targetKey).count += 1;
      nodeMap.get(sourceKey).selected = nodeMap.get(sourceKey).selected || matchesSelectedEntity(source);
      nodeMap.get(targetKey).selected = nodeMap.get(targetKey).selected || matchesSelectedEntity(target);

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

    const allStages = stageOrder.filter((stage) => stageBuckets.has(stage));
    const visibleStageSet = visibleStages?.length ? new Set(visibleStages) : null;
    const stageLimit = context.entity ? 16 : 5;
    const keepKeys = new Set();
    const stages = allStages.filter((stage) => !visibleStageSet || visibleStageSet.has(stage));
    if (Number.isFinite(stageLimit)) {
      stages.forEach((stage) => {
        const bucket = stageBuckets.get(stage)
          .sort((a, b) => Number(b.selected) - Number(a.selected) || b.count - a.count || a.name.localeCompare(b.name, "en"))
          .slice(0, stageLimit);
        bucket.forEach((node) => keepKeys.add(node.graphKey));
      });
    } else {
      [...nodeMap.values()].forEach((node) => keepKeys.add(node.graphKey));
    }

    const nodes = [...nodeMap.values()]
      .filter((node) => keepKeys.has(node.graphKey))
      .sort((a, b) =>
        stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage)
        || Number(b.selected) - Number(a.selected)
        || b.count - a.count
        || a.name.localeCompare(b.name, "en"));
    const edges = [...edgeMap.values()].filter((edge) => keepKeys.has(edge.sourceKey) && keepKeys.has(edge.targetKey));
    const stageCounts = new Map(allStages.map((stage) => [stage, (stageBuckets.get(stage) || []).length]));
    return { nodes, edges, stages, allStages, stageCounts };
  }

  function renderChainInto(context, options = {}) {
    const {
      svgId = "chainSvg",
      metaId = "chainMeta",
      captionId = "chainCaption",
      fullscreen = false
    } = options;

    const model = buildChainModel(context, {
      fullscreen,
      visibleStages: fullscreen ? state.chainFullVisibleStages : null
    });
    const svg = byId(svgId);
    if (!svg) return;
    const scroll = fullscreen ? byId("chainFullScroll") : byId("chainScroll");

    const baseViewport = getSvgViewport(svg, fullscreen ? 1680 : 980, fullscreen ? 760 : 320);
    const width = context.entity
      ? Math.max(baseViewport.width, (fullscreen ? 198 : 220) * Math.max(model.stages.length, 6) + (fullscreen ? 260 : 220))
      : Math.max(baseViewport.width, fullscreen ? 1720 : 1320);
    const stageCounts = model.stages.map((stage) => model.nodes.filter((node) => node.stage === stage).length);
    const maxStageNodes = Math.max(1, ...stageCounts);
    const height = context.entity
      ? Math.max(baseViewport.height, clamp((fullscreen ? 320 : 240) + maxStageNodes * (fullscreen ? 104 : 78), fullscreen ? 1180 : 420, fullscreen ? 3600 : 1760))
      : Math.max(baseViewport.height, fullscreen ? 720 : 320);
    const stageFont = fullscreen
      ? clamp(Math.round(height * 0.032), 18, 30)
      : clamp(Math.round(height * 0.05), 12, 16);
    const nodeFont = fullscreen
      ? clamp(Math.round(height * 0.018), 14, 18)
      : clamp(Math.round(height * 0.04), 11, 14);
    const metaFont = clamp(Math.round(height * 0.034), 10, 12);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    if (!model.nodes.length) {
      if (byId(captionId)) byId(captionId).textContent = "当前焦点下没有可展开的知识图谱结构。";
      svg.innerHTML = `<foreignObject x="18" y="20" width="${width - 36}" height="${Math.max(200, height - 40)}"><div xmlns="http://www.w3.org/1999/xhtml" class="empty-state">请先锁定一个企业、矿点或关系，再查看按供应链环节展开的知识图谱。</div></foreignObject>`;
      return;
    }

    const stageNodes = new Map();
    model.stages.forEach((stage) => stageNodes.set(stage, model.nodes.filter((node) => node.stage === stage)));
    const xPadding = fullscreen ? 96 : 92;
    const top = fullscreen ? 138 : 92;
    const bottom = fullscreen ? 134 : 78;
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
          y: nodes.length > 1 ? top + step * index : top + usableHeight / 2,
          laneIndex: 0,
          laneOffset: 0,
          rowIndex: index,
          stageIndex
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
      const widthValue = edge.selected ? 4.8 : clamp(1.3 + edge.count * 0.35, 1.4, 4.2);
      return `
        <path
          class="chain-edge"
          data-tx="${esc(edge.txId)}"
          d="M ${source.x} ${source.y} C ${curveX} ${source.y}, ${curveX} ${target.y}, ${target.x} ${target.y}"
          stroke="${color}"
          stroke-width="${widthValue}"
          stroke-opacity="${edge.selected ? 0.98 : 0.58}"
        >
          <title>${esc(source.name)} → ${esc(target.name)}&#10;${esc(displayStage(source.stage))} → ${esc(displayStage(target.stage))}&#10;关系数：${fmt.format(edge.count)}</title>
        </path>
      `;
    }).join("");

    const nodeHtml = [...positioned.values()].map((node) => {
      const color = stageColor(node.stage);
      const outerRadius = fullscreen ? (node.selected ? 22 : 13.5) : (node.selected ? 24 : 15);
      const haloRadius = fullscreen ? (node.selected ? 31 : 17.5) : (node.selected ? 33 : 19);
      const coreRadius = fullscreen ? (node.selected ? 8.6 : 5.4) : (node.selected ? 9.5 : 6.2);
      const labelColor = node.selected ? "#ff5f5f" : "#eaf5ff";
      const labelFont = node.selected ? nodeFont + (fullscreen ? 3 : 4) : nodeFont;
      const labelOffset = node.selected ? 30 : 24;
      const labelAnchor = "middle";
      const displayLabel = shortText(node.name, fullscreen ? 18 : (context.entity ? 24 : 18));
      const labelX = node.x;
      const labelY = node.y - labelOffset;
      const hoverAnchor = node.stageIndex >= model.stages.length / 2 ? "end" : "start";
      const hoverLabel = compactLabelText(node.name || displayLabel);
      const hoverFont = node.selected ? labelFont + 1 : labelFont;
      const hoverWidth = fullscreen ? estimateLabelWidth(hoverLabel, hoverFont, 26) : 0;
      const hoverHeight = fullscreen ? Math.max(28, Math.round(hoverFont + 12)) : 0;
      const hoverX = fullscreen
        ? (hoverAnchor === "start" ? node.x + 22 : node.x - 22)
        : 0;
      const hoverY = fullscreen
        ? clamp(node.y - 8, top + hoverHeight / 2, height - bottom - hoverHeight / 2)
        : 0;
      const hoverBoxX = fullscreen
        ? (hoverAnchor === "start" ? hoverX - 12 : hoverX - hoverWidth + 12)
        : 0;
      const hoverBoxY = fullscreen ? Math.round(hoverY - hoverHeight / 2 - 1) : 0;
      return `
        <g class="chain-node${node.selected ? " is-selected" : ""}" data-entity="${esc(node.entityId || "")}" data-stage="${esc(node.stage || "")}">
          <circle cx="${node.x}" cy="${node.y}" r="${haloRadius}" fill="${withAlpha(node.selected ? "#ff6a6a" : color, node.selected ? "16" : "0c")}"></circle>
          <circle cx="${node.x}" cy="${node.y}" r="${outerRadius}" fill="${withAlpha(color, node.selected ? "2d" : "22")}" stroke="${node.selected ? "#ff8b8b" : color}" stroke-width="${node.selected ? 2.8 : 1.2}"></circle>
          <circle cx="${node.x}" cy="${node.y}" r="${coreRadius}" fill="${node.selected ? "#ff6262" : color}" stroke="${node.selected ? "#fff7f7" : "none"}" stroke-width="${node.selected ? 2.2 : 1.6}"></circle>
          <text class="chart-label${fullscreen ? " chain-node-label" : ""}" x="${labelX}" y="${labelY}" text-anchor="${labelAnchor}" font-size="${labelFont}" fill="${labelColor}" font-weight="${node.selected ? 800 : 700}">${esc(displayLabel)}</text>
          ${fullscreen ? `
            <g class="chain-hover-label">
              <rect class="chain-hover-chip" x="${hoverBoxX}" y="${hoverBoxY}" width="${hoverWidth}" height="${hoverHeight}" rx="${Math.round(hoverHeight / 2)}"></rect>
              <text class="chart-label chain-hover-text" x="${hoverX}" y="${hoverY}" text-anchor="${hoverAnchor}" font-size="${hoverFont}" fill="${labelColor}" font-weight="${node.selected ? 800 : 700}">${esc(hoverLabel)}</text>
            </g>
          ` : ""}
          <title>${esc(node.name)}&#10;${esc(displayStage(node.stage))} | ${esc(displayCountry(node.country))}&#10;${esc(safeText(node.place, "未标注地点"))}</title>
        </g>
      `;
    }).join("");

    if (byId(metaId)) byId(metaId).textContent = context.entity
      ? (context.chainStage
          ? `当前锁定：${activeChainSelectionLabel(context)}`
          : `围绕 ${entityTitle(context.entity.id, context.entity.name)} 展开的全流程上下游链条`)
      : (context.mode === "camera" ? "当前视角区域内的多类别节点关系" : "按供应链环节分层展开");
    if (byId(captionId)) {
      byId(captionId).textContent = fullscreen
        ? (context.chainStage
            ? `当前全屏仅显示 ${activeChainSelectionLabel(context)} 对应的专属上下游链。可用鼠标滚轮缩放、按住拖动画布。`
            : `全屏图谱会尽量保留完整链条节点与关系。可用鼠标滚轮缩放、按住拖动画布，也可以通过上方阶段按钮折叠或展开指定环节。`)
        : (context.entity
            ? (context.chainStage
                ? `当前图谱仅保留 ${activeChainSelectionLabel(context)} 这一个阶段节点的真实上下游链路。`
                : `当前图谱保留该实体可追踪的上下游主链路。被搜索节点会以更大的红色名称与节点高亮显示，方便快速定位其所处环节。`)
            : `当前图谱共展示 ${fmt.format(model.nodes.length)} 个节点、${fmt.format(model.edges.length)} 条关系。节点颜色代表所属环节类别，点击节点或连线可继续钻取。`);
    }

    let zoom = 1;
    if (fullscreen && scroll) {
      const fitWidth = Math.max(0.22, (scroll.clientWidth - 32) / width);
      const fitHeight = Math.max(0.22, (scroll.clientHeight - 32) / height);
      const fitZoom = clamp(Math.min(context.entity ? fitWidth : Math.min(fitWidth, fitHeight), 1), 0.22, 1);
      if (state.chainFullZoomMode === "fit" || !Number.isFinite(state.chainFullZoom) || state.chainFullZoom <= 0) {
        state.chainFullZoom = fitZoom;
      }
      zoom = state.chainFullZoom;
    }

    const renderedWidth = Math.round(width * zoom);
    const renderedHeight = Math.round(height * zoom);
    svg.style.width = `${renderedWidth}px`;
    svg.style.height = `${renderedHeight}px`;
    svg.innerHTML = `
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(3,9,17,.32)"></rect>
      ${stageGuides}
      ${edgeHtml}
      ${nodeHtml}
      <text class="chart-sub-label" x="${xPadding}" y="${height - 12}" font-size="${metaFont}">说明：颜色表示环节类别；点击节点或连线可在右侧与证据链中联动。</text>
    `;
    bindChainHover(svgId);

    if (fullscreen) {
      updateChainZoomLabel();
      if (scroll && (state.chainFullZoomMode === "fit")) {
        scroll.scrollLeft = 0;
        scroll.scrollTop = 0;
      }
    }

    return model;
  }

  function renderChain(context) {
    renderChainInto(context, {
      svgId: "chainSvg",
      metaId: "chainMeta",
      captionId: "chainCaption",
      fullscreen: false
    });
    if (state.chainOpen) {
      const fullModel = renderChainInto(context, {
        svgId: "chainFullSvg",
        metaId: "chainFullMeta",
        captionId: "chainFullCaption",
        fullscreen: true
      });
      renderChainStageFilters(fullModel);
    }
  }

  function renderChainStageFilters(model) {
    const host = byId("chainStageFilters");
    if (!host || !model) return;
    const activeSet = new Set((state.chainFullVisibleStages?.length ? state.chainFullVisibleStages : model.allStages) || []);
    host.innerHTML = model.allStages.map((stage) => {
      const active = activeSet.has(stage);
      const count = model.stageCounts?.get(stage) || 0;
      return `
        <button
          class="stage-toggle-btn ${active ? "" : "is-off"}"
          type="button"
          data-stage="${esc(stage)}"
          aria-pressed="${active ? "true" : "false"}"
          title="${active ? "点击隐藏该环节" : "点击显示该环节"}"
        >
          <span class="stage-toggle-dot" style="--dot:${stageColor(stage)}"></span>
          <span>${esc(displayStage(stage))}</span>
          <span class="meta">${fmt.format(count)}</span>
        </button>
      `;
    }).join("");
  }

  function buildHierarchyGroups(entity, list, direction) {
    const groups = new Map();
    const scope = graphSeedEntityIds(entity.id);
    list.forEach((tx) => {
      let include = false;
      let stage = "";
      let counterpartId = "";
      let counterpartName = "";
      let counterpartCountry = "";
      let route = "";

      if (direction === "upstream" && (scope.has(tx.buyerCompanyId) || scope.has(tx.buyerFacilityId))) {
        include = true;
        stage = tx.supplierStage;
        counterpartId = tx.supplierFacilityId || tx.supplierCompanyId || "";
        counterpartName = entityTitle(counterpartId, tx.supplierCompany || tx.supplierFacility);
        counterpartCountry = tx.supplierCountry;
        route = `${displayStage(tx.supplierStage)} → ${displayStage(tx.buyerStage)}`;
      }

      if (direction === "downstream" && (scope.has(tx.supplierCompanyId) || scope.has(tx.supplierFacilityId))) {
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
    byId("hierarchyMeta").textContent = `围绕 ${entityTitle(context.entity.id, context.entity.name)} 展开`;
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
        entry.selected = entry.selected || matchesSelectedEntity(point);
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

  function topOverlayInsetPx() {
    return [".topbar", ".search-panel", ".info-panel"].reduce((maxBottom, selector) => {
      const element = document.querySelector(selector);
      if (!element) return maxBottom;
      const style = window.getComputedStyle(element);
      if (!["fixed", "absolute"].includes(style.position)) return maxBottom;
      return Math.max(maxBottom, Math.round(element.getBoundingClientRect().bottom));
    }, 24);
  }

  function bottomOverlayInsetPx() {
    const dock = document.querySelector(".dock");
    if (!dock) return 0;
    const style = window.getComputedStyle(dock);
    if (!["fixed", "absolute"].includes(style.position)) return 0;
    const rect = dock.getBoundingClientRect();
    return Math.max(0, Math.round(window.innerHeight - rect.top));
  }

  function globeViewportOffset() {
    const width = globeHost?.clientWidth || window.innerWidth;
    const height = globeHost?.clientHeight || window.innerHeight;
    if (width < 1180 || height < 760) return [0, 0];
    const bottomInset = bottomOverlayInsetPx();
    if (!bottomInset) return [0, 0];
    const desiredCenterY = clamp(height / 2 - bottomInset * 0.38, height * 0.23, height * 0.39);
    return [0, Math.round(desiredCenterY - height / 2)];
  }

  function applyGlobeLayoutOffset() {
    const [, offsetY] = globeViewportOffset();
    document.documentElement.style.setProperty("--globe-offset-y", `${offsetY}px`);
    if (!globe || typeof globe.globeOffset !== "function") return;
    globe.globeOffset([0, offsetY]);
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
        applyGlobeLayoutOffset();
      }).observe(globeHost);

      applyGlobeLayoutOffset();
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
      applyGlobeLayoutOffset();
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
      if (controls) controls.autoRotate = state.autoRotate && !state.selectedEntityId && !state.selectedTxId && !state.regionOpen;

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
    const stageLocked = Boolean(context.entity && context.chainStage);
    byId("queryMeta").textContent = context.entity
      ? (context.chainStage
          ? `当前锁定：${activeChainSelectionLabel(context)}`
          : `已锁定：${entityTitle(context.entity.id, context.entity.name)}`)
      : (context.mode === "camera" ? "当前视角区域" : "全链路视角");
    byId("queryMeta").classList.toggle("is-stage-locked", stageLocked);
    byId("statusText").textContent = context.entity
      ? (context.chainStage
          ? `当前显示 ${activeChainSelectionLabel(context)} 的专属链条，共 ${fmt.format(context.chainFocus.length)} 条关系`
          : `围绕 ${entityTitle(context.entity.id, context.entity.name)} 显示 ${fmt.format(context.focus.length)} 条关系`)
      : `当前显示 ${fmt.format(context.focus.length)} 条关系`;
    byId("statusText").classList.toggle("is-stage-locked", stageLocked);
    byId("chainMeta").classList.toggle("is-stage-locked", stageLocked);

    byId("chips").innerHTML = [
      `关系 ${fmt.format(context.focus.length)}`,
      `视角 ${state.view.lat.toFixed(1)}°, ${state.view.lng.toFixed(1)}°`,
      `影像 ${TEXTURES[state.texture].label}`,
      state.stage !== "all" ? `环节 ${displayStage(state.stage)}` : "",
      context.entity ? `实体 ${entityTitle(context.entity.id, context.entity.name)}` : "",
      context.chainStage ? `阶段锁定 ${displayStage(context.chainStage)}` : "",
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

  function selectEntity(entityId, options = {}) {
    const { chainStage = "" } = options;
    state.selectedEntityId = entityId || "";
    state.selectedChainStage = entityId ? String(chainStage || "") : "";
    const base = stageFilteredTransactions();
    const related = entityId
      ? entityFocusedTransactions(base, entityId).filter((tx) => {
          if (!state.selectedChainStage) return true;
          return (txSideMatchesEntity(tx, "supplier", entityId) && tx.supplierStage === state.selectedChainStage)
            || (txSideMatchesEntity(tx, "buyer", entityId) && tx.buyerStage === state.selectedChainStage);
        })
      : [];
    state.selectedTxId = related[0]?.id || "";
    state.evidenceOpen = Boolean(entityId);
    renderAll({ recenter: true, updateGlobe: true });
  }

  function selectChainEntity(entityId, chainStage = "") {
    selectEntity(entityId, { chainStage });
  }

  function selectTransaction(txId) {
    if (!txById.has(txId)) return;
    state.selectedTxId = txId;
    renderAll({ recenter: true, updateGlobe: true });
  }

  function resetAll() {
    state.selectedEntityId = "";
    state.selectedChainStage = "";
    state.selectedTxId = "";
    state.evidenceOpen = false;
    state.chainOpen = false;
    state.regionOpen = false;
    state.stage = "all";
    state.labels = true;
    state.dense = false;
    state.autoRotate = true;
    state.view = { lat: 16, lng: 102, altitude: 3.08 };
    byId("searchInput").value = "";
    byId("stageSelect").value = "all";
    byId("labelsBtn").classList.add("is-on");
    byId("densityBtn").classList.remove("is-on");
    byId("rotateBtn").classList.add("is-on");
    setEvidenceVisibility(false);
    setChainVisibility(false);
    setRegionVisibility(false);
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

  const regionHoverHandler = (event) => {
    setRegionHover(regionHoverKeyFromPointer(event));
  };

  byId("regionSvg").addEventListener("mouseover", regionHoverHandler);
  byId("regionSvg").addEventListener("mousemove", regionHoverHandler);

  byId("regionSvg").addEventListener("mouseleave", () => {
    setRegionHover("");
  });

  byId("chainSvg").addEventListener("click", (event) => {
    const txNode = event.target.closest("[data-tx]");
    if (txNode) {
      selectTransaction(txNode.dataset.tx);
      return;
    }
    const entityNode = event.target.closest("[data-entity]");
    if (entityNode && entityNode.dataset.entity) selectChainEntity(entityNode.dataset.entity, entityNode.dataset.stage || "");
  });

  byId("chainFullSvg").addEventListener("click", (event) => {
    const txNode = event.target.closest("[data-tx]");
    if (txNode) {
      selectTransaction(txNode.dataset.tx);
      return;
    }
    const entityNode = event.target.closest("[data-entity]");
    if (entityNode && entityNode.dataset.entity) selectChainEntity(entityNode.dataset.entity, entityNode.dataset.stage || "");
  });

  byId("chainStageFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-stage]");
    if (!button) return;
    const stage = button.dataset.stage;
    const current = new Set(state.chainFullVisibleStages);
    const isExplicit = current.size > 0;
    const available = new Set(stageOrder);
    const working = isExplicit ? current : available;
    if (working.has(stage)) {
      working.delete(stage);
    } else {
      working.add(stage);
    }
    state.chainFullVisibleStages = [...working].filter((item) => stageOrder.includes(item));
    renderChain(computeContext());
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
    state.chainOpen = false;
    state.regionOpen = false;
    byId("searchInput").value = "";
    setEvidenceVisibility(false);
    setChainVisibility(false);
    setRegionVisibility(false);
    renderAll({ recenter: false, updateGlobe: true });
  });

  byId("openEvidenceBtn").addEventListener("click", () => {
    if (!currentEntity()) return;
    setEvidenceVisibility(!state.evidenceOpen);
  });

  byId("chainDragHandle").addEventListener("click", () => {
    setEvidenceVisibility(false);
    setChainVisibility(true);
  });

  byId("chainZoomInBtn").addEventListener("click", () => {
    setChainFullZoom((state.chainFullZoom || 1) * 1.18, "manual");
    renderChain(computeContext());
  });

  byId("chainZoomOutBtn").addEventListener("click", () => {
    setChainFullZoom((state.chainFullZoom || 1) / 1.18, "manual");
    renderChain(computeContext());
  });

  byId("chainZoomFitBtn").addEventListener("click", () => {
    state.chainFullZoomMode = "fit";
    renderChain(computeContext());
  });

  byId("chainStageResetBtn").addEventListener("click", () => {
    state.chainFullVisibleStages = [];
    state.chainFullZoomMode = "fit";
    renderChain(computeContext());
  });

  byId("closeEvidenceBtn").addEventListener("click", () => {
    setEvidenceVisibility(false);
  });

  byId("closeChainBtn").addEventListener("click", () => {
    setChainVisibility(false);
  });

  byId("evidenceBackdrop").addEventListener("click", () => {
    setEvidenceVisibility(false);
  });

  byId("chainBackdrop").addEventListener("click", () => {
    setChainVisibility(false);
  });

  byId("openRegionBtn").addEventListener("click", () => {
    setRegionVisibility(true);
  });

  byId("closeRegionBtn").addEventListener("click", () => {
    setRegionVisibility(false);
  });

  byId("regionBackdrop").addEventListener("click", () => {
    setRegionVisibility(false);
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
    if (state.chainOpen) renderChain(computeContext());
  });

  setupChainFullViewportControls();
  updateChainZoomLabel();

  buildLegend();
  setupFallbackEarth();
  setupFallbackInteraction();
  setGlobeState("fallback", "");
  applyTextureProfile(state.texture).finally(() => renderAll({ recenter: true, updateGlobe: true }));
})();
