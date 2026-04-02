(() => {
const DATA = window.COBALT_GEOSCENE_DATA;
if (!DATA || !Array.isArray(DATA.transactions)) {
  document.body.innerHTML = "<div style='padding:32px;color:#fff;font-family:Segoe UI,Microsoft YaHei,sans-serif'>缺少数据文件，请先运行 scripts/build_cobalt_geoscene_data.ps1。</div>";
  return;
}

const byId = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat("zh-CN");
const toArray = (value) => Array.isArray(value)
  ? value
  : (value && typeof value === "object"
      ? Object.values(value).filter(Boolean)
      : (value === null || value === undefined || value === "" ? [] : [value]));
const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const short = (value, limit = 18) => {
  const text = String(value || "").trim();
  if (!text) return "未命名";
  return text.length > limit ? `${text.slice(0, Math.max(1, limit - 1))}…` : text;
};
const isNum = (value) => Number.isFinite(Number(value));
const entityLabel = (entity) => entity ? (entity.type === "facility" ? (entity.displayName || entity.searchLabel || entity.name) : entity.name) : "全局";
const txAmount = (tx) => tx.amountTonnesRaw || tx.amountUnitsRaw || tx.amountUsdRaw || tx.amountYuanRaw || tx.amountEnergyRaw || "未标注";
const txDate = (tx) => tx.date || tx.expectedDate || "未标注";
const stageOrder = DATA.stageOrder || [];
const stageColors = DATA.stageColors || {};
const stageLookup = new Map(stageOrder.map((stage) => [String(stage).toLowerCase(), stage]));
const FILE_PROTOCOL_HINT = window.location.protocol === "file:"
  ? "如果直接双击打开仍看不到三维地球，请运行 scripts/start_preview_server.ps1，再访问 http://127.0.0.1:8765/cobalt_geoscene_preview.html。"
  : "";
const normalizeStage = (value) => stageLookup.get(String(value || "").toLowerCase()) || value || "Unknown";

const STAGE_LABELS = {
  "Artisanal mining": "手采矿",
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
  southafrica: "南非",
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

const POINT_ORIGIN_LABELS = {
  facility: "设施坐标",
  company: "企业坐标",
  centroid: "区域中心点",
  inferred: "推定坐标"
};

const TEXTURES = {
  balanced: {
    label: "本地流畅版",
    url: "assets/earth_satellite_1350.jpg",
    hint: "使用本地流畅版地球影像，优先保证页面顺滑。"
  },
  sharp: {
    label: "本地高清版",
    url: "assets/earth_satellite_5400.jpg",
    hint: "使用本地高清版地球影像，细节更高。"
  },
  github: {
    label: "GitHub 高清版",
    url: "assets/earth_github_4096.jpg",
    hint: "使用 GitHub 开源项目 live-cloud-maps 的高清地球影像，并已缓存到本地。"
  }
};

const entities = new Map((DATA.entities || []).map((entity) => [
  entity.id,
  {
    ...entity,
    roleTags: toArray(entity.roleTags),
    companyTypeTags: toArray(entity.companyTypeTags)
  }
]));
const sources = new Map((DATA.sources || []).map((source) => [source.id, source]));
const transactions = (DATA.transactions || []).map((tx) => ({
  ...tx,
  supplierStage: normalizeStage(tx.supplierStage),
  buyerStage: normalizeStage(tx.buyerStage),
  inputCommodityIds: toArray(tx.inputCommodityIds),
  inputCommodities: toArray(tx.inputCommodities),
  outputCommodityIds: toArray(tx.outputCommodityIds),
  outputCommodities: toArray(tx.outputCommodities),
  sourceIds: toArray(tx.sourceIds),
  notes: toArray(tx.notes)
}));

const companyTransactions = new Map();
const facilityTransactions = new Map();
const companyFacilities = new Map();
const facilityCompany = new Map();
const pushMap = (map, key, value) => {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
};

(DATA.operatorPairs || []).forEach((pair) => {
  pushMap(companyFacilities, pair.companyId, pair.facilityId);
  if (!facilityCompany.has(pair.facilityId)) facilityCompany.set(pair.facilityId, pair.companyId);
});

transactions.forEach((tx) => {
  pushMap(companyTransactions, tx.supplierCompanyId, tx);
  pushMap(companyTransactions, tx.buyerCompanyId, tx);
  pushMap(facilityTransactions, tx.supplierFacilityId, tx);
  pushMap(facilityTransactions, tx.buyerFacilityId, tx);
});

const searchCatalog = [...entities.values()].map((entity) => {
  const count = entity.type === "company"
    ? (companyTransactions.get(entity.id) || []).length
    : (facilityTransactions.get(entity.id) || []).length;
  return {
    id: entity.id,
    type: entity.type,
    name: entityLabel(entity),
    country: entity.country || "",
    count,
    blob: [entity.name, entity.searchLabel, entity.displayName, entity.place, entity.country, ...entity.roleTags, ...entity.companyTypeTags]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
  };
}).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "en"));

const state = {
  stage: "all",
  entityId: "",
  selectedTxId: "",
  labels: true,
  dense: false,
  rotate: true,
  texture: "balanced",
  pointerX: 0,
  pointerY: 0,
  card: null,
  textureWarning: "",
  globeNotice: "",
  globeMode: "pending"
};

let globe = null;
const tooltip = byId("tooltip");
const earthFallback = byId("earthFallback");
const earthSphere = earthFallback ? earthFallback.querySelector(".earth-sphere") : null;

function displayStage(stage) {
  return STAGE_LABELS[stage] || stage || "未标注";
}

function displayCountry(country) {
  const raw = String(country || "").trim();
  if (!raw) return "未标注";
  return COUNTRY_LABELS.get(raw.toLowerCase()) || raw;
}

function displayEntityType(type) {
  return type === "company" ? "企业" : "设施";
}

function displayPointOrigin(origin) {
  return POINT_ORIGIN_LABELS[String(origin || "").toLowerCase()] || (origin || "未标注");
}

function displayFacilityType(value) {
  let text = String(value || "").trim();
  if (!text) return "";
  const replacements = [
    [/Headquarter/gi, "总部"],
    [/Battery pack plant/gi, "电池包装配厂"],
    [/Battery cell plant/gi, "电芯工厂"],
    [/Battery plant/gi, "电池工厂"],
    [/Electric car plant/gi, "电动汽车工厂"],
    [/Electric scooter plant/gi, "电动两轮工厂"],
    [/Cathode Plant/gi, "正极材料厂"],
    [/Precursor Plant/gi, "前驱体工厂"],
    [/Refinery/gi, "精炼厂"],
    [/Smelter/gi, "冶炼厂"],
    [/Processing plant/gi, "加工厂"],
    [/Battery pack/gi, "电池包"],
    [/Mine/gi, "矿点"],
    [/Port/gi, "港口"],
    [/Plant/gi, "工厂"],
    [/Factory/gi, "工厂"],
    [/Office/gi, "办公室"]
  ];
  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return text;
}

function currentEntity() {
  return state.entityId ? entities.get(state.entityId) || null : null;
}

function stageFilteredTransactions() {
  if (state.stage === "all") return transactions;
  return transactions.filter((tx) => tx.supplierStage === state.stage || tx.buyerStage === state.stage);
}

function focusedTransactions() {
  const base = stageFilteredTransactions();
  if (!state.entityId) return base;
  const entity = currentEntity();
  if (!entity) return base;
  const set = new Set();
  if (entity.type === "company") {
    (companyTransactions.get(entity.id) || []).forEach((tx) => set.add(tx.id));
    (companyFacilities.get(entity.id) || []).forEach((facilityId) => {
      (facilityTransactions.get(facilityId) || []).forEach((tx) => set.add(tx.id));
    });
  } else {
    (facilityTransactions.get(entity.id) || []).forEach((tx) => set.add(tx.id));
    const ownerId = facilityCompany.get(entity.id);
    if (ownerId) (companyTransactions.get(ownerId) || []).forEach((tx) => set.add(tx.id));
  }
  const out = base.filter((tx) => set.has(tx.id));
  return out.length ? out : base.filter((tx) => [tx.supplierCompanyId, tx.buyerCompanyId, tx.supplierFacilityId, tx.buyerFacilityId].includes(entity.id));
}

function transactionById(id) {
  return transactions.find((tx) => tx.id === id) || null;
}

function sourceLinkList(tx) {
  return tx.sourceIds.slice(0, 4).map((id) => sources.get(id)).filter(Boolean);
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
  root.style.setProperty("--earth-image-position", "18% 50%");
}

function setGlobeState(mode, notice = "") {
  state.globeMode = mode;
  state.globeNotice = notice;
  document.body.classList.toggle("globe-ready", mode === "webgl");
  document.body.classList.toggle("globe-fallback", mode !== "webgl");
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

function setCard(type, id) {
  state.card = type && id ? { type, id } : null;
  renderCard();
}

function selectEntity(entityId) {
  state.entityId = entityId || "";
  state.selectedTxId = "";
  if (state.entityId) setCard("entity", state.entityId);
  else setCard(null, null);
  render();
}

function selectTransaction(txId) {
  const tx = transactionById(txId);
  if (!tx) return;
  state.selectedTxId = txId;
  setCard("tx", txId);
}

function renderResults() {
  const query = byId("searchInput").value.trim().toLowerCase();
  const items = (query ? searchCatalog.filter((item) => item.blob.includes(query)) : searchCatalog).slice(0, 8);
  byId("results").innerHTML = items.map((item) => `
    <button class="result-item" data-entity="${esc(item.id)}">
      <div>
        <div class="result-name">${esc(short(item.name, 34))}</div>
        <div class="result-meta">${esc(displayCountry(item.country))} · ${fmt.format(item.count)} 条关联关系</div>
      </div>
      <span class="tag">${item.type === "company" ? "企业" : "设施"}</span>
    </button>
  `).join("") || "<div class='result-meta'>没有匹配结果。</div>";
}

function renderDetail(focus) {
  const entity = currentEntity();
  byId("detailMeta").textContent = entity ? "实体聚焦" : "全局概览";

  if (!entity) {
    byId("detailBody").innerHTML = `
      <h2 class="card-title">钴全球供应链图谱</h2>
      <div class="card-sub">当前预览把企业、设施、商品、证据链接和交易关系整合到了一个可搜索、可钻取的空间图谱视图中。</div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-key">交易关系</div><div class="stat-value">${fmt.format(DATA.meta.transactions)}</div></div>
        <div class="stat-card"><div class="stat-key">企业数量</div><div class="stat-value">${fmt.format(DATA.meta.companies)}</div></div>
        <div class="stat-card"><div class="stat-key">设施数量</div><div class="stat-value">${fmt.format(DATA.meta.facilities)}</div></div>
        <div class="stat-card"><div class="stat-key">矿点数量</div><div class="stat-value">${fmt.format(DATA.meta.mines)}</div></div>
      </div>
      <div class="kv-list">
        <div class="kv-row"><span>量级关系覆盖</span><strong>${fmt.format(DATA.gapReport.quantityRecords)} / ${fmt.format(DATA.meta.transactions)}</strong></div>
        <div class="kv-row"><span>时间字段覆盖</span><strong>${fmt.format(DATA.gapReport.dateRecords)} / ${fmt.format(DATA.meta.transactions)}</strong></div>
        <div class="kv-row"><span>产品编码字段</span><strong class="warn">${fmt.format(DATA.gapReport.productCodeRecords)} / ${fmt.format(DATA.meta.transactions)}</strong></div>
        <div class="kv-row"><span>设施图片字段</span><strong class="warn">${fmt.format(DATA.gapReport.imageryRecords)} / ${fmt.format(DATA.meta.facilities)}</strong></div>
      </div>
    `;
    return;
  }

  const focusSet = focus.filter((tx) => [tx.supplierCompanyId, tx.buyerCompanyId, tx.supplierFacilityId, tx.buyerFacilityId].includes(entity.id));
  const upstream = new Set();
  const downstream = new Set();
  const stageSet = new Set();
  const goods = new Set();
  let quantity = 0;
  let dated = 0;
  let sourced = 0;

  focusSet.forEach((tx) => {
    if (tx.supplierCompanyId && tx.supplierCompanyId !== entity.id) upstream.add(tx.supplierCompany);
    if (tx.buyerCompanyId && tx.buyerCompanyId !== entity.id) downstream.add(tx.buyerCompany);
    stageSet.add(tx.supplierStage);
    stageSet.add(tx.buyerStage);
    [...tx.inputCommodities, ...tx.outputCommodities].forEach((value) => goods.add(value));
    if (tx.hasQuantity) quantity += 1;
    if (tx.hasDate) dated += 1;
    if (tx.sourceIds.length) sourced += 1;
  });

  const metaTags = [displayEntityType(entity.type), displayCountry(entity.country || "")];
  const facilityType = displayFacilityType(entity.facilityType);
  if (facilityType) metaTags.push(facilityType);
  byId("detailBody").innerHTML = `
    <h2 class="card-title">${esc(entityLabel(entity))}</h2>
    <div class="card-sub">${esc(metaTags.filter(Boolean).join(" | ") || "暂无补充信息")}</div>
    <div class="kv-list">
      <div class="kv-row"><span>关联交易关系</span><strong>${fmt.format(focusSet.length)}</strong></div>
      <div class="kv-row"><span>上游主体数</span><strong>${fmt.format(upstream.size)}</strong></div>
      <div class="kv-row"><span>下游主体数</span><strong>${fmt.format(downstream.size)}</strong></div>
      <div class="kv-row"><span>运营设施数</span><strong>${fmt.format((companyFacilities.get(entity.id) || []).length)}</strong></div>
      <div class="kv-row"><span>带数量字段</span><strong>${fmt.format(quantity)}</strong></div>
      <div class="kv-row"><span>带证据来源</span><strong>${fmt.format(sourced)}</strong></div>
      <div class="kv-row"><span>带时间字段</span><strong>${fmt.format(dated)}</strong></div>
    </div>
    <div class="field-label" style="margin-top:14px">涉及环节与商品</div>
    <div class="tag-list">
      ${[...stageSet].slice(0, 8).map((value) => `<span class="tag">${esc(displayStage(value))}</span>`).join("")}
      ${[...goods].slice(0, 8).map((value) => `<span class="tag">${esc(short(value, 20))}</span>`).join("") || "<span class='tag'>暂无商品标注</span>"}
    </div>
  `;
}

function renderCard() {
  const card = byId("infoCard");
  const body = byId("cardBody");
  if (!state.card) {
    card.classList.add("is-hidden");
    body.innerHTML = "";
    return;
  }

  if (state.card.type === "entity") {
    const entity = entities.get(state.card.id);
    if (!entity) {
      card.classList.add("is-hidden");
      return;
    }
    const linked = focusedTransactions()
      .filter((tx) => [tx.supplierCompanyId, tx.buyerCompanyId, tx.supplierFacilityId, tx.buyerFacilityId].includes(entity.id))
      .slice(0, 6);
    body.innerHTML = `
      <h2 class="card-title">${esc(entityLabel(entity))}</h2>
      <div class="card-sub">${esc(displayCountry(entity.country || ""))} · ${esc(displayEntityType(entity.type))}${entity.facilityType ? ` · ${esc(displayFacilityType(entity.facilityType))}` : ""}</div>
      <div class="kv-list">
        ${linked.map((tx) => `<div class="kv-row"><span>${esc(short(tx.supplierCompany || tx.supplierFacility, 16))} → ${esc(short(tx.buyerCompany || tx.buyerFacility, 16))}</span><strong><button class="ghost-btn" data-tx="${esc(tx.id)}">查看</button></strong></div>`).join("") || "<div class='subnote'>当前聚焦范围内没有可展示的关系。</div>"}
      </div>
    `;
  } else {
    const tx = transactionById(state.card.id);
    if (!tx) {
      card.classList.add("is-hidden");
      return;
    }
    const links = sourceLinkList(tx);
    body.innerHTML = `
      <h2 class="card-title">${esc(short(tx.supplierCompany || tx.supplierFacility, 32))} → ${esc(short(tx.buyerCompany || tx.buyerFacility, 32))}</h2>
      <div class="card-sub">${esc(displayStage(tx.supplierStage))} → ${esc(displayStage(tx.buyerStage))}</div>
      <div class="kv-list">
        <div class="kv-row"><span>数量/规模</span><strong>${esc(txAmount(tx))}</strong></div>
        <div class="kv-row"><span>时间</span><strong>${esc(txDate(tx))}</strong></div>
        <div class="kv-row"><span>输入商品</span><strong>${esc(tx.inputCommodities.join(", ") || "未标注")}</strong></div>
        <div class="kv-row"><span>输出商品</span><strong>${esc(tx.outputCommodities.join(", ") || "未标注")}</strong></div>
        <div class="kv-row"><span>坐标来源</span><strong>${esc(`${displayPointOrigin(tx.sourcePointOrigin)} → ${displayPointOrigin(tx.targetPointOrigin)}`)}</strong></div>
      </div>
      ${tx.notes.length ? `<div class="field-label" style="margin-top:14px">备注</div><div class="card-sub">${esc(tx.notes.join(" | "))}</div>` : ""}
      ${links.length ? `<div class="field-label" style="margin-top:14px">证据来源</div><div class="link-list">${links.map((src) => `<a class="card-link" href="${esc(src.url)}" target="_blank" rel="noreferrer">${esc(short(src.host || "来源", 18))}</a>`).join("")}</div>` : ""}
    `;
  }

  card.classList.remove("is-hidden");
}

function renderRegion(focus) {
  const svg = byId("regionSvg");
  const caption = byId("regionCaption");
  const sample = focus.slice(0, state.dense ? 48 : 120).filter((tx) => isNum(tx.sourceLat) && isNum(tx.sourceLon) && isNum(tx.targetLat) && isNum(tx.targetLon));
  if (!sample.length) {
    caption.textContent = "当前筛选下没有可用于区域钻取的坐标关系。";
    svg.innerHTML = "";
    return;
  }

  const points = sample.flatMap((tx) => [{ lat: Number(tx.sourceLat), lon: Number(tx.sourceLon) }, { lat: Number(tx.targetLat), lon: Number(tx.targetLon) }]);
  const minLat = Math.min(...points.map((point) => point.lat));
  const maxLat = Math.max(...points.map((point) => point.lat));
  const minLon = Math.min(...points.map((point) => point.lon));
  const maxLon = Math.max(...points.map((point) => point.lon));
  const latPad = Math.max(2, (maxLat - minLat) * 0.12 || 4);
  const lonPad = Math.max(3, (maxLon - minLon) * 0.12 || 6);
  const left = minLon - lonPad;
  const right = maxLon + lonPad;
  const top = maxLat + latPad;
  const bottom = minLat - latPad;
  const project = (lat, lon) => ({
    x: clamp(((lon - left) / Math.max(1e-6, right - left)) * 960, 14, 946),
    y: clamp(((top - lat) / Math.max(1e-6, top - bottom)) * 520, 14, 506)
  });

  caption.textContent = `经度 ${left.toFixed(1)} 至 ${right.toFixed(1)} / 纬度 ${bottom.toFixed(1)} 至 ${top.toFixed(1)} · 共 ${sample.length} 条聚焦关系`;
  const grid = Array.from({ length: 5 }, (_, idx) => {
    const y = 40 + idx * 110;
    return `<line x1="20" y1="${y}" x2="940" y2="${y}" stroke="rgba(107,199,255,.12)" stroke-width="1" />`;
  }).join("") + Array.from({ length: 6 }, (_, idx) => {
    const x = 20 + idx * 184;
    return `<line x1="${x}" y1="20" x2="${x}" y2="500" stroke="rgba(107,199,255,.12)" stroke-width="1" />`;
  }).join("");

  const lineHtml = sample.map((tx) => {
    const a = project(Number(tx.sourceLat), Number(tx.sourceLon));
    const b = project(Number(tx.targetLat), Number(tx.targetLon));
    const focused = state.selectedTxId === tx.id;
    return `<line class="region-line" data-tx="${esc(tx.id)}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${stageColors[tx.supplierStage] || "#7fd0ff"}" stroke-width="${focused ? 3.2 : 1.4}" stroke-opacity="${focused ? 1 : 0.5}" />`;
  }).join("");

  const nodeHtml = sample.flatMap((tx) => {
    const a = project(Number(tx.sourceLat), Number(tx.sourceLon));
    const b = project(Number(tx.targetLat), Number(tx.targetLon));
    return [
      `<circle class="region-node" data-entity="${esc(tx.supplierFacilityId || tx.supplierCompanyId || "")}" cx="${a.x}" cy="${a.y}" r="4.2" fill="${stageColors[tx.supplierStage] || "#7fd0ff"}" />`,
      `<circle class="region-node" data-entity="${esc(tx.buyerFacilityId || tx.buyerCompanyId || "")}" cx="${b.x}" cy="${b.y}" r="4.2" fill="${stageColors[tx.buyerStage] || "#7fd0ff"}" />`
    ];
  }).join("");

  svg.innerHTML = `<rect x="0" y="0" width="960" height="520" rx="18" fill="rgba(3,9,17,.55)" />${grid}${lineHtml}${nodeHtml}`;
}

function renderFlow(focus) {
  const svg = byId("flowSvg");
  const caption = byId("flowCaption");
  if (!focus.length) {
    caption.textContent = "当前筛选下暂无可展示的环节流向。";
    svg.innerHTML = "";
    return;
  }

  const nodes = stageOrder.map((stage, index) => ({
    stage,
    x: 90 + index * (1010 / Math.max(1, stageOrder.length - 1)),
    y: 280,
    count: focus.filter((tx) => tx.supplierStage === stage || tx.buyerStage === stage).length
  })).filter((node) => node.count > 0);

  const pairs = new Map();
  focus.forEach((tx) => {
    const key = `${tx.supplierStage}>${tx.buyerStage}`;
    if (!pairs.has(key)) pairs.set(key, { count: 0, sample: tx });
    pairs.get(key).count += 1;
  });
  caption.textContent = `当前聚焦窗口内共有 ${pairs.size} 种环节流向。点击节点可以直接筛选对应环节。`;

  const pathHtml = [...pairs.entries()].map(([key, value]) => {
    const [from, to] = key.split(">");
    const source = nodes.find((node) => node.stage === from);
    const target = nodes.find((node) => node.stage === to);
    if (!source || !target) return "";
    const cx = (source.x + target.x) / 2;
    const cy = source.y - 120;
    const focused = state.selectedTxId === value.sample.id;
    return `<path class="flow-line" data-tx="${esc(value.sample.id)}" d="M ${source.x} ${source.y} C ${cx} ${cy}, ${cx} ${cy}, ${target.x} ${target.y}" fill="none" stroke="${stageColors[from] || "#7fd0ff"}" stroke-width="${focused ? 3.2 : Math.min(7, 1.4 + value.count / 14)}" stroke-opacity="${focused ? 1 : Math.min(.82, .22 + value.count / 34)}" />`;
  }).join("");

  const nodeHtml = nodes.map((node) => `
    <g>
      <circle class="flow-node" data-stage="${esc(node.stage)}" cx="${node.x}" cy="${node.y}" r="22" fill="${stageColors[node.stage] || "#7fd0ff"}" fill-opacity=".16" stroke="${stageColors[node.stage] || "#7fd0ff"}" stroke-width="1.5"></circle>
      <circle class="flow-node" data-stage="${esc(node.stage)}" cx="${node.x}" cy="${node.y}" r="6" fill="${stageColors[node.stage] || "#7fd0ff"}"></circle>
      <text x="${node.x}" y="${node.y - 34}" text-anchor="middle" fill="#e9f5ff" font-size="12">${esc(displayStage(node.stage))}</text>
      <text x="${node.x}" y="${node.y + 42}" text-anchor="middle" fill="#90a9c4" font-size="12">${fmt.format(node.count)} 条</text>
    </g>
  `).join("");

  svg.innerHTML = `<rect x="0" y="0" width="1200" height="560" rx="18" fill="rgba(3,9,17,.4)" />${pathHtml}${nodeHtml}`;
}

function buildHierarchyGroups(entity, focus, direction) {
  const groups = new Map();
  const selectedId = entity ? entity.id : "";
  focus.forEach((tx) => {
    let include = false;
    let stageKey = "";
    let counterpartId = "";
    let counterpartName = "";
    let edgeStage = "";

    if (direction === "upstream" && [tx.buyerCompanyId, tx.buyerFacilityId].includes(selectedId)) {
      include = true;
      stageKey = tx.supplierStage;
      counterpartId = tx.supplierFacilityId || tx.supplierCompanyId;
      counterpartName = tx.supplierFacility || tx.supplierCompany;
      edgeStage = `${displayStage(tx.supplierStage)} → ${displayStage(tx.buyerStage)}`;
    }
    if (direction === "downstream" && [tx.supplierCompanyId, tx.supplierFacilityId].includes(selectedId)) {
      include = true;
      stageKey = tx.buyerStage;
      counterpartId = tx.buyerFacilityId || tx.buyerCompanyId;
      counterpartName = tx.buyerFacility || tx.buyerCompany;
      edgeStage = `${displayStage(tx.supplierStage)} → ${displayStage(tx.buyerStage)}`;
    }
    if (!include) return;

    if (!groups.has(stageKey)) groups.set(stageKey, new Map());
    const stageGroup = groups.get(stageKey);
    if (!stageGroup.has(counterpartId || counterpartName)) {
      stageGroup.set(counterpartId || counterpartName, { id: counterpartId, name: counterpartName, count: 0, txId: tx.id, edgeStage });
    }
    stageGroup.get(counterpartId || counterpartName).count += 1;
  });
  return groups;
}

function renderHierarchy(focus) {
  const entity = currentEntity();
  const body = byId("hierarchyBody");
  const meta = byId("hierarchyMeta");
  if (!entity) {
    meta.textContent = "选择一个企业或设施后展开";
    const topPairs = new Map();
    focus.forEach((tx) => {
      const key = `${displayStage(tx.supplierStage)} → ${displayStage(tx.buyerStage)}`;
      topPairs.set(key, (topPairs.get(key) || 0) + 1);
    });
    body.innerHTML = `<div class="subnote">请选择一个企业或设施，查看围绕它展开的上游与下游分层。当前先展示最强的环节组合。</div><div class="kv-list">${[...topPairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([key, value]) => `<div class="kv-row"><span>${esc(key)}</span><strong>${fmt.format(value)}</strong></div>`).join("")}</div>`;
    return;
  }

  meta.textContent = `围绕 ${entityLabel(entity)} 展开`;
  const upstream = buildHierarchyGroups(entity, focus, "upstream");
  const downstream = buildHierarchyGroups(entity, focus, "downstream");
  const renderColumn = (title, groups) => {
    const html = [...groups.entries()].sort((a, b) => stageOrder.indexOf(a[0]) - stageOrder.indexOf(b[0])).map(([stage, items]) => `
      <div class="h-group">
        <div class="h-group-title">${esc(displayStage(stage))}</div>
        ${[...items.values()].sort((a, b) => b.count - a.count).map((item) => `
          <button class="h-item" data-entity="${esc(item.id || "")}" data-tx="${esc(item.txId)}">
            ${esc(short(item.name, 28))}
            <small>${fmt.format(item.count)} 条关系 · ${esc(item.edgeStage)}</small>
          </button>
        `).join("")}
      </div>
    `).join("") || `<div class="subnote">当前筛选下暂无${title}关系。</div>`;
    return `<div class="h-col"><h3>${title}</h3>${html}</div>`;
  };
  body.innerHTML = `<div class="hierarchy-columns">${renderColumn("上游", upstream)}${renderColumn("下游", downstream)}</div>`;
}

async function applyTextureProfile(profile) {
  const config = TEXTURES[profile] || TEXTURES.balanced;
  try {
    await preloadImage(config.url);
    state.texture = profile;
    state.textureWarning = config.hint;
    byId("textureSelect").value = profile;
    if (globe) globe.globeImageUrl(config.url);
  } catch (error) {
    state.texture = profile === "github" ? "sharp" : "balanced";
    const fallback = TEXTURES[state.texture];
    state.textureWarning = `${config.label}加载失败，已自动切换到${fallback.label}。`;
    byId("textureSelect").value = state.texture;
    if (globe) globe.globeImageUrl(fallback.url);
  }
}

function globeData(base, focus) {
  const activeIds = new Set(focus.map((tx) => tx.id));
  const stride = state.dense && !state.entityId ? Math.max(1, Math.ceil(base.length / 180)) : 1;
  const pointMap = new Map();
  const arcs = [];
  base.forEach((tx, index) => {
    const active = activeIds.has(tx.id);
    if (index % stride && !active) return;
    [
      {
        key: `s:${tx.supplierFacilityId || tx.supplierCompanyId}:${tx.supplierStage}`,
        id: tx.supplierFacilityId || tx.supplierCompanyId,
        label: tx.supplierFacility || tx.supplierCompany,
        display: tx.supplierCompany || tx.supplierFacility,
        stage: tx.supplierStage,
        country: tx.supplierCountry,
        lat: Number(tx.sourceLat),
        lon: Number(tx.sourceLon),
        origin: tx.sourcePointOrigin
      },
      {
        key: `b:${tx.buyerFacilityId || tx.buyerCompanyId}:${tx.buyerStage}`,
        id: tx.buyerFacilityId || tx.buyerCompanyId,
        label: tx.buyerFacility || tx.buyerCompany,
        display: tx.buyerCompany || tx.buyerFacility,
        stage: tx.buyerStage,
        country: tx.buyerCountry,
        lat: Number(tx.targetLat),
        lon: Number(tx.targetLon),
        origin: tx.targetPointOrigin
      }
    ].forEach((point) => {
      if (!isNum(point.lat) || !isNum(point.lon)) return;
      if (!pointMap.has(point.key)) pointMap.set(point.key, { ...point, weight: 0, active: false, focused: false });
      const item = pointMap.get(point.key);
      item.weight += 1;
      item.active = item.active || active;
      item.focused = item.focused || point.id === state.entityId;
    });
    const selected = [tx.supplierCompanyId, tx.buyerCompanyId, tx.supplierFacilityId, tx.buyerFacilityId].includes(state.entityId);
    arcs.push({ ...tx, active, selected, dashOffset: (index * 0.137) % 1, kind: "base" });
    if (active) arcs.push({ ...tx, active, selected, dashOffset: (index * 0.137) % 1, kind: "pulse" });
  });
  const points = [...pointMap.values()];
  const labels = state.labels
    ? points
        .filter((point) => point.active || point.focused)
        .sort((a, b) => Number(b.focused) - Number(a.focused) || b.weight - a.weight)
        .slice(0, state.entityId ? 18 : 10)
        .map((point) => ({ lat: point.lat, lng: point.lon, altitude: point.focused ? 0.05 : 0.03, text: short(point.display, 16) }))
    : [];
  return { points, arcs, labels };
}

function ensureGlobe() {
  if (globe) return globe;
  if (typeof window.Globe !== "function") {
    setGlobeState("fallback", "当前浏览器未成功加载三维地球组件，页面已显示本地地球底图。");
    return null;
  }

  try {
    globe = new window.Globe(byId("globe"), {
      rendererConfig: { antialias: true, alpha: true, powerPreference: "high-performance" }
    })
      .width(byId("globe").clientWidth || innerWidth)
      .height(byId("globe").clientHeight || innerHeight)
      .backgroundColor("rgba(0,0,0,0)")
      .globeImageUrl(TEXTURES[state.texture].url)
      .bumpImageUrl("assets/earth_topology.png")
      .showAtmosphere(true)
      .atmosphereColor("#8fd2ff")
      .atmosphereAltitude(0.17)
      .globeCurvatureResolution(2)
      .pointAltitude((point) => point.focused ? 0.04 : 0.024)
      .pointRadius((point) => point.focused ? 0.18 : Math.min(0.11 + point.weight * 0.012, 0.2))
      .arcAltitudeAutoScale(0.24)
      .arcStroke((arc) => arc.kind === "pulse" ? 0.38 : (arc.selected ? 0.22 : 0.14))
      .arcDashLength((arc) => arc.kind === "pulse" ? 0.16 : 1)
      .arcDashGap((arc) => arc.kind === "pulse" ? 1.15 : 0)
      .arcDashInitialGap("dashOffset")
      .arcDashAnimateTime((arc) => arc.kind === "pulse" ? 2600 : 0)
      .pointsTransitionDuration(0)
      .arcsTransitionDuration(0)
      .htmlTransitionDuration(0)
      .onPointHover((point) => openTooltip(point ? `<div><strong>${esc(point.label)}</strong></div><div>${esc(displayStage(point.stage))} · ${esc(displayCountry(point.country || ""))}</div><div>${fmt.format(point.weight)} 条关联路径</div><div>坐标来源：${esc(displayPointOrigin(point.origin))}</div>` : ""))
      .onPointClick((point) => {
        if (!point || !point.id) return;
        selectEntity(point.id);
      })
      .onArcHover((arc) => openTooltip(arc ? `<div><strong>${esc(short(arc.supplierCompany || arc.supplierFacility, 26))} → ${esc(short(arc.buyerCompany || arc.buyerFacility, 26))}</strong></div><div>${esc(displayStage(arc.supplierStage))} → ${esc(displayStage(arc.buyerStage))}</div><div>数量/规模：${esc(txAmount(arc))}</div><div>时间：${esc(txDate(arc))}</div>` : ""))
      .onArcClick((arc) => {
        if (!arc || !arc.id) return;
        selectTransaction(arc.id);
        render();
      })
      .htmlLat("lat")
      .htmlLng("lon")
      .htmlAltitude("altitude")
      .htmlElement((item) => {
        const node = document.createElement("div");
        node.className = "glabel";
        node.textContent = item.text;
        return node;
      });

    const controls = globe.controls ? globe.controls() : null;
    if (controls) {
      controls.enablePan = false;
      controls.minDistance = 170;
      controls.maxDistance = 760;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.45;
    }

    byId("globe").addEventListener("mousemove", (event) => {
      state.pointerX = event.clientX + 14;
      state.pointerY = event.clientY + 14;
      if (tooltip.style.display === "block") {
        tooltip.style.left = `${state.pointerX}px`;
        tooltip.style.top = `${state.pointerY}px`;
      }
    });
    byId("globe").addEventListener("mouseleave", () => openTooltip(""));
    new ResizeObserver(() => {
      if (!globe) return;
      globe.width(byId("globe").clientWidth || innerWidth).height(byId("globe").clientHeight || innerHeight);
    }).observe(byId("globe"));

    setGlobeState("webgl", "");
    return globe;
  } catch (error) {
    console.error(error);
    setGlobeState("fallback", "三维地球初始化失败，页面已切换为本地地球底图。");
    return null;
  }
}

function renderGlobe(base, focus) {
  const g = ensureGlobe();
  if (!g) return;
  try {
    const data = globeData(base, focus);
    g.pointsData(data.points)
      .pointLat("lat")
      .pointLng("lon")
      .pointColor((point) => {
        const color = stageColors[point.stage] || "#7fd0ff";
        return point.focused ? color : (point.active ? `${color}cc` : `${color}44`);
      })
      .arcsData(data.arcs)
      .arcStartLat("sourceLat")
      .arcStartLng("sourceLon")
      .arcEndLat("targetLat")
      .arcEndLng("targetLon")
      .arcColor((arc) => {
        const color = stageColors[arc.supplierStage] || "#7fd0ff";
        if (arc.kind === "pulse") return arc.selected ? "rgba(255,255,255,.96)" : "rgba(170,225,255,.86)";
        return arc.selected ? `${color}dd` : (arc.active ? `${color}88` : `${color}22`);
      })
      .htmlElementsData(data.labels);

    setGlobeState("webgl", "");

    const points = data.points.filter((point) => point.active || point.focused);
    const use = points.length ? points : data.points;
    const controls = g.controls ? g.controls() : null;
    if (controls) {
      controls.autoRotate = state.rotate && !state.entityId;
      controls.autoRotateSpeed = 0.45;
    }
    if (!use.length) {
      g.pointOfView({ lat: 18, lng: 18, altitude: 2.2 }, 900);
      return;
    }
    const lat = use.reduce((sum, point) => sum + point.lat, 0) / use.length;
    const lng = use.reduce((sum, point) => sum + point.lon, 0) / use.length;
    g.pointOfView({ lat, lng, altitude: state.entityId ? (state.dense ? 1.75 : 1.55) : (state.dense ? 2.35 : 2.15) }, 900);
  } catch (error) {
    console.error(error);
    setGlobeState("fallback", "三维地球渲染失败，页面已保留本地地球底图和图谱面板。");
  }
}

function render() {
  const base = stageFilteredTransactions();
  const focus = focusedTransactions();
  const entity = currentEntity();
  byId("queryMeta").textContent = entity ? `已聚焦：${entityLabel(entity)}` : "全链路视图";
  byId("detailMeta").textContent = entity ? "实体聚焦" : "全局概览";
  byId("statusText").textContent = entity ? `围绕 ${entityLabel(entity)} 的 ${fmt.format(focus.length)} 条关系` : `当前显示 ${fmt.format(base.length)} 条交易关系`;
  byId("chips").innerHTML = [
    `关系 ${fmt.format(focus.length)}`,
    entity ? displayCountry(entity.country) : "",
    entity && entity.type === "company" ? `设施 ${fmt.format((companyFacilities.get(entity.id) || []).length)}` : "",
    state.stage !== "all" ? `环节 ${displayStage(state.stage)}` : "",
    `影像 ${TEXTURES[state.texture].label}`,
    state.globeMode === "fallback" ? "地球 底图模式" : ""
  ].filter(Boolean).map((item) => `<span class="chip">${esc(item)}</span>`).join("");
  byId("textureHint").textContent = [state.textureWarning || TEXTURES[state.texture].hint, state.globeNotice, FILE_PROTOCOL_HINT].filter(Boolean).join(" ");
  renderResults();
  renderDetail(focus);
  renderCard();
  renderRegion(focus);
  renderFlow(focus);
  renderHierarchy(focus);
  renderGlobe(base, focus);
}

byId("results").addEventListener("click", (event) => {
  const button = event.target.closest("[data-entity]");
  if (!button) return;
  selectEntity(button.dataset.entity);
});
byId("searchInput").addEventListener("input", renderResults);
byId("searchInput").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const first = byId("results").querySelector("[data-entity]");
  if (first) selectEntity(first.dataset.entity);
});
byId("stageSelect").innerHTML = `<option value="all">全部环节</option>${stageOrder.map((stage) => `<option value="${esc(stage)}">${esc(displayStage(stage))}</option>`).join("")}`;
byId("stageSelect").addEventListener("change", (event) => {
  state.stage = event.target.value;
  render();
});
byId("textureSelect").addEventListener("change", (event) => {
  applyTextureProfile(event.target.value).finally(() => render());
});
byId("clearBtn").addEventListener("click", () => {
  byId("searchInput").value = "";
  state.entityId = "";
  state.selectedTxId = "";
  setCard(null, null);
  render();
});
byId("closeCardBtn").addEventListener("click", () => {
  setCard(null, null);
});
byId("resetBtn").addEventListener("click", () => {
  state.entityId = "";
  state.selectedTxId = "";
  state.stage = "all";
  state.dense = false;
  state.labels = true;
  state.rotate = true;
  byId("searchInput").value = "";
  byId("stageSelect").value = "all";
  byId("labelsBtn").classList.add("is-on");
  byId("rotateBtn").classList.add("is-on");
  byId("densityBtn").classList.remove("is-on");
  setCard(null, null);
  render();
});
byId("labelsBtn").addEventListener("click", (event) => {
  state.labels = !state.labels;
  event.currentTarget.classList.toggle("is-on", state.labels);
  render();
});
byId("densityBtn").addEventListener("click", (event) => {
  state.dense = !state.dense;
  event.currentTarget.classList.toggle("is-on", state.dense);
  render();
});
byId("rotateBtn").addEventListener("click", (event) => {
  state.rotate = !state.rotate;
  event.currentTarget.classList.toggle("is-on", state.rotate);
  render();
});
byId("zoomInBtn").addEventListener("click", () => {
  const g = ensureGlobe();
  if (!g) return;
  const view = g.pointOfView();
  g.pointOfView({ lat: view.lat, lng: view.lng, altitude: Math.max(0.8, view.altitude * 0.82) }, 450);
});
byId("zoomOutBtn").addEventListener("click", () => {
  const g = ensureGlobe();
  if (!g) return;
  const view = g.pointOfView();
  g.pointOfView({ lat: view.lat, lng: view.lng, altitude: Math.min(4, view.altitude * 1.18) }, 450);
});
byId("regionSvg").addEventListener("click", (event) => {
  const txNode = event.target.closest("[data-tx]");
  if (txNode) {
    selectTransaction(txNode.dataset.tx);
    render();
    return;
  }
  const entityNode = event.target.closest("[data-entity]");
  if (entityNode && entityNode.dataset.entity) selectEntity(entityNode.dataset.entity);
});
byId("flowSvg").addEventListener("click", (event) => {
  const txNode = event.target.closest("[data-tx]");
  if (txNode) {
    selectTransaction(txNode.dataset.tx);
    render();
    return;
  }
  const stageNode = event.target.closest("[data-stage]");
  if (stageNode && stageNode.dataset.stage) {
    state.stage = stageNode.dataset.stage;
    byId("stageSelect").value = state.stage;
    render();
  }
});
byId("hierarchyBody").addEventListener("click", (event) => {
  const txNode = event.target.closest("[data-tx]");
  if (txNode) {
    selectTransaction(txNode.dataset.tx);
    render();
  }
  const entityNode = event.target.closest("[data-entity]");
  if (entityNode && entityNode.dataset.entity) selectEntity(entityNode.dataset.entity);
});
byId("cardBody").addEventListener("click", (event) => {
  const txNode = event.target.closest("[data-tx]");
  if (txNode) {
    selectTransaction(txNode.dataset.tx);
    render();
  }
});
window.addEventListener("resize", () => {
  if (globe) globe.width(byId("globe").clientWidth || innerWidth).height(byId("globe").clientHeight || innerHeight);
});

setupFallbackEarth();
setupFallbackInteraction();
setGlobeState("fallback", "");
applyTextureProfile(state.texture).finally(() => render());
})();
