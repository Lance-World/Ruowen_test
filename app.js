/* =========================================================
[保留] 1. DATA_PATHS
- JSON 路徑集中管理。graph_cards.json 為 optional。
========================================================= */
const DATA_PATHS = {
  nodes: "./data/graph_nodes.json",
  edges: "./data/graph_edges.json",
  sources: "./data/graph_sources.json",
  meta: "./data/graph_meta.json",
  intro: "./data/intro_messages.json",
  cards: "./data/graph_cards.json",
};

/* =========================================================
[保留][可擴充] 2. state
- Graph / Sidebar / Mobile / ViewMode / History 狀態集中管理。
- 不要刪除 viewMode / activeConceptId / activeTermId。
========================================================= */
const state = {
  allNodes: [],
  allEdges: [],
  graphSources: {},
  graphCards: {},
  meta: {},
  visibleTypes: new Set(["topic", "concept", "term"]),
  selectedCategory: "all",
  selectedNodeId: null,
  simulation: null,
  svg: null,
  zoomLayer: null,
  linkSelection: null,
  nodeSelection: null,
  zoomBehavior: null,
  // Desktop/Web starts collapsed; selecting a node expands it automatically.
  infoCompact: true,
  lastMobileTapNodeId: null,
  mobileSheetOpen: false,
  mobileSheetExpanded: false,
  aboutModalOpen: false,
  simulationStopTimer: null,
  isInitialLoading: true,
  introFinished: false,
  forceStarted: false,
  activeTag: null,
  searchHistory: [],
  seedHistory: [],
  seedMode: "context",
  viewMode: "main",
  activeConceptId: null,
  activeTermId: null,
  previousMainTransform: null,
  currentNodes: [],
  currentEdges: [],
  // Main view uses a static preset layout at page load, but Topic/Core Concept nodes remain draggable.
  manualMainPositions: new Map(),

  // Knowledge Star Map focus model. Keep viewMode for backward compatibility,
  // but new graph behavior is driven by currentFocus + expandedTermNodeIds.
  currentFocus: { type: "universe", value: null },
  expandedTermNodeIds: new Set(),
  seedFocusNodeIds: new Set(),
  hasEnteredUniverse: false,
  initialAnimationDone: false,
};

/* =========================================================
[保留] 3. constants
========================================================= */
const nodeColors = {
  topic: "#E8D7F1",      // 主題：淺粉紫羅蘭
  concept: "#BFE7E2",    // 概念：蒂芬妮藍綠
  term: "#F6E7B8",       // 詞彙：淺粉黃
  phrase: "#F6F1E8",     // 句子：只進 Info Panel，不進主網絡
  unknown: "#E8F3F1",
};

const edgeColors = {
  contains: "rgba(92, 142, 157, 0.62)",
  related_to: "rgba(92, 166, 168, 0.62)",
  alias_of: "rgba(126, 156, 168, 0.42)",
  related_phrase: "rgba(150, 168, 176, 0.34)",
};


const STORAGE_KEYS = {
  searchHistory: "ruowenSearchHistory",
  seedHistory: "ruowenSeedHistory",
};

const MAX_HISTORY_ITEMS = 12;
const INITIAL_CONCEPT_DELAY_MS = 300;
const INITIAL_GRAPH_FADE_MS = 920;
const MAIN_LAYOUT_RING_START_ANGLE = -Math.PI / 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const UI_TYPES = {
  topic: "主題",
  concept: "概念",
  term: "詞彙",
  phrase: "句子",
  sentence: "句子",
};

const INTRO_GREETING_TEXT = "Hi ! Guys ~";
const INTRO_GREETING_TYPE_MS = 700;
const DESKTOP_INFO_COLLAPSED_HEIGHT = 86;
const DESKTOP_INFO_DEFAULT_HEIGHT = 280;
const DESKTOP_INFO_MAX_VH = 0.8;
const INITIAL_CONCEPT_LIMIT = 250;
const EXPANDED_TERM_LIMIT = 20;
const TERM_ORBIT_INNER_RADIUS = 78;
const TERM_ORBIT_OUTER_RADIUS = 122;
const GRAPH_ENTRY_TOPIC_DELAY_MS = 120;
const GRAPH_ENTRY_CONCEPT_DELAY_MS = 560;
const GRAPH_ENTRY_EDGES_DELAY_MS = 1880;
const GRAPH_ENTRY_TOPIC_SIM_STOP_MS = 980;
const GRAPH_ENTRY_CONCEPT_SIM_STOP_MS = 1550;

// Seed AI priority:
// 1) Local Ollama on the user's machine. No cloud API key.
// 2) Optional backend/proxy endpoint. Never put cloud API keys in public frontend files.
// 3) Rule-based local fallback, so Seed never breaks the site.
const SEED_MODES = {
  context: {
    id: "context",
    label: "脈絡｜Context",
    labelZh: "脈絡",
    labelEn: "Context",
    shortLabel: "Context",
    description: "找出這個問題背後的相關概念群",
    sourceLabel: "Seed｜脈絡 Context",
  },
  contrast: {
    id: "contrast",
    label: "對照｜Contrast",
    labelZh: "對照",
    labelEn: "Contrast",
    shortLabel: "Contrast",
    description: "找出概念之間的張力與矛盾",
    sourceLabel: "Seed｜對照 Contrast",
  },
  path: {
    id: "path",
    label: "路徑｜Path",
    labelZh: "路徑",
    labelEn: "Path",
    shortLabel: "Path",
    description: "建立從問題到核心概念的推理鏈",
    sourceLabel: "Seed｜路徑 Path",
  },
  ai: {
    id: "ai",
    label: "AI｜AI",
    labelZh: "AI",
    labelEn: "AI",
    shortLabel: "AI",
    description: "產生可討論的新問題，未來可接 AI",
    sourceLabel: "Seed｜AI 腦洞提問",
  },
};

const SEED_AI_CONFIG = {
  localOllamaEnabled: true,
  localOllamaEndpoint: "http://127.0.0.1:11434/api/generate",
  localOllamaModel: "qwen2.5:3b",
  backendEnabled: false,
  backendEndpoint: "./api/seed-idea",
  timeoutMs: 12000,
  fallbackToLocal: true,
};


/* =========================================================
[不要改] 4. init() entry
========================================================= */
document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    await loadData();
    restoreRecentHistory();
    restoreSidebarState();
    restoreSidebarWidth();
    restoreSearchPanelState();
    restoreSeedPanelState();
    restorePanelPreferences();
    updateFloatingLayoutVars();
    syncMobileOnlyResizeHandles();
    updateMobileToolbarPosition();
    setupCategoryChips();
    setupControls();
    setupSeedPanel();
    setupRelatedInteractions();
    setupTagInteractions();
    setupResizablePanels();
    setupInfoCompactToggle();
    setupMobileBottomSheetGestures();
    setupAboutModal();
    document.body.classList.add("graph-intro-active");
    document.body.classList.remove(
      "graph-intro-finished",
      "graph-board-visible",
      "graph-topic-visible",
      "intro-concepts-visible",
      "graph-interaction-enabled"
    );
    renderGraph();
    renderDefaultInfo();
    setupFloatingNoteAutoHide();
    setupIntroOverlay();
  } catch (error) {
    console.error(error);
    alert("讀取資料失敗，請確認 web/data/*.json 是否存在，並用本機伺服器開啟。");
  }
}

/* ================================
   Data
================================ */

/* =========================================================
[可改] 5. loadData()
- 可接 graph_cards.json，但不能讓 optional file 缺失造成啟動失敗。
========================================================= */
async function loadData() {
  const [nodes, edges, sources, meta, cards] = await Promise.all([
    fetchJson(DATA_PATHS.nodes),
    fetchJson(DATA_PATHS.edges),
    fetchJson(DATA_PATHS.sources),
    fetchJson(DATA_PATHS.meta),
    fetchOptionalJson(DATA_PATHS.cards, {}),
  ]);

  state.allNodes = normalizeNodeTypes(nodes);
  state.allEdges = edges;
  state.graphSources = sources || {};
  state.meta = meta || {};
  state.graphCards = normalizeGraphCards(cards);

  console.log("nodes:", state.allNodes.length);
  console.log("edges:", state.allEdges.length);
  console.log("source nodes:", Object.keys(state.graphSources).length);
  console.log("cards:", Object.keys(state.graphCards).length);
}

async function fetchJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}`);
  }

  return response.json();
}

async function fetchOptionalJson(path, fallbackValue) {
  try {
    return await fetchJson(path);
  } catch (_) {
    return fallbackValue;
  }
}

function normalizeNodeTypes(nodes) {
  return (Array.isArray(nodes) ? nodes : []).map((node) => {
    if (!node || typeof node !== "object") return node;
    if (node.type === "sentence") return { ...node, type: "phrase", ui_type: "sentence" };
    return node;
  });
}

function normalizeGraphCards(cards) {
  if (!cards) return {};

  if (Array.isArray(cards)) {
    const result = {};
    cards.forEach((card) => {
      const id = card && (card.id || card.node_id || card.card_id);
      if (id) result[id] = card;
    });
    return result;
  }

  if (typeof cards === "object") return cards;
  return {};
}

/* ================================
   Sidebar
================================ */

/* =========================================================
[保留] 6. Sidebar controls
========================================================= */
function restoreSidebarState() {
  const appShell = document.querySelector(".app-shell");
  if (!appShell) return;

  // JS-1C:
  // 桌機：記住上一次 Sidebar 收合狀態。
  // 手機：每次載入都預設收合，讓地圖空間最大化。
  if (isMobileLayout()) {
    appShell.classList.add("sidebar-collapsed");
    return;
  }

  const isCollapsed = localStorage.getItem("sidebarCollapsed") === "1";
  appShell.classList.toggle("sidebar-collapsed", isCollapsed);
}

function restoreSidebarWidth() {
  // J2 / K1：Sidebar 固定寬度；清掉舊版可能留下的寬度設定。
  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.style.width = "";
  localStorage.removeItem("sidebarWidth");
}

function restoreSearchPanelState() {
  const panel = document.getElementById("sidebarSearchPanel");
  const isOpen = localStorage.getItem("searchPanelOpen") === "1";

  if (!panel) return;

  if (isOpen) {
    panel.classList.remove("search-collapsed");
  } else {
    panel.classList.add("search-collapsed");
  }
}

function toggleSidebar() {
  const appShell = document.querySelector(".app-shell");
  appShell.classList.toggle("sidebar-collapsed");

  const isCollapsed = appShell.classList.contains("sidebar-collapsed");
  localStorage.setItem("sidebarCollapsed", isCollapsed ? "1" : "0");

  if (isCollapsed) {
    const sidebar = document.getElementById("sidebar");
    const categoryToggleBtn = document.getElementById("categoryToggleBtn");
    if (sidebar) sidebar.classList.remove("categories-open");
    if (categoryToggleBtn) categoryToggleBtn.setAttribute("aria-expanded", "false");
  }

  updateFloatingLayoutVars();
  updateMobileToolbarPosition();

  setTimeout(() => {
    updateFloatingLayoutVars();
    updateMobileToolbarPosition();
    resizeGraphAfterPanelChange();
  }, 320);
}

function toggleSearchPanel() {
  const panel = document.getElementById("sidebarSearchPanel");
  const appShell = document.querySelector(".app-shell");

  if (!panel) return;

  if (appShell.classList.contains("sidebar-collapsed")) {
    appShell.classList.remove("sidebar-collapsed");
    localStorage.setItem("sidebarCollapsed", "0");
  }

  panel.classList.toggle("search-collapsed");

  const isOpen = !panel.classList.contains("search-collapsed");
  localStorage.setItem("searchPanelOpen", isOpen ? "1" : "0");

  if (isOpen) {
    const seedPanel = document.getElementById("sidebarSeedPanel");
    if (seedPanel) seedPanel.classList.add("seed-collapsed");
    localStorage.setItem("seedPanelOpen", "0");
    syncSeedPanelOpenState();
    setTimeout(() => {
      const input = document.getElementById("searchInput");
      if (input) input.focus();
    }, 120);
  }

  updateFloatingLayoutVars();
  updateMobileToolbarPosition();

  setTimeout(() => {
    updateMobileToolbarPosition();
    resizeGraphAfterPanelChange();
  }, 120);
}


/* =========================================================
[保留] 8. Seed
- 產生 idea；空白隨機不記 history。
========================================================= */
function toggleSeedPanel() {
  const panel = document.getElementById("sidebarSeedPanel");
  const appShell = document.querySelector(".app-shell");

  if (!panel) return;

  if (appShell && appShell.classList.contains("sidebar-collapsed")) {
    appShell.classList.remove("sidebar-collapsed");
    localStorage.setItem("sidebarCollapsed", "0");
  }

  const searchPanel = document.getElementById("sidebarSearchPanel");
  if (searchPanel) {
    searchPanel.classList.add("search-collapsed");
    localStorage.setItem("searchPanelOpen", "0");
  }

  panel.classList.toggle("seed-collapsed");
  const isOpen = !panel.classList.contains("seed-collapsed");
  localStorage.setItem("seedPanelOpen", isOpen ? "1" : "0");
  syncSeedPanelOpenState();

  if (isOpen) {
    setTimeout(() => {
      const input = document.getElementById("seedInput");
      if (input) input.focus();
    }, 120);
  }

  updateFloatingLayoutVars();
  updateMobileToolbarPosition();
  setTimeout(() => {
    updateMobileToolbarPosition();
    resizeGraphAfterPanelChange();
  }, 120);
}

function syncSeedPanelOpenState() {
  const panel = document.getElementById("sidebarSeedPanel");
  const appShell = document.querySelector(".app-shell");
  if (!panel || !appShell) return;

  const isOpen = !panel.classList.contains("seed-collapsed");
  appShell.classList.toggle("seed-panel-open", isOpen);
}

function restoreSeedPanelState() {
  const panel = document.getElementById("sidebarSeedPanel");
  if (!panel) return;

  const isOpen = localStorage.getItem("seedPanelOpen") === "1";
  panel.classList.toggle("seed-collapsed", !isOpen);
  syncSeedPanelOpenState();
}

function setupSeedPanel() {
  restoreSeedPanelState();

  const input = document.getElementById("seedInput");
  const submitBtn = document.getElementById("seedSubmitBtn");
  const clearBtn = document.getElementById("clearSeedBtn");
  const wrap = document.querySelector(".sidebar-seed-wrap");
  const modeButtons = Array.from(document.querySelectorAll(".seed-mode-chip"));

  function updateSeedClearState() {
    if (!input || !wrap || !clearBtn) return;
    const hasText = String(input.value || "").trim().length > 0;
    wrap.classList.toggle("has-text", hasText);
    clearBtn.classList.toggle("hidden", !hasText);
  }

  function setSeedMode(mode) {
    const nextMode = SEED_MODES[mode] ? mode : "context";
    state.seedMode = nextMode;
    modeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.seedMode === nextMode);
    });
  }

  async function runSeed(mode = state.seedMode) {
    const raw = input ? input.value.trim() : "";
    const nextMode = SEED_MODES[mode] ? mode : "context";
    setSeedMode(nextMode);

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add("seed-loading");
      submitBtn.setAttribute("aria-busy", "true");
    }
    renderSeedLoadingInfoPanel(raw, nextMode);

    try {
      const result = await generateSeedIdea(raw, nextMode);
      renderSeedInfoPanel(result, raw, nextMode);
      if (raw) addHistoryItem("seed", raw);
    } finally {
      [submitBtn].forEach((button) => {
        if (!button) return;
        button.disabled = false;
        button.classList.remove("seed-loading");
        button.removeAttribute("aria-busy");
      });
    }
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setSeedMode(button.dataset.seedMode));
  });

  if (submitBtn) submitBtn.addEventListener("click", () => runSeed(state.seedMode));
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (input) input.value = "";
      updateSeedClearState();
      if (input) input.focus();
    });
  }

  if (input) {
    input.addEventListener("input", updateSeedClearState);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") runSeed(state.seedMode);
      if (event.key === "Escape") {
        if (input.value) {
          input.value = "";
          updateSeedClearState();
          return;
        }
        const panel = document.getElementById("sidebarSeedPanel");
        if (panel) panel.classList.add("seed-collapsed");
        localStorage.setItem("seedPanelOpen", "0");
        syncSeedPanelOpenState();
      }
    });
    updateSeedClearState();
  }

  setSeedMode(state.seedMode);
}

async function generateSeedIdea(userText = "", mode = "context") {
  const seedQuestion = parseSeedQuestion(userText);
  const resolvedMode = resolveSeedMode(seedQuestion, mode);

  if (resolvedMode === "ai") return generateAiQuestionSeed(seedQuestion.rawText);

  const seedConcept = findSeedConcept(seedQuestion);
  const cards = collectSeedCards(seedQuestion, seedConcept, resolvedMode, 7);
  const reasoning = buildSeedReasoning(seedQuestion, seedConcept, cards, resolvedMode);
  const questions = generateSeedQuestions(seedQuestion, seedConcept, cards, resolvedMode);

  return buildSeedResultFromStructure({
    mode: resolvedMode,
    seedQuestion,
    seedConcept,
    cards,
    reasoning,
    questions,
  });
}

function parseSeedQuestion(userText = "") {
  const rawText = String(userText || "").trim();
  const normalized = rawText
    .replace(/[？?]+$/g, "")
    .replace(/^(idea|seed)[:：]/i, "")
    .trim();

  const tokens = Array.from(new Set(
    normalized
      .split(/[\s、,，。！？?；;：「」『』《》()（）\[\]\/|]+/)
      .map((item) => cleanTopicLabel(item).trim())
      .filter((item) => item && hasSearchableMeaning(item))
  ));

  const questionType = /為什麼|原因|怎麼|如何|路徑|步驟|到|變成/.test(normalized)
    ? "path"
    : /矛盾|對照|差異|張力|衝突|可是|但是|自由|控制|信任/.test(normalized)
      ? "contrast"
      : "context";

  return {
    rawText,
    normalizedText: normalized,
    tokens,
    questionType,
  };
}

function resolveSeedMode(seedQuestion, requestedMode = "context") {
  if (SEED_MODES[requestedMode]) return requestedMode;
  return seedQuestion && SEED_MODES[seedQuestion.questionType] ? seedQuestion.questionType : "context";
}

function findSeedConcept(seedQuestion) {
  const selectedNode = state.selectedNodeId ? getNodeById(state.selectedNodeId) : null;
  if (selectedNode && getGraphNodeTypesForSeed().has(selectedNode.type)) return selectedNode;

  const query = String(seedQuestion.normalizedText || seedQuestion.rawText || "").toLowerCase();
  if (!query) return null;

  const candidates = state.allNodes
    .filter((node) => getGraphNodeTypesForSeed().has(node.type))
    .map((node) => ({ node, score: scoreNodeForSeedQuestion(node, seedQuestion) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || getNodeTypeRank(a.node) - getNodeTypeRank(b.node));

  return candidates[0] ? candidates[0].node : null;
}

function scoreNodeForSeedQuestion(node, seedQuestion) {
  const haystack = buildSearchHaystack(node);
  const label = cleanTopicLabel(node.label || node.canonical_term || node.id || "").toLowerCase();
  const query = String(seedQuestion.normalizedText || seedQuestion.rawText || "").toLowerCase();
  let score = 0;

  if (query && label === query) score += 12;
  if (query && label.includes(query)) score += 8;
  if (query && haystack.includes(query)) score += 5;

  (seedQuestion.tokens || []).forEach((token) => {
    const lower = token.toLowerCase();
    if (!lower) return;
    if (label.includes(lower)) score += 4;
    if (haystack.includes(lower)) score += 2;
  });

  if (node.type === "concept") score += 2;
  if (node.concept_role === "core") score += 1;
  return score;
}

function getNodeTypeRank(node) {
  if (!node) return 9;
  if (node.type === "concept") return 1;
  if (node.type === "term") return 2;
  if (node.type === "topic") return 3;
  return 9;
}

function collectSeedCards(seedQuestion, seedConcept, mode = "context", limit = 7) {
  if (mode === "contrast") return collectContrastSeedCards(seedQuestion, seedConcept, limit);
  if (mode === "path") return collectPathSeedCards(seedQuestion, seedConcept, limit);
  return collectContextSeedCards(seedQuestion, seedConcept, limit);
}

function collectContextSeedCards(seedQuestion, seedConcept, limit = 7) {
  const pool = new Map();
  const addNode = (node, score = 1) => {
    if (!node || !getGraphNodeTypesForSeed().has(node.type)) return;
    const current = pool.get(node.id);
    if (!current || score > current.score) pool.set(node.id, { node, score });
  };

  if (seedConcept) {
    addNode(seedConcept, 20);
    getNeighborNodes(seedConcept.id).forEach((node) => addNode(node, node.type === "concept" ? 12 : 8));
    findSeedNodesByTags(getNodeSeedTags(seedConcept), seedConcept.id).slice(0, limit * 2).forEach((node, index) => addNode(node, 7 - index * 0.2));
  }

  state.allNodes
    .filter((node) => getGraphNodeTypesForSeed().has(node.type))
    .map((node) => ({ node, score: scoreNodeForSeedQuestion(node, seedQuestion) }))
    .filter((item) => item.score > 0)
    .forEach((item) => addNode(item.node, item.score));

  if (pool.size === 0) {
    state.allNodes.filter((node) => node.type === "concept").slice(0, limit).forEach((node, index) => addNode(node, 3 - index * 0.1));
  }

  return Array.from(pool.values())
    .sort((a, b) => b.score - a.score || getNodeTypeRank(a.node) - getNodeTypeRank(b.node))
    .map((item) => item.node)
    .slice(0, limit);
}

function collectContrastSeedCards(seedQuestion, seedConcept, limit = 7) {
  const contextCards = collectContextSeedCards(seedQuestion, seedConcept, limit * 2);
  const seedTags = new Set(getNodeSeedTags(seedConcept));

  const scored = contextCards.map((node) => {
    const tags = getNodeSeedTags(node);
    const tagOverlap = tags.reduce((sum, tag) => sum + (seedTags.has(tag) ? 1 : 0), 0);
    const isBridge = node.concept_role === "bridge" ? 2 : 0;
    const crossTopic = seedConcept && node.level1_category && seedConcept.level1_category && node.level1_category !== seedConcept.level1_category ? 3 : 0;
    return { node, score: crossTopic + isBridge + Math.max(0, 4 - tagOverlap) };
  });

  const extras = state.allNodes
    .filter((node) => node.type === "concept" && (!seedConcept || node.id !== seedConcept.id))
    .map((node) => ({ node, score: scoreNodeForSeedQuestion(node, seedQuestion) + (node.concept_role === "bridge" ? 3 : 0) }))
    .filter((item) => item.score > 0);

  return dedupeNodes([...scored, ...extras]
    .sort((a, b) => b.score - a.score)
    .map((item) => item.node))
    .slice(0, limit);
}

function collectPathSeedCards(seedQuestion, seedConcept, limit = 7) {
  const path = [];
  const push = (node) => {
    if (node && getGraphNodeTypesForSeed().has(node.type) && !path.some((item) => item.id === node.id)) path.push(node);
  };

  if (seedConcept) {
    const parentTopic = findNearestTopicForNode(seedConcept);
    push(seedConcept.type === "topic" ? seedConcept : parentTopic);
    push(seedConcept);
    getNeighborNodes(seedConcept.id)
      .filter((node) => node.type === "concept")
      .slice(0, 2)
      .forEach(push);
    getNeighborNodes(seedConcept.id)
      .filter((node) => node.type === "term")
      .slice(0, 3)
      .forEach(push);
  }

  collectContextSeedCards(seedQuestion, seedConcept, limit).forEach(push);
  return path.slice(0, limit);
}

function findNearestTopicForNode(node) {
  if (!node) return null;
  if (node.type === "topic") return node;

  const neighbors = getNeighborNodes(node.id);
  const topic = neighbors.find((item) => item.type === "topic");
  if (topic) return topic;

  const category = node.level1_category;
  if (category) {
    return state.allNodes.find((item) => item.type === "topic" && cleanTopicLabel(item.label || "") === cleanTopicLabel(category)) || null;
  }

  return null;
}

function dedupeNodes(nodes = []) {
  const seen = new Set();
  const result = [];
  nodes.forEach((node) => {
    if (!node || seen.has(node.id)) return;
    seen.add(node.id);
    result.push(node);
  });
  return result;
}

function buildSeedReasoning(seedQuestion, seedConcept, cards, mode = "context") {
  const input = seedQuestion.normalizedText || seedQuestion.rawText || "這個問題";
  const seedLabel = seedConcept ? getSeedNodeLabel(seedConcept) : input;
  const labels = cards.map(getSeedNodeLabel).filter(Boolean);
  const secondary = labels.filter((label) => label !== seedLabel).slice(0, 4);

  if (mode === "contrast") {
    return secondary.length
      ? `「${seedLabel}」可以和「${secondary.join("、")}」形成對照，先看見概念之間的張力，再決定要往哪一端探索。`
      : `「${seedLabel}」目前缺少明確對照卡片，可以先把問題拆成兩個相反方向來看。`;
  }

  if (mode === "path") {
    return labels.length
      ? `可以先把「${input}」視為入口，沿著「${labels.slice(0, 5).join(" → ")}」建立一條由問題走向核心概念的路徑。`
      : `可以先從「${input}」找出一個核心詞，再往 Topic、Concept、Term 逐步展開。`;
  }

  return labels.length
    ? `「${input}」可能不是孤立的問題，而是和「${labels.slice(0, 5).join("、")}」共同形成一組脈絡。`
    : `「${input}」目前沒有明確命中的卡片，可先把它當成一個探索入口。`;
}

function generateSeedQuestions(seedQuestion, seedConcept, cards, mode = "context") {
  const input = seedQuestion.normalizedText || seedQuestion.rawText || getSeedNodeLabel(seedConcept) || "這個問題";
  const labels = cards.map(getSeedNodeLabel).filter(Boolean);
  const a = labels[0] || input;
  const b = labels[1] || "身體訊號";
  const c = labels[2] || "覺知";

  if (mode === "contrast") {
    return [
      `「${a}」和「${b}」之間最大的張力是什麼？`,
      `如果兩個概念都成立，它們各自在提醒什麼？`,
      `你現在比較靠近哪一端，又想練習哪一端？`,
    ];
  }

  if (mode === "path") {
    return [
      `從「${input}」走到「${a}」中間，第一個可觀察的身體或情緒訊號是什麼？`,
      `這條路徑中哪一張卡片最像目前的入口？`,
      `如果只走下一小步，你會先回到哪個概念？`,
    ];
  }

  return [
    `「${input}」如何和「${b}」互相影響？`,
    `當「${input}」出現時，「${c}」可能在提醒什麼？`,
    `如果把「${input}」當作入口，下一張值得看的卡片是哪一張？`,
  ];
}

function buildSeedResultFromStructure({ mode, seedQuestion, seedConcept, cards, reasoning, questions }) {
  const modeConfig = SEED_MODES[mode] || SEED_MODES.context;
  const input = seedQuestion.normalizedText || seedQuestion.rawText || "隨機探索";
  const cardLabels = cards.map(getSeedNodeLabel).filter(Boolean);
  const sourceConcepts = cardLabels.slice(0, 5).join("、") || "目前可見卡片";

  return {
    mode,
    title: `Idea｜${input}`,
    tags: [modeConfig.labelEn].filter(Boolean),
    relatedTerms: cardLabels,
    phrases: [
      cardLabels.length ? `找到的卡片：${cardLabels.join("、")}` : "找到的卡片：尚未命中明確卡片",
      `推理：${reasoning}`,
      "可以討論：",
      ...questions.map((question, index) => `${index + 1}. ${question}`),
    ],
    highlightIds: cards.map((node) => node.id),
    sourceTitle: `相關概念｜${sourceConcepts}`,
  };
}

function getSeedNodeLabel(node) {
  return node ? cleanTopicLabel(node.label || node.canonical_term || node.id || "") : "";
}

function getSeedContextNode(userText = "") {
  return findSeedConcept(parseSeedQuestion(userText));
}

function normalizeSeedTagValue(value) {
  return cleanTopicLabel(String(value || "").trim().replace(/^#/, ""));
}

function getNodeSeedTags(node) {
  if (!node) return [];
  const tags = [];
  const pushValue = (value) => {
    const normalized = normalizeSeedTagValue(value);
    if (normalized) tags.push(normalized);
  };

  [node.level1_category, node.level2_concept, node.playlist_type_tag, node.source_label].forEach(pushValue);
  if (Array.isArray(node.tags)) node.tags.forEach(pushValue);

  String(node.matched_terms || "")
    .split(/[、,，|/]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4)
    .forEach(pushValue);

  return Array.from(new Set(tags)).slice(0, 8);
}

function getGraphNodeTypesForSeed() {
  return new Set(["topic", "concept", "term"]);
}

function findSeedNodesByTags(tags, baseNodeId = null) {
  const targetTags = new Set((tags || []).map(normalizeSeedTagValue).filter(Boolean));
  if (targetTags.size === 0) return [];

  return state.allNodes
    .filter((node) => getGraphNodeTypesForSeed().has(node.type))
    .filter((node) => node.id !== baseNodeId)
    .map((node) => {
      const nodeTags = getNodeSeedTags(node);
      const score = nodeTags.reduce((sum, tag) => sum + (targetTags.has(tag) ? 1 : 0), 0);
      return { node, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.node.label || "").localeCompare(String(b.node.label || "")))
    .map((item) => item.node);
}

function buildSeedResult({ mode = "context", userText = "", title, tags = [], relatedTerms = [], phrases = [], highlightIds = [] }) {
  const seed = String(userText || "").trim();
  const modeConfig = SEED_MODES[mode] || SEED_MODES.context;
  return {
    mode,
    title: title || (seed ? `Idea｜${seed}` : modeConfig.label),
    tags: [modeConfig.labelEn, ...tags].filter(Boolean),
    relatedTerms: Array.from(new Set(relatedTerms.filter(Boolean))).slice(0, 18),
    phrases: phrases.filter(Boolean).slice(0, 8),
    highlightIds: Array.from(new Set(highlightIds.filter(Boolean))),
    sourceTitle: `Seed｜${modeConfig.labelEn || "Context"}`,
  };
}

async function generateAiQuestionSeed(userText = "") {
  const inputText = String(userText || "").trim();
  const contextNode = getSeedContextNode(inputText);
  const contextCards = collectContextSeedCards(parseSeedQuestion(inputText), contextNode, 6);
  let idea = "";

  if (SEED_AI_CONFIG.localOllamaEnabled) {
    try {
      idea = await generateSeedIdeaWithLocalOllama(inputText, "ai");
    } catch (error) {
      console.warn("Local Ollama unavailable; fallback to conservative Seed template:", error);
    }
  }

  if (!reviewSeedResult(idea) && SEED_AI_CONFIG.backendEnabled) {
    try {
      idea = await generateSeedIdeaWithBackend(inputText, "ai");
    } catch (error) {
      console.warn("Seed backend unavailable; fallback to local rule-based idea:", error);
    }
  }

  if (!reviewSeedResult(idea)) idea = generateLocalAiQuestionSeed(inputText);

  return buildSeedResultFromStructure({
    mode: "ai",
    seedQuestion: parseSeedQuestion(inputText || idea),
    seedConcept: contextNode,
    cards: contextCards,
    reasoning: idea,
    questions: [
      `這個問題還可以往哪個更深的概念展開？`,
      `如果它不是答案，而是一個入口，它會帶你看見什麼？`,
      `哪一張卡片最適合接續這個討論？`,
    ],
  });
}

async function generateSeedIdeaWithLocalOllama(userText = "", mode = "ai") {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SEED_AI_CONFIG.timeoutMs);

  try {
    const payload = buildSeedAiPayload(userText, mode);
    const response = await fetch(SEED_AI_CONFIG.localOllamaEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: SEED_AI_CONFIG.localOllamaModel,
        stream: false,
        prompt: buildSeedOllamaPrompt(payload),
        options: {
          temperature: 0.68,
          top_p: 0.86,
          num_predict: 180,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Local Ollama failed: ${response.status}`);
    }

    const data = await response.json();
    return cleanSeedIdeaText(data.response || data.idea || data.text || "");
  } finally {
    window.clearTimeout(timer);
  }
}

async function generateSeedIdeaWithBackend(userText = "", mode = "ai") {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SEED_AI_CONFIG.timeoutMs);

  try {
    const response = await fetch(SEED_AI_CONFIG.backendEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSeedAiPayload(userText, mode)),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Seed backend failed: ${response.status}`);
    }

    const data = await response.json();
    return cleanSeedIdeaText(data.idea || data.text || data.message || "");
  } finally {
    window.clearTimeout(timer);
  }
}

function buildSeedOllamaPrompt(payload) {
  const input = payload.input || "隨機探索";
  const topics = (payload.graph_context.topics || []).slice(0, 8).join("、");
  const concepts = (payload.graph_context.concepts || []).slice(0, 12).join("、");
  const terms = (payload.graph_context.terms || []).slice(0, 16).join("、");

  return `你是 Ruowen Knowledge Graph 的 Seed idea 助手。
請用繁體中文，根據本地知識網絡資料，產生一段 60～120 字的探索性自我提問或靈感。
要求：
- 不要宣稱這是原始書籍或影音的直接結論。
- 不要寫「作者認為」「影片說」「原文指出」。
- 不要新增主圖節點。
- 語氣清楚、連貫、溫柔，但不要太玄。
- 不要輸出 JSON，不要列點。

Seed 模式：${payload.mode_label}
使用者輸入：${input}
可參考 Topic：${topics}
可參考 Concept：${concepts}
可參考 Terms：${terms}

請輸出 Seed idea：`;
}

function cleanSeedIdeaText(text) {
  return String(text || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/g, "")
    .replace(/^Seed idea[:：]?/i, "")
    .replace(/^(作者認為|影片說|原文指出)[:：]?/g, "")
    .trim()
    .slice(0, 220);
}

function buildSeedAiPayload(userText = "", mode = "ai") {
  const contextNode = getSeedContextNode(userText);
  const selectedTags = getNodeSeedTags(contextNode).slice(0, 8);
  const topics = state.allNodes
    .filter((node) => node.type === "topic")
    .map((node) => cleanTopicLabel(node.label || node.canonical_term || node.id))
    .filter(Boolean)
    .slice(0, 12);

  const concepts = state.allNodes
    .filter((node) => node.type === "concept")
    .map((node) => cleanTopicLabel(node.label || node.canonical_term || node.id))
    .filter(Boolean)
    .slice(0, 18);

  const terms = state.allNodes
    .filter((node) => node.type === "term")
    .map((node) => cleanTopicLabel(node.label || node.canonical_term || node.id))
    .filter(Boolean)
    .slice(0, 24);

  return {
    mode,
    mode_label: (SEED_MODES[mode] || SEED_MODES.ai).labelEn,
    input: String(userText || "").trim(),
    selected_node: contextNode ? cleanTopicLabel(contextNode.label || contextNode.canonical_term || contextNode.id) : "",
    tags: selectedTags,
    language: "zh-Hant",
    style: "gentle, reflective, concise, counseling-oriented",
    constraints: {
      max_chars: 120,
      no_new_graph_nodes: true,
      no_source_claims: true,
      no_long_quotes: true,
    },
    graph_context: { topics, concepts, terms },
  };
}

function reviewSeedResult(text) {
  const value = String(text || "").trim();
  if (value.length < 18 || value.length > 220) return false;
  if (/(作者認為|影片說|原文指出|書中明確|逐字稿|直接結論)/.test(value)) return false;
  if (/(C:\\|D:\\|api[_-]?key|token|cookie)/i.test(value)) return false;
  if (!hasSearchableMeaning(value)) return false;
  return true;
}

function generateLocalAiQuestionSeed(userText = "") {
  const contextNode = getSeedContextNode(userText);
  const label = contextNode
    ? cleanTopicLabel(contextNode.label || contextNode.canonical_term || contextNode.id)
    : String(userText || "").trim() || "現在的狀態";
  const terms = contextNode
    ? getNeighborNodes(contextNode.id).filter((node) => node.type === "term").map((node) => cleanTopicLabel(node.label || node.id)).slice(0, 3)
    : [];
  const termText = terms.length ? `，並觀察它和「${terms.join("、")}」的關係` : "";
  return `如果把「${label}」當成一個入口${termText}，你會想問自己：這件事真正想帶我看見什麼？`;
}

function renderSeedModeLabel(mode = "context") {
  const box = document.getElementById("infoTags");
  if (!box) return;
  const modeConfig = SEED_MODES[mode] || SEED_MODES.context;
  box.innerHTML = `<span class="seed-info-mode-label">${escapeHtml(modeConfig.labelEn || "Context")}</span>`;
}

function renderSeedLoadingInfoPanel(userText = "", mode = "context") {
  const seed = String(userText || "").trim();
  const modeConfig = SEED_MODES[mode] || SEED_MODES.context;
  setInfoTitle(seed ? `Idea｜${seed}` : `Seed｜${modeConfig.labelEn || "Context"}`);
  renderSeedModeLabel(mode);

  const relatedTerms = document.getElementById("relatedTerms");
  const relatedPhrases = document.getElementById("relatedPhrases");
  const sourceList = document.getElementById("sourceList");

  if (relatedTerms) {
    relatedTerms.innerHTML = seed
      ? `<button type="button" class="related-term-chip" data-term="${escapeAttribute(seed)}">${escapeHtml(seed)}</button>`
      : '<span class="muted">正在從現有知識網絡抽樣</span>';
  }

  if (relatedPhrases) {
    relatedPhrases.innerHTML = '<div class="quote-item seed-idea-item">正在產生 Seed 結果…</div>';
  }

  if (sourceList) sourceList.innerHTML = renderSeedSourceWarning(`Seed｜${modeConfig.labelEn || "Context"}`, mode);
  openSeedInfoPanel();
}

function renderSeedInfoPanel(result, userText = "", mode = "context") {
  const safeResult = result && typeof result === "object" ? result : buildSeedResult({
    mode,
    userText,
    phrases: [String(result || "")],
  });

  setInfoTitle(safeResult.title || "Seed Idea");
  renderSeedModeLabel(safeResult.mode || mode);

  const relatedTerms = document.getElementById("relatedTerms");
  const relatedPhrases = document.getElementById("relatedPhrases");
  const sourceList = document.getElementById("sourceList");

  if (relatedTerms) {
    relatedTerms.innerHTML = (safeResult.relatedTerms || []).length
      ? safeResult.relatedTerms.map((term) => `<button type="button" class="related-term-chip" data-term="${escapeAttribute(term)}">${escapeHtml(term)}</button>`).join("")
      : '<span class="muted">尚無相關詞彙</span>';
  }

  if (relatedPhrases) {
    relatedPhrases.innerHTML = (safeResult.phrases || []).length
      ? safeResult.phrases.map((text) => `<div class="quote-item seed-idea-item">${escapeHtml(text)}</div>`).join("")
      : '<span class="muted">尚無 Seed 結果</span>';
  }

  if (sourceList) sourceList.innerHTML = renderSeedSourceWarning(safeResult.sourceTitle, safeResult.mode);

  highlightSeedResultNodes(safeResult.highlightIds || []);
  openSeedInfoPanel();
}

function renderSeedSourceWarning(sourceTitle = "Seed", mode = "context") {
  const isAiMode = mode === "ai";
  return `<div class="source-item seed-source-warning">
      <div class="source-title">${escapeHtml(sourceTitle || "Seed")}</div>
      <div class="source-text">提示：</div>
      <div class="source-text">以下為探索性推演，不代表原始書籍或影音的直接結論。</div>
      <div class="source-text">${isAiMode ? "Mode 4 可能使用本機 AI 潤飾；不應送出完整逐字稿、私人路徑、API key、cookie 或 token。" : "Mode 1～3 使用本地資料推演，不新增主圖節點，也不改 graph 資料。"}</div>
    </div>`;
}

function openSeedInfoPanel() {
  if (isMobileLayout()) {
    openMobileBottomSheet(60);
  } else {
    state.infoCompact = false;
    applyInfoCompactState();
  }
}

function highlightSeedResultNodes(nodeIds = []) {
  const visibleIds = new Set((state.currentNodes || []).map((node) => node.id));
  state.seedFocusNodeIds = new Set((nodeIds || []).filter((id) => visibleIds.has(id)));
  state.currentFocus = { type: "seed", value: Array.from(state.seedFocusNodeIds) };
  state.activeTag = null;
  applyGraphFocusClasses();

  if (state.seedFocusNodeIds.size > 0) {
    requestAnimationFrame(() => focusNodeGroup(Array.from(state.seedFocusNodeIds)));
  }
}

/* =========================================================
[可改] 10. Category chips
- 可清除 01_ 前綴；CSS 決定排版。
========================================================= */
function setupCategoryChips() {
  const container = document.getElementById("categoryChips");
  container.innerHTML = "";

  const allButton = document.createElement("button");
  allButton.className = "category-chip active";
  allButton.dataset.category = "all";
  allButton.textContent = "全部分類";
  container.appendChild(allButton);

  const categories = state.meta.level1_categories || [];

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.className = "category-chip";
    button.dataset.category = category;
    button.textContent = cleanTopicLabel(category);
    container.appendChild(button);
  });

  container.addEventListener("click", (event) => {
    const button = event.target.closest(".category-chip");
    if (!button) return;

    document.querySelectorAll(".category-chip").forEach((item) => {
      item.classList.remove("active");
    });

    button.classList.add("active");
    state.selectedCategory = button.dataset.category || "all";
    state.activeTag = null;
    state.currentFocus = { type: "universe", value: null };
    clearExpandedTerms();
    updateGraph();
  });
}

/* ================================
   Controls
================================ */

function setupControls() {
  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const type = chip.dataset.type;

      if (type === "all") {
        const shouldEnableAll = !chip.classList.contains("active");

        document.querySelectorAll(".filter-chip").forEach((item) => {
          item.classList.toggle("active", shouldEnableAll);
        });

        state.visibleTypes = shouldEnableAll
          ? new Set(["topic", "concept", "term"])
          : new Set();

        updateGraph();
        return;
      }

      chip.classList.toggle("active");

      if (chip.classList.contains("active")) {
        state.visibleTypes.add(type);
      } else {
        state.visibleTypes.delete(type);
      }

      const allChip = document.querySelector('.filter-chip[data-type="all"]');
      const allEnabled = ["topic", "concept", "term"].every((item) =>
        state.visibleTypes.has(item)
      );

      allChip.classList.toggle("active", allEnabled);
      updateGraph();
    });
  });

  const searchBtn = document.getElementById("searchBtn");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const searchInput = document.getElementById("searchInput");
  const searchWrap = document.querySelector(".sidebar-search-wrap");
  const backToMainBtn = document.getElementById("backToMainBtn");
  const resetViewBtn = document.getElementById("resetViewBtn");
  const expandAllBtn = document.getElementById("expandAllBtn");
  const clearSelectionBtn = document.getElementById("clearSelectionBtn");
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
  const searchToggleBtn = document.getElementById("searchToggleBtn");
  const seedToggleBtn = document.getElementById("seedToggleBtn");
  const categoryToggleBtn = document.getElementById("categoryToggleBtn");
  const sidebar = document.getElementById("sidebar");

  if (searchBtn) {
    searchBtn.addEventListener("click", searchNode);
  }

  function updateSearchClearState() {
    if (!searchInput || !searchWrap || !clearSearchBtn) return;
    const hasText = normalizeSearchKeyword(searchInput.value).length > 0;
    searchWrap.classList.toggle("has-text", hasText);
    clearSearchBtn.classList.toggle("hidden", !hasText);
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      updateSearchClearState();
      showAll();
      if (searchInput) searchInput.focus();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", updateSearchClearState);

    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        searchNode();
      }

      if (event.key === "Escape") {
        if (searchInput.value) {
          searchInput.value = "";
          updateSearchClearState();
          showAll();
          return;
        }

        const panel = document.getElementById("sidebarSearchPanel");
        if (panel) {
          panel.classList.add("search-collapsed");
          localStorage.setItem("searchPanelOpen", "0");
        }
      }
    });

    updateSearchClearState();
  }

  if (categoryToggleBtn && sidebar) {
    categoryToggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("categories-open");
      const isOpen = sidebar.classList.contains("categories-open");
      categoryToggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      updateMobileToolbarPosition();
      setTimeout(updateMobileToolbarPosition, 220);
    });
  }

  if (backToMainBtn) {
    backToMainBtn.addEventListener("click", returnToMainView);
  }

  if (resetViewBtn) {
    resetViewBtn.addEventListener("click", centerSelectedNode);
  }

  if (expandAllBtn) {
    expandAllBtn.addEventListener("click", fitVisibleNodes);
  }

  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener("click", clearSelection);
  }

  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener("click", toggleSidebar);
  }

  if (searchToggleBtn) {
    searchToggleBtn.addEventListener("click", toggleSearchPanel);
  }

  if (seedToggleBtn) {
    seedToggleBtn.addEventListener("click", toggleSeedPanel);
  }
}

function setVisibleTypes(types) {
  state.visibleTypes = new Set(types);

  document.querySelectorAll(".filter-chip").forEach((chip) => {
    const type = chip.dataset.type;

    if (type === "all") {
      chip.classList.toggle("active", types.length === 3);
      return;
    }

    chip.classList.toggle("active", state.visibleTypes.has(type));
  });

  updateGraph();
}

function showAll() {
  state.visibleTypes = new Set(["topic", "concept", "term"]);
  state.selectedCategory = "all";
  state.selectedNodeId = null;
  state.viewMode = "main";
  state.currentFocus = { type: "universe", value: null };
  state.activeConceptId = null;
  state.activeTermId = null;
  state.activeTag = null;
  state.seedFocusNodeIds = new Set();
  clearExpandedTerms();

  document.querySelectorAll(".filter-chip").forEach((item) => {
    item.classList.add("active");
  });

  document.querySelectorAll(".category-chip").forEach((item) => {
    item.classList.toggle("active", item.dataset.category === "all");
  });

  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";

  updateGraph();
  renderDefaultInfo();
  updateBackToMainButton();

  if (isMobileLayout()) {
    closeMobileBottomSheet();
  }

  requestAnimationFrame(() => resetZoom());
}

function clearSelection() {
  state.selectedNodeId = null;
  state.activeConceptId = null;
  state.activeTermId = null;
  state.activeTag = null;
  state.currentFocus = { type: "universe", value: null };
  state.seedFocusNodeIds = new Set();
  clearExpandedTerms();

  updateGraph();
  renderDefaultInfo();

  if (isMobileLayout()) {
    closeMobileBottomSheet();
  }
}

/* ================================
   Info Panel Compact Toggle
   所有平台：點擊資訊欄圖案即可收合 / 展開
================================ */

/* =========================================================
[不建議改] 15. Mobile Bottom Sheet
========================================================= */
function setupInfoCompactToggle() {
  const infoIcon = document.querySelector(".info-icon");
  if (!infoIcon) return;

  infoIcon.setAttribute("role", "button");
  infoIcon.setAttribute("tabindex", "0");
  infoIcon.setAttribute("title", "收合 / 展開資訊欄");

  infoIcon.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleInfoCompact();
  });

  infoIcon.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleInfoCompact();
    }
  });

  if (isMobileLayout()) {
    closeMobileBottomSheet(false);
    return;
  }

  applyInfoCompactState();
}

function toggleInfoCompact() {
  if (isMobileLayout()) {
    if (state.mobileSheetOpen) {
      closeMobileBottomSheet();
    } else {
      openMobileBottomSheet(60);
    }
    return;
  }

  state.infoCompact = !state.infoCompact;
  applyInfoCompactState();
}

function applyInfoCompactState() {
  const infoPanel = document.getElementById("infoPanel");
  const workspace = document.getElementById("workspace");

  if (!infoPanel) return;

  if (isMobileLayout()) {
    infoPanel.classList.toggle("bottom-sheet-open", Boolean(state.mobileSheetOpen));
    infoPanel.classList.toggle("bottom-sheet-hidden", !state.mobileSheetOpen);
    infoPanel.classList.toggle("bottom-sheet-expanded", Boolean(state.mobileSheetExpanded));
    infoPanel.classList.toggle("info-compact", !state.mobileSheetOpen);

    if (workspace) {
      workspace.classList.toggle("info-compact-workspace", !state.mobileSheetOpen);
    }

    requestAnimationFrame(() => {
      resizeGraphAfterPanelChange();
    });
    return;
  }

  infoPanel.classList.remove(
    "bottom-sheet-open",
    "bottom-sheet-hidden",
    "bottom-sheet-expanded",
    "bottom-sheet-dragging"
  );
  infoPanel.style.transform = "";
  infoPanel.style.height = "";
  infoPanel.classList.toggle("info-compact", Boolean(state.infoCompact));
  infoPanel.setAttribute("aria-expanded", state.infoCompact ? "false" : "true");

  if (workspace) {
    workspace.classList.toggle("info-compact-workspace", Boolean(state.infoCompact));
    if (!state.infoCompact) {
      const current = Number.parseFloat(getComputedStyle(workspace).getPropertyValue("--info-height"));
      if (!Number.isFinite(current) || current < DESKTOP_INFO_DEFAULT_HEIGHT) {
        workspace.style.setProperty("--info-height", `${DESKTOP_INFO_DEFAULT_HEIGHT}px`);
      }
    }
  }

  requestAnimationFrame(() => {
    resizeGraphAfterPanelChange();
  });
}

function openMobileBottomSheet(targetVh = 60) {
  if (!isMobileLayout()) return;

  const infoPanel = document.getElementById("infoPanel");
  if (!infoPanel) return;

  state.mobileSheetOpen = true;
  state.mobileSheetExpanded = targetVh >= 88;
  state.infoCompact = false;

  infoPanel.classList.remove("bottom-sheet-dragging");
  infoPanel.style.transform = "";
  applyInfoCompactState();

  requestAnimationFrame(() => {
    setMobileBottomSheetHeight(targetVh);
  });
}

function closeMobileBottomSheet(animate = true) {
  if (!isMobileLayout()) return;

  const infoPanel = document.getElementById("infoPanel");
  if (!infoPanel) return;

  state.mobileSheetOpen = false;
  state.mobileSheetExpanded = false;
  state.infoCompact = true;

  infoPanel.classList.remove("bottom-sheet-dragging", "bottom-sheet-expanded");
  infoPanel.style.transform = "";
  infoPanel.style.height = "";

  if (!animate) {
    infoPanel.classList.add("bottom-sheet-hidden");
  }

  applyInfoCompactState();
}

function setMobileBottomSheetHeight(targetVh = 60) {
  const infoPanel = document.getElementById("infoPanel");
  if (!infoPanel || !isMobileLayout() || !state.mobileSheetOpen) return;

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 640;
  const minHeight = 200;
  const maxHeight = viewportHeight * (targetVh / 100);
  const naturalHeight = Math.ceil(infoPanel.scrollHeight || minHeight);
  const nextHeight = clamp(naturalHeight, minHeight, maxHeight);

  infoPanel.style.height = `${nextHeight}px`;
}

function getMobileSheetScrollContainer(eventTarget, infoPanel) {
  let current = eventTarget instanceof Element ? eventTarget : null;

  while (current && current !== infoPanel) {
    const style = window.getComputedStyle(current);
    const canScrollY = /(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight + 1;

    if (canScrollY) {
      return current;
    }

    current = current.parentElement;
  }

  return infoPanel;
}

function setupMobileBottomSheetGestures() {
  const infoPanel = document.getElementById("infoPanel");
  if (!infoPanel) return;

  let startY = 0;
  let startTime = 0;
  let dragging = false;
  let tracking = false;
  let activeScrollContainer = infoPanel;

  function resetDragState() {
    tracking = false;
    dragging = false;
    activeScrollContainer = infoPanel;
    infoPanel.classList.remove("bottom-sheet-dragging");
  }

  infoPanel.addEventListener("touchstart", (event) => {
    if (!isMobileLayout() || !state.mobileSheetOpen || event.touches.length !== 1) return;

    const touch = event.touches[0];
    startY = touch.clientY;
    startTime = performance.now();
    dragging = false;
    tracking = true;
    activeScrollContainer = getMobileSheetScrollContainer(event.target, infoPanel);
  }, { passive: true });

  infoPanel.addEventListener("touchmove", (event) => {
    if (!tracking || !isMobileLayout() || !state.mobileSheetOpen || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaY = touch.clientY - startY;
    const isPullingDown = deltaY > 0;
    const scrollTop = activeScrollContainer ? activeScrollContainer.scrollTop : infoPanel.scrollTop;

    // 內容仍可向上回捲時，維持原生 scroll，不接管成 sheet drag。
    if (!dragging && (!isPullingDown || scrollTop > 0)) {
      return;
    }

    if (!dragging && deltaY < 6) return;

    dragging = true;
    infoPanel.classList.add("bottom-sheet-dragging");
    infoPanel.style.transform = `translateY(${Math.max(0, deltaY)}px)`;

    // 只有在 scrollTop = 0 且向下拉時才阻止原生 scroll，避免兩者互搶。
    event.preventDefault();
  }, { passive: false });

  function finishTouchDrag(event) {
    if (!tracking) return;

    const touch = event.changedTouches && event.changedTouches[0];
    const endY = touch ? touch.clientY : startY;
    const deltaY = endY - startY;
    const elapsed = Math.max(1, performance.now() - startTime);
    const velocity = deltaY / elapsed;

    if (!dragging) {
      resetDragState();
      return;
    }

    resetDragState();

    if (deltaY > 80 || velocity > 0.62) {
      closeMobileBottomSheet();
      return;
    }

    infoPanel.style.transform = "";
    applyInfoCompactState();
    setMobileBottomSheetHeight(state.mobileSheetExpanded ? 90 : 60);
  }

  infoPanel.addEventListener("touchend", finishTouchDrag, { passive: true });
  infoPanel.addEventListener("touchcancel", () => {
    resetDragState();
    infoPanel.style.transform = "";
    applyInfoCompactState();
    setMobileBottomSheetHeight(state.mobileSheetExpanded ? 90 : 60);
  }, { passive: true });
}


/* =========================================================
[保留] 16. About modal
========================================================= */
function setupAboutModal() {
  const aboutBtn = document.getElementById("aboutBtn");
  const modal = document.getElementById("aboutModal");
  const closeBtn = document.getElementById("aboutCloseBtn");

  if (!aboutBtn || !modal) return;

  function openAboutModal() {
    state.aboutModalOpen = true;
    modal.classList.remove("hidden");
    modal.classList.add("about-modal-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("about-modal-lock");

    if (closeBtn) {
      setTimeout(() => closeBtn.focus(), 0);
    }
  }

  function closeAboutModal() {
    state.aboutModalOpen = false;
    modal.classList.remove("about-modal-open");
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("about-modal-lock");
  }

  aboutBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    openAboutModal();
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", closeAboutModal);
  }

  modal.addEventListener("click", (event) => {
    if (event.target && event.target.dataset && event.target.dataset.aboutClose === "true") {
      closeAboutModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.aboutModalOpen) {
      closeAboutModal();
    }
  });
}

/* =========================================================
[保留] 17. Utilities
========================================================= */
function getRandomTitleNumber() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

function setInfoTitle(titleText) {
  const title = document.getElementById("infoTitle");
  if (!title) return;

  const safeTitle = escapeHtml(titleText || "尚未選擇節點");
  const number = getRandomTitleNumber();

  title.innerHTML = `
    <span class="info-title-text">${safeTitle}</span>
    <span class="info-title-random-number">${number}</span>
  `;
}

/* ================================
   Resizable Panels - Pointer Events
   桌機 / 平板 / 手機共用拖曳邏輯
================================ */

function setupResizablePanels() {
  // Web/Desktop：Info Panel 改為 Resizable Bottom Drawer，只保留高度拖曳。
  // Mobile：仍使用 Bottom Sheet 手勢，不啟用 pointer resize。
  setupMainVerticalResize();
  setupInnerHorizontalResize();
}

function setupMainVerticalResize() {
  const handle = document.getElementById("infoDrawerHandle");
  const workspace = document.getElementById("workspace");

  if (!handle || !workspace) return;

  enablePointerResize(handle, {
    cursor: "row-resize",
    canStart: () => !isMobileLayout(),
    onMove: (event) => {
      const rect = workspace.getBoundingClientRect();
      const rawHeight = rect.bottom - event.clientY;
      const maxInfo = Math.max(320, rect.height * DESKTOP_INFO_MAX_VH);
      const nextHeight = clamp(rawHeight, DESKTOP_INFO_COLLAPSED_HEIGHT, maxInfo);

      const shouldCollapse = nextHeight <= DESKTOP_INFO_COLLAPSED_HEIGHT + 18;
      state.infoCompact = shouldCollapse;
      workspace.style.setProperty("--info-height", `${shouldCollapse ? DESKTOP_INFO_COLLAPSED_HEIGHT : nextHeight}px`);
      localStorage.setItem("infoHeight", String(shouldCollapse ? DESKTOP_INFO_COLLAPSED_HEIGHT : nextHeight));

      applyInfoCompactState();
      resizeGraphAfterPanelChange();
    },
  });
}

function setupInnerHorizontalResize() {
  const handle = document.getElementById("innerResizeHandle");
  const splitArea = document.querySelector(".info-split-area");

  if (!handle || !splitArea) return;

  enablePointerResize(handle, {
    cursor: () => (isMobileLayout() ? "row-resize" : "col-resize"),
    canStart: () => !isMobileLayout(),
    onMove: (event) => {
      const rect = splitArea.getBoundingClientRect();

      if (isMobileLayout()) {
        const ratio = ((event.clientY - rect.top) / rect.height) * 100;
        const nextRatio = clamp(ratio, 24, 76);
        splitArea.style.setProperty("--sentence-height", `${nextRatio}%`);
        localStorage.removeItem("sentenceHeight");
      } else {
        const ratio = ((event.clientX - rect.left) / rect.width) * 100;
        const nextRatio = clamp(ratio, 28, 72);
        splitArea.style.setProperty("--sentence-width", `${nextRatio}%`);
        localStorage.setItem("sentenceWidth", String(nextRatio));
      }
    },
  });
}

function setupInfoRightResize() {
  const handle = document.getElementById("infoRightResizeHandle");
  const infoPanel = document.getElementById("infoPanel");
  const workspace = document.getElementById("workspace");

  if (!handle || !infoPanel || !workspace) return;

  enablePointerResize(handle, {
    cursor: () => (isMobileLayout() ? "row-resize" : "col-resize"),
    canStart: () => !isMobileLayout(),
    onMove: (event) => {
      const rect = workspace.getBoundingClientRect();

      state.infoCompact = false;
      applyInfoCompactState();

      if (isMobileLayout()) {
        const infoHeight = rect.bottom - event.clientY;
        const minInfo = 76;
        const maxInfo = Math.max(240, rect.height * 0.76);
        const nextHeight = clamp(infoHeight, minInfo, maxInfo);
        workspace.style.setProperty("--info-height", `${nextHeight}px`);
        localStorage.removeItem("infoHeight");
      } else {
        const minWidth = Math.min(280, rect.width);
        const maxWidth = rect.width;
        const nextWidth = clamp(event.clientX - rect.left, minWidth, maxWidth);
        infoPanel.style.width = `${nextWidth}px`;
        localStorage.setItem("infoPanelWidth", String(nextWidth));
      }

      resizeGraphAfterPanelChange();
    },
  });
}

function enablePointerResize(handle, options) {
  let isDragging = false;

  handle.addEventListener("pointerdown", (event) => {
    if (typeof options.canStart === "function" && !options.canStart(event)) return;

    isDragging = true;

    try {
      handle.setPointerCapture(event.pointerId);
    } catch (_) {}

    const cursor = typeof options.cursor === "function" ? options.cursor(event) : options.cursor;

    document.body.style.cursor = cursor || "";
    document.body.style.userSelect = "none";
    document.body.style.touchAction = "none";

    event.preventDefault();
  });

  handle.addEventListener("pointermove", (event) => {
    if (!isDragging) return;

    if (typeof options.onMove === "function") {
      options.onMove(event);
    }

    event.preventDefault();
  });

  handle.addEventListener("pointerup", (event) => {
    if (!isDragging) return;

    isDragging = false;

    try {
      handle.releasePointerCapture(event.pointerId);
    } catch (_) {}

    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.body.style.touchAction = "";
  });

  handle.addEventListener("pointercancel", () => {
    isDragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.body.style.touchAction = "";
  });
}

function restorePanelPreferences() {
  const workspace = document.getElementById("workspace");
  const splitArea = document.querySelector(".info-split-area");

  if (!workspace) return;

  // JS-11C：桌機恢復資訊欄高度；手機不記住高度。
  if (!isMobileLayout()) {
    const savedInfoHeight = Number(localStorage.getItem("infoHeight"));
    if (Number.isFinite(savedInfoHeight) && savedInfoHeight >= DESKTOP_INFO_COLLAPSED_HEIGHT && savedInfoHeight <= window.innerHeight * DESKTOP_INFO_MAX_VH) {
      workspace.style.setProperty("--info-height", `${savedInfoHeight}px`);
    } else {
      workspace.style.setProperty("--info-height", `${DESKTOP_INFO_DEFAULT_HEIGHT}px`);
    }

    // JS-12B：桌機恢復句子 / 出處左右比例；手機不記住上下比例。
    const savedSentenceWidth = Number(localStorage.getItem("sentenceWidth"));
    if (splitArea && Number.isFinite(savedSentenceWidth) && savedSentenceWidth >= 28 && savedSentenceWidth <= 72) {
      splitArea.style.setProperty("--sentence-width", `${savedSentenceWidth}%`);
    }
  } else {
    localStorage.removeItem("infoHeight");
    localStorage.removeItem("sentenceHeight");
  }
}

function setupFloatingNoteAutoHide() {
  // JS-4A：每次進頁面都顯示 floating-note，20 秒後自動隱藏。
  const note = document.querySelector(".floating-note");
  if (!note) return;

  note.classList.remove("floating-note-hidden");

  window.setTimeout(() => {
    note.classList.add("floating-note-hidden");
  }, 20000);
}

function updateFloatingLayoutVars() {
  const appShell = document.querySelector(".app-shell");
  const sidebar = document.getElementById("sidebar");

  if (!appShell || !sidebar) return;

  if (isMobileLayout()) {
    appShell.style.setProperty("--sidebar-left", "8px");
    appShell.style.setProperty("--sidebar-top", "8px");
    appShell.style.setProperty("--sidebar-width", "auto");
    appShell.style.setProperty("--info-left", "8px");
    appShell.style.setProperty("--info-right", "8px");
    return;
  }

  const isCollapsed = appShell.classList.contains("sidebar-collapsed");
  const sidebarLeft = 20;
  const sidebarWidth = isCollapsed ? 64 : 340;
  const infoLeft = isCollapsed ? 96 : 400;

  appShell.style.setProperty("--sidebar-left", `${sidebarLeft}px`);
  appShell.style.setProperty("--sidebar-top", "20px");
  appShell.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
  appShell.style.setProperty("--info-left", `${infoLeft}px`);
  appShell.style.setProperty("--info-right", "20px");
}

function syncMobileOnlyResizeHandles() {
  const shouldHide = isMobileLayout();
  ["mainResizeHandle", "innerResizeHandle", "infoRightResizeHandle"].forEach((id) => {
    const handle = document.getElementById(id);
    if (!handle) return;

    if (shouldHide) {
      handle.setAttribute("hidden", "");
      handle.setAttribute("aria-hidden", "true");
    } else {
      handle.removeAttribute("hidden");
      handle.removeAttribute("aria-hidden");
    }
  });
}


function updateMobileToolbarPosition() {
  const appShell = document.querySelector(".app-shell");
  const sidebar = document.getElementById("sidebar");

  if (!appShell) return;

  if (!isMobileLayout()) {
    appShell.style.removeProperty("--mobile-toolbar-top");
    return;
  }

  if (!sidebar || appShell.classList.contains("sidebar-collapsed")) {
    appShell.style.setProperty("--mobile-toolbar-top", "8px");
    return;
  }

  const rect = sidebar.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 640;
  const nextTop = Math.min(Math.max(8, Math.ceil(rect.bottom + 8)), Math.max(8, viewportHeight - 58));
  appShell.style.setProperty("--mobile-toolbar-top", `${nextTop}px`);
}


function collapseMobileSidebar() {
  if (!isMobileLayout()) return;
  const appShell = document.querySelector(".app-shell");
  const sidebar = document.getElementById("sidebar");
  const categoryToggleBtn = document.getElementById("categoryToggleBtn");
  if (!appShell) return;

  appShell.classList.add("sidebar-collapsed");
  localStorage.setItem("sidebarCollapsed", "1");
  if (sidebar) sidebar.classList.remove("categories-open");
  if (categoryToggleBtn) categoryToggleBtn.setAttribute("aria-expanded", "false");
  updateFloatingLayoutVars();
  updateMobileToolbarPosition();
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resizeGraphAfterPanelChange() {
  if (!state.svg) return;

  const graphCard = document.querySelector(".graph-card");
  if (!graphCard) return;

  const width = graphCard.clientWidth;
  const height = graphCard.clientHeight;

  state.svg.attr("viewBox", [0, 0, width, height]);

  if (state.simulation) {
    state.simulation.force("center", d3.forceCenter(width / 2, height / 2));
  }
}



/* ================================
   Intro Overlay
   進站星空短句開場
================================ */

const INTRO_MAX_CHARS = 16;
const INTRO_DURATION_MS = 6600;
const FALLBACK_INTRO_MESSAGES = [
  "慢慢靠近自己",
  "讓心安靜下來",
  "你正在回到自己",
  "看見內在的光",
  "今天也溫柔前行",
  "答案正在浮現",
  "把心交還給自己",
  "讓靈魂自由呼吸",
  "願你與光同行",
  "此刻就是入口"
];

async function setupIntroOverlay() {
  const overlay = document.getElementById("introOverlay");
  const textEl = document.getElementById("introMessageText");
  const greetingEl = document.getElementById("introGreetingText");

  if (!overlay || !textEl) {
    finishIntroGraphReveal();
    return;
  }

  // Greeting should start immediately when the page opens; do not wait for intro message fetch.
  startIntroGreetingTypewriter(greetingEl);

  const message = await pickIntroMessage();
  textEl.textContent = message;

  let closed = false;

  function closeIntroOverlay() {
    if (closed) return;
    closed = true;
    overlay.classList.add("intro-overlay-leaving");

    window.setTimeout(() => {
      overlay.classList.add("intro-overlay-hidden");
      overlay.setAttribute("aria-hidden", "true");
      finishIntroGraphReveal();
    }, 720);
  }

  overlay.addEventListener("click", closeIntroOverlay);

  const skipBtn = document.getElementById("introSkipBtn");
  if (skipBtn) {
    skipBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      closeIntroOverlay();
    });
  }

  window.setTimeout(closeIntroOverlay, INTRO_DURATION_MS);
}

function finishIntroGraphReveal() {
  state.isInitialLoading = false;
  state.introFinished = true;
  state.hasEnteredUniverse = true;
  state.currentFocus = { type: "universe", value: null };

  // Graph start is intentionally delayed until the overlay has faded.
  // Reference behavior: keep the board quiet first, then let visible nodes expand organically from the center.
  document.body.classList.remove("graph-intro-active");
  document.body.classList.add("graph-board-visible", "graph-entering");

  requestAnimationFrame(() => {
    updateGraph();
    startUniverseEntryAnimation();
  });
}

function startIntroGreetingTypewriter(element) {
  if (!element) return;

  const characters = Array.from(INTRO_GREETING_TEXT);
  const delay = Math.max(24, Math.floor(INTRO_GREETING_TYPE_MS / Math.max(1, characters.length)));
  let index = 0;

  element.textContent = "";
  element.classList.remove("intro-greeting-done");

  const timer = window.setInterval(() => {
    index += 1;
    element.textContent = characters.slice(0, index).join("");

    if (index >= characters.length) {
      window.clearInterval(timer);
      element.classList.add("intro-greeting-done");
    }
  }, delay);
}

async function pickIntroMessage() {
  const candidates = [];

  try {
    const messages = await fetchJson(DATA_PATHS.intro);
    candidates.push(...normalizeIntroMessageList(messages));
  } catch (_) {
    // intro_messages.json is optional. Fallback to graph data below.
  }

  candidates.push(...collectIntroMessagesFromGraph());
  candidates.push(...FALLBACK_INTRO_MESSAGES);

  const validMessages = Array.from(new Set(candidates))
    .map((item) => String(item || "").trim())
    .filter(isValidIntroMessage);

  if (validMessages.length === 0) return "慢慢靠近自己";

  const index = Math.floor(Math.random() * validMessages.length);
  return validMessages[index];
}

function normalizeIntroMessageList(data) {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data.map((item) => {
      if (typeof item === "string") return item;
      return item.text || item.message || item.phrase || item.label || "";
    });
  }

  if (Array.isArray(data.messages)) {
    return normalizeIntroMessageList(data.messages);
  }

  if (Array.isArray(data.phrases)) {
    return normalizeIntroMessageList(data.phrases);
  }

  return [];
}

function collectIntroMessagesFromGraph() {
  const messages = [];

  state.allNodes.forEach((node) => {
    if (node.type === "phrase" && node.label) messages.push(node.label);
    if (node.text_preview) {
      String(node.text_preview)
        .split(/\|\||[。！？!?；;\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => messages.push(item));
    }
  });

  Object.values(state.graphSources || {}).forEach((sourceList) => {
    if (!Array.isArray(sourceList)) return;
    sourceList.slice(0, 80).forEach((source) => {
      const text = source.text || source.title || "";
      String(text)
        .split(/[。！？!?；;\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => messages.push(item));
    });
  });

  return messages;
}

function isValidIntroMessage(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return false;
  if (Array.from(normalized).length > INTRO_MAX_CHARS) return false;
  return hasSearchableMeaning(normalized);
}

function normalizeSearchKeyword(value) {
  const keyword = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  return hasSearchableMeaning(keyword) ? keyword : "";
}

function hasSearchableMeaning(text) {
  return /[\p{Script=Han}A-Za-z0-9]/u.test(String(text || ""));
}

function buildSearchHaystack(node) {
  const card = getCardForNode(node);
  const fields = [
    node.id,
    node.label,
    node.type,
    typeLabel(node.type),
    node.level1_category,
    node.level2_concept,
    node.matched_terms,
    node.canonical_term,
    node.text_preview,
    node.count,
    card.display_name,
    card.title,
    card.topic,
    card.theme,
    card.playlist_type_tag,
    card.tags,
    card.aliases,
    card.related_terms,
    card.sentences,
  ];

  const sources = getSourcesForNodeWithFallback(node, card);
  sources.forEach((source) => {
    fields.push(
      source.title,
      source.file,
      source.timestamp,
      source.timestamp_url,
      source.base_url,
      source.text
    );
  });

  return fields
    .filter((item) => item !== undefined && item !== null)
    .map((item) => String(item).toLowerCase())
    .join(" ");
}

/* ================================
   Filtering
================================ */

function getFilteredData() {
  const nodes = getVisibleNodes();
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const edges = getVisibleEdges(visibleNodeIds);

  state.currentNodes = nodes;
  state.currentEdges = edges;
  return { nodes, edges };
}

function isCoreConceptNode(node) {
  const roleFields = [
    node.concept_role,
    node.concept_rank,
    node.role,
    node.card_role,
    node.node_role,
  ].filter(Boolean).map((item) => String(item).toLowerCase());

  if (roleFields.some((item) => item.includes("core") || item.includes("核心"))) return true;
  if (node.is_core === true || node.core === true) return true;
  return false;
}

function isGraphEligibleConcept(node) {
  const values = [node.graph_eligible, node.graphEligible, node.public_safe, node.publicSafe]
    .filter((item) => item !== undefined && item !== null)
    .map((item) => String(item).trim().toLowerCase());

  if (values.some((item) => ["no", "false", "0", "否", "不公開"].includes(item))) return false;
  return true;
}

function getConceptPriorityScore(node) {
  const confidence = Number(node.confidence ?? node.score ?? node.semantic_score ?? 0);
  const frequency = Number(node.frequency ?? node.count ?? 0);
  let score = 0;
  if (isGraphEligibleConcept(node)) score += 100000;
  if (isCoreConceptNode(node)) score += 50000;
  if (Number.isFinite(confidence)) score += confidence * 1000;
  if (Number.isFinite(frequency)) score += Math.min(frequency, 5000);
  return score;
}

function getUniverseConceptNodes() {
  const concepts = state.allNodes
    .filter((node) => node.type === "concept")
    .filter((node) => state.visibleTypes.has("concept"))
    .filter((node) => state.selectedCategory === "all" || node.level1_category === state.selectedCategory)
    .filter(isGraphEligibleConcept)
    .sort((a, b) => getConceptPriorityScore(b) - getConceptPriorityScore(a));

  return concepts.slice(0, INITIAL_CONCEPT_LIMIT);
}

function getUniverseNodes() {
  const topics = state.allNodes.filter((node) => {
    if (node.type !== "topic") return false;
    if (!state.visibleTypes.has("topic")) return false;
    if (state.selectedCategory !== "all" && node.level1_category !== state.selectedCategory) return false;
    return true;
  });

  return [...topics, ...getUniverseConceptNodes()];
}

function getVisibleNodes() {
  const universeNodes = getUniverseNodes();
  const universeIds = new Set(universeNodes.map((node) => node.id));

  // Display density rule: the universe is always Topic + Concept.
  // Terms are only "called out" around an active Concept.
  const expandedTerms = state.allNodes
    .filter((node) => node.type === "term" && state.expandedTermNodeIds.has(node.id))
    .slice(0, EXPANDED_TERM_LIMIT);

  const byId = new Map();
  universeNodes.forEach((node) => byId.set(node.id, node));
  expandedTerms.forEach((node) => byId.set(node.id, node));

  // If a selected Concept was not in the top 250 universe set, keep it visible during focus.
  if (state.activeConceptId && !universeIds.has(state.activeConceptId)) {
    const activeConcept = getNodeById(state.activeConceptId);
    if (activeConcept && activeConcept.type === "concept") byId.set(activeConcept.id, activeConcept);
  }

  // If a selected Term is focused, keep it visible without opening the whole term universe.
  if (state.activeTermId) {
    const activeTerm = getNodeById(state.activeTermId);
    if (activeTerm && activeTerm.type === "term") byId.set(activeTerm.id, activeTerm);
  }

  return Array.from(byId.values()).filter((node) => ["topic", "concept", "term"].includes(node.type));
}

function getVisibleEdges(visibleNodeIds) {
  return state.allEdges.filter((edge) => {
    const sourceId = getEdgeSourceId(edge);
    const targetId = getEdgeTargetId(edge);
    if (!visibleNodeIds.has(sourceId) || !visibleNodeIds.has(targetId)) return false;

    const sourceNode = getNodeById(sourceId);
    const targetNode = getNodeById(targetId);
    if (!sourceNode || !targetNode) return false;

    const hasTerm = sourceNode.type === "term" || targetNode.type === "term";
    if (hasTerm) {
      return state.expandedTermNodeIds.has(sourceId) ||
        state.expandedTermNodeIds.has(targetId) ||
        sourceId === state.activeTermId ||
        targetId === state.activeTermId;
    }

    const types = new Set([sourceNode.type, targetNode.type]);
    return (types.has("topic") && types.has("concept")) ||
      (sourceNode.type === "concept" && targetNode.type === "concept");
  });
}

function getMainViewData() {
  const nodes = getUniverseNodes();
  const visibleIds = new Set(nodes.map((node) => node.id));
  const edges = getVisibleEdges(visibleIds);
  return { nodes, edges };
}

function getTermsForConcept(conceptId) {
  return Array.from(getDirectTermIdsForConcept(conceptId))
    .map((id) => getNodeById(id))
    .filter((node) => node && node.type === "term")
    .sort((a, b) => {
      const bCount = Number(b.count || b.frequency || 0);
      const aCount = Number(a.count || a.frequency || 0);
      return bCount - aCount;
    })
    .slice(0, EXPANDED_TERM_LIMIT);
}

function expandTermsAroundConcept(conceptId) {
  const terms = getTermsForConcept(conceptId);
  state.expandedTermNodeIds = new Set(terms.map((term) => term.id));
  return terms;
}

function clearExpandedTerms() {
  state.expandedTermNodeIds = new Set();
}

function getConceptTermsData(conceptId) {
  expandTermsAroundConcept(conceptId);
  return getFilteredData();
}

function getTermContextData(conceptId, termId) {
  if (conceptId) expandTermsAroundConcept(conceptId);
  if (termId) state.expandedTermNodeIds.add(termId);
  return getFilteredData();
}

function getNodeById(nodeId) {
  return state.allNodes.find((node) => node.id === nodeId);
}

function getEdgeSourceId(edge) {
  return typeof edge.source === "object" ? edge.source.id : edge.source;
}

function getEdgeTargetId(edge) {
  return typeof edge.target === "object" ? edge.target.id : edge.target;
}

function getDirectTermIdsForConcept(conceptId) {
  const ids = new Set();
  const conceptNode = getNodeById(conceptId);
  const conceptLabel = conceptNode ? String(conceptNode.label || conceptNode.canonical_term || conceptNode.id || "") : "";

  // Always use the original full edge list here. In main view, state.currentEdges only contains
  // Topic/Concept edges, so using it would incorrectly hide all Concept → Term relationships.
  state.allEdges.forEach((edge) => {
    const sourceId = getEdgeSourceId(edge);
    const targetId = getEdgeTargetId(edge);
    if (sourceId !== conceptId && targetId !== conceptId) return;

    const otherId = sourceId === conceptId ? targetId : sourceId;
    const otherNode = getNodeById(otherId);
    if (otherNode && otherNode.type === "term") ids.add(otherId);
  });

  // Field-based fallback for data sets where Term ↔ Concept is stored as node metadata.
  state.allNodes.forEach((node) => {
    if (!node || node.type !== "term") return;

    const parentFields = [
      node.parentId,
      node.parent_id,
      node.conceptId,
      node.concept_id,
      node.belongs_to,
      node.topic,
      node.level2_concept,
    ].filter((item) => item !== undefined && item !== null).map((item) => String(item));

    if (
      parentFields.includes(conceptId) ||
      (conceptLabel && parentFields.includes(conceptLabel))
    ) {
      ids.add(node.id);
    }
  });

  return ids;
}

function getDirectTermNeighborIds(termId) {
  const ids = new Set();

  state.allEdges.forEach((edge) => {
    const sourceId = getEdgeSourceId(edge);
    const targetId = getEdgeTargetId(edge);
    if (sourceId !== termId && targetId !== termId) return;

    const otherId = sourceId === termId ? targetId : sourceId;
    const otherNode = getNodeById(otherId);
    if (otherNode && otherNode.type === "term") ids.add(otherId);
  });

  return ids;
}

function findParentConceptIdForTerm(termId) {
  let fallbackConceptId = null;
  const termNode = getNodeById(termId);

  state.allEdges.forEach((edge) => {
    const sourceId = getEdgeSourceId(edge);
    const targetId = getEdgeTargetId(edge);
    if (sourceId !== termId && targetId !== termId) return;

    const otherId = sourceId === termId ? targetId : sourceId;
    const otherNode = getNodeById(otherId);
    if (otherNode && otherNode.type === "concept" && !fallbackConceptId) fallbackConceptId = otherId;
  });

  if (fallbackConceptId) return fallbackConceptId;

  if (termNode) {
    const parentFields = [
      termNode.parentId,
      termNode.parent_id,
      termNode.conceptId,
      termNode.concept_id,
      termNode.belongs_to,
      termNode.topic,
      termNode.level2_concept,
    ].filter((item) => item !== undefined && item !== null).map((item) => String(item));

    const concept = state.allNodes.find((node) => {
      if (!node || node.type !== "concept") return false;
      return parentFields.includes(String(node.id)) ||
        parentFields.includes(String(node.label || "")) ||
        parentFields.includes(String(node.canonical_term || ""));
    });

    if (concept) return concept.id;
  }

  return null;
}


/* ================================
   Graph Rendering
================================ */


function ensureSvgDefs(svg) {
  const defs = svg.append("defs");

  const countGradient = defs
    .append("linearGradient")
    .attr("id", "countGradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");

  countGradient
    .append("stop")
    .attr("offset", "0%")
    .attr("stop-color", "#c98f7a");

  countGradient
    .append("stop")
    .attr("offset", "48%")
    .attr("stop-color", "#d8a36f");

  countGradient
    .append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#7d7ee8");
}

/* =========================================================
[不要大改] 11. Graph render
- 首頁 preset layout；點擊後才進 concept_terms / term_context。
========================================================= */
function renderGraph() {
  const svg = d3.select("#graphSvg");
  state.svg = svg;

  const graphCard = document.querySelector(".graph-card");
  const width = graphCard.clientWidth;
  const height = graphCard.clientHeight;

  svg.attr("viewBox", [0, 0, width, height]);
  svg.selectAll("*").remove();


  ensureSvgDefs(svg);
  state.zoomLayer = svg.append("g").attr("class", "zoom-layer");

  state.linkSelection = state.zoomLayer.append("g").attr("class", "links");
  state.nodeSelection = state.zoomLayer.append("g").attr("class", "nodes");

  state.zoomBehavior = d3
    .zoom()
    .scaleExtent([0.22, 4])
    .on("zoom", (event) => {
      state.zoomLayer.attr("transform", event.transform);
    });

  svg.call(state.zoomBehavior);
  svg.on("dblclick.zoom", null);

  updateGraph();
}

function updateGraph() {
  const { nodes, edges } = getFilteredData();

  const emptyState = document.getElementById("emptyState");
  if (emptyState) {
    emptyState.classList.toggle("hidden", nodes.length > 0);
  }

  const graphCard = document.querySelector(".graph-card");
  const width = graphCard.clientWidth;
  const height = graphCard.clientHeight;

  stopActiveSimulation();

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const preparedEdges = edges
    .filter((edge) => nodeMap.has(getEdgeSourceId(edge)) && nodeMap.has(getEdgeTargetId(edge)))
    .map((edge) => ({ ...edge }));

  if (state.isInitialLoading || !state.hasEnteredUniverse) {
    applyCenterStardustLayout(nodes, width, height);
  } else if (state.currentFocus.type === "universe") {
    applyUniverseLayout(nodes, preparedEdges, width, height);
  } else if (state.currentFocus.type === "node") {
    applyConceptFocusLayout(nodes, preparedEdges, width, height);
  }

  state.linkSelection
    .selectAll("line")
    .data(preparedEdges, (edge) => edge.id || `${getEdgeSourceId(edge)}__${getEdgeTargetId(edge)}__${edge.type || "edge"}`)
    .join(
      (enter) =>
        enter
          .append("line")
          .attr("class", "link")
          .attr("stroke", (edge) => edgeColors[edge.type] || "rgba(96,129,137,0.5)")
          .attr("stroke-width", (edge) => Math.max(1, Math.min(5, Math.log((edge.weight || 1) + 1)))),
      (update) => update,
      (exit) => exit.remove()
    );

  const nodeEnter = state.nodeSelection
    .selectAll("g")
    .data(nodes, (node) => node.id)
    .join(
      (enter) => {
        const g = enter
          .append("g")
          .attr("class", (node) => getNodeClassName(node))
          .call(
            d3
              .drag()
              .on("start", dragStarted)
              .on("drag", dragged)
              .on("end", dragEnded)
          );

        g.append("circle")
          .attr("r", (node) => getNodeRadius(node))
          .attr("fill", (node) => nodeColors[node.type] || nodeColors.unknown);

        g.append("text")
          .attr("class", "node-label")
          .attr("text-anchor", "middle")
          .attr("dy", (node) => getNodeRadius(node) + 15)
          .attr("font-size", (node) => getLabelSize(node))
          .each(function (node) {
            renderNodeLabel(d3.select(this), node);
          });

        g.on("click", (event, node) => {
          event.stopPropagation();
          handleNodeClick(node);
        });

        g.on("dblclick", (event) => {
          event.stopPropagation();
        });

        return g;
      },
      (update) => {
        update
          .attr("class", (node) => getNodeClassName(node))
          .select("circle")
          .attr("r", (node) => getNodeRadius(node))
          .attr("fill", (node) => nodeColors[node.type] || nodeColors.unknown);

        update
          .select("text")
          .attr("dy", (node) => getNodeRadius(node) + 15)
          .attr("font-size", (node) => getLabelSize(node))
          .each(function (node) {
            renderNodeLabel(d3.select(this), node);
          });

        return update;
      },
      (exit) => exit.remove()
    );

  state.svg.on("click", () => {
    if (isMobileLayout()) collapseMobileSidebar();
  });

  state.svg.on("dblclick", (event) => {
    if (event.target && event.target.closest && event.target.closest(".node")) return;
    resetZoom();
  });

  updateStaticGraphPositions();
  applyGraphFocusClasses();
  updateBackToMainButton();
}

function getNodeClassName(node) {
  return [
    "node",
    `node-${node.type}`,
    isCoreConceptNode(node) ? "node-core" : "",
    state.expandedTermNodeIds.has(node.id) ? "node-expanded-term" : "",
  ].filter(Boolean).join(" ");
}

function applyCenterStardustLayout(nodes, width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  nodes.forEach((node, index) => {
    const radius = 8 + (index % 7) * 1.8;
    const angle = index * GOLDEN_ANGLE;
    node.x = centerX + Math.cos(angle) * radius;
    node.y = centerY + Math.sin(angle) * radius;
    node.fx = node.x;
    node.fy = node.y;
  });
}

function applyUniverseLayout(nodes, edges, width, height) {
  const topics = nodes.filter((node) => node.type === "topic");
  const concepts = nodes.filter((node) => node.type === "concept");
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * (isMobileLayout() ? 0.31 : 0.36);
  const topicByConcept = buildTopicByConceptMap(concepts, topics, edges);

  topics.forEach((node, index) => {
    const saved = state.manualMainPositions.get(node.id);
    if (saved) {
      node.x = saved.x;
      node.y = saved.y;
    } else if (!Number.isFinite(node.x) || !state.initialAnimationDone) {
      const angle = MAIN_LAYOUT_RING_START_ANGLE + (Math.PI * 2 * index) / Math.max(1, topics.length);
      node.x = centerX + Math.cos(angle) * radius;
      node.y = centerY + Math.sin(angle) * radius;
    }
    node.fx = node.x;
    node.fy = node.y;
  });

  const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
  concepts.forEach((node, index) => {
    const saved = state.manualMainPositions.get(node.id);
    if (saved) {
      node.x = saved.x;
      node.y = saved.y;
    } else if (!Number.isFinite(node.x) || !state.initialAnimationDone) {
      const topic = topicMap.get(topicByConcept.get(node.id));
      const baseX = topic ? topic.x : centerX;
      const baseY = topic ? topic.y : centerY;
      const angle = index * GOLDEN_ANGLE + seededUnitFromText(node.id, 88) * Math.PI * 2;
      const ring = (isMobileLayout() ? 86 : 118) + (index % 4) * (isMobileLayout() ? 26 : 34);
      node.x = clamp(baseX + Math.cos(angle) * ring, 36, width - 36);
      node.y = clamp(baseY + Math.sin(angle) * ring, 42, height - 42);
    }
    node.fx = node.x;
    node.fy = node.y;
  });
}

function applyConceptFocusLayout(nodes, edges, width, height) {
  applyUniverseLayout(nodes.filter((node) => node.type !== "term"), edges, width, height);
  const concept = nodes.find((node) => node.id === state.activeConceptId && node.type === "concept");
  if (!concept) return;
  const terms = nodes.filter((node) => node.type === "term" && state.expandedTermNodeIds.has(node.id));
  placeTermsAroundConcept(concept, terms, width, height);
}

function placeTermsAroundConcept(conceptNode, terms, width, height) {
  const innerRadius = isMobileLayout() ? 70 : TERM_ORBIT_INNER_RADIUS;
  const outerRadius = isMobileLayout() ? 108 : TERM_ORBIT_OUTER_RADIUS;

  terms.slice(0, EXPANDED_TERM_LIMIT).forEach((term, index) => {
    const isOuter = index >= 12;
    const radius = isOuter ? outerRadius : innerRadius;
    const ringIndex = isOuter ? index - 12 : index;
    const ringCount = isOuter ? Math.max(1, terms.length - 12) : Math.min(terms.length, 12);
    const angle = (Math.PI * 2 * ringIndex) / Math.max(1, ringCount) - Math.PI / 2;

    term.x = clamp((conceptNode.x || width / 2) + Math.cos(angle) * radius, 28, width - 28);
    term.y = clamp((conceptNode.y || height / 2) + Math.sin(angle) * radius, 32, height - 32);
    term.fx = term.x;
    term.fy = term.y;
  });
}

function applyFocusedTermOrbitLayout(nodes, width, height) {
  if (state.viewMode !== "concept_terms" && state.viewMode !== "term_context") return;

  const activeConcept = nodes.find((node) => node.id === state.activeConceptId && node.type === "concept") ||
    nodes.find((node) => node.type === "concept");
  if (!activeConcept) return;

  if (!Number.isFinite(activeConcept.x)) activeConcept.x = width / 2;
  if (!Number.isFinite(activeConcept.y)) activeConcept.y = height / 2;

  const terms = nodes.filter((node) => node.type === "term");
  const radius = isMobileLayout() ? 124 : 178;
  const spread = isMobileLayout() ? 38 : 54;

  terms.forEach((term, index) => {
    const angle = index * GOLDEN_ANGLE + seededUnitFromText(term.id, 31) * Math.PI * 2;
    const ring = radius + (index % 3) * spread + seededUnitFromText(term.id, 32) * 28;
    term.x = clamp(activeConcept.x + Math.cos(angle) * ring, 42, width - 42);
    term.y = clamp(activeConcept.y + Math.sin(angle) * ring, 48, height - 48);
  });
}

function getFocusedForceTarget(node, width, height) {
  if (state.viewMode !== "concept_terms" && state.viewMode !== "term_context") {
    return { x: width / 2, y: height / 2 };
  }

  const activeConcept = state.currentNodes.find((item) => item.id === state.activeConceptId && item.type === "concept") ||
    state.currentNodes.find((item) => item.type === "concept");

  if (!activeConcept) return { x: width / 2, y: height / 2 };

  if (node.type === "term") {
    const angle = seededUnitFromText(node.id, 41) * Math.PI * 2;
    const radius = isMobileLayout() ? 130 : 190;
    return {
      x: clamp((activeConcept.x || width / 2) + Math.cos(angle) * radius, 48, width - 48),
      y: clamp((activeConcept.y || height / 2) + Math.sin(angle) * radius, 54, height - 54),
    };
  }

  return { x: activeConcept.x || width / 2, y: activeConcept.y || height / 2 };
}

function startUniverseEntryAnimation() {
  if (!state.introFinished || !state.currentNodes || state.currentNodes.length === 0) return;

  const graphCard = document.querySelector(".graph-card");
  if (!graphCard || !state.nodeSelection || !state.linkSelection) return;

  stopActiveSimulation();
  state.initialAnimationDone = false;
  state.manualMainPositions.clear();

  document.body.classList.add("graph-entering", "graph-board-visible");
  document.body.classList.remove(
    "graph-topic-visible",
    "intro-concepts-visible",
    "graph-edges-visible",
    "graph-interaction-enabled",
    "graph-intro-finished"
  );

  const width = graphCard.clientWidth;
  const height = graphCard.clientHeight;

  // Step A: all initial visible nodes start as quiet stardust near the center.
  // This mirrors the older force-graph feel, but is now gated until Intro Overlay ends.
  applyCenterStardustLayout(state.currentNodes, width, height);
  state.currentNodes.forEach((node) => {
    node.vx = 0;
    node.vy = 0;
  });
  updateStaticGraphPositions();

  window.setTimeout(() => {
    document.body.classList.add("graph-topic-visible");
    runTopicAnchorSimulation();
  }, GRAPH_ENTRY_TOPIC_DELAY_MS);

  window.setTimeout(() => {
    document.body.classList.add("intro-concepts-visible");
    runConceptSurfaceSimulation();
  }, GRAPH_ENTRY_CONCEPT_DELAY_MS);

  window.setTimeout(() => {
    state.initialAnimationDone = true;
    state.currentFocus = { type: "universe", value: null };
    document.body.classList.add("graph-edges-visible", "graph-interaction-enabled", "graph-intro-finished");
    document.body.classList.remove("graph-entering");
    freezeCurrentUniversePositions();
    updateStaticGraphPositions();
    fitVisibleNodes();
  }, GRAPH_ENTRY_EDGES_DELAY_MS);
}

function runTopicAnchorSimulation() {
  const graphCard = document.querySelector(".graph-card");
  if (!graphCard) return;

  const width = graphCard.clientWidth;
  const height = graphCard.clientHeight;
  const topics = (state.currentNodes || []).filter((node) => node.type === "topic");
  if (!topics.length) return;

  stopActiveSimulation();
  const targetMap = buildSpreadTargetMap(topics, width, height, {
    marginRatioX: isMobileLayout() ? 0.16 : 0.14,
    marginRatioY: isMobileLayout() ? 0.16 : 0.14,
    salt: 131,
  });

  topics.forEach((node, index) => {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      const center = getGraphCenter(width, height);
      node.x = center.x + Math.cos(index * GOLDEN_ANGLE) * 8;
      node.y = center.y + Math.sin(index * GOLDEN_ANGLE) * 8;
    }
    node.fx = null;
    node.fy = null;
  });

  state.simulation = d3.forceSimulation(topics)
    .alpha(1)
    .alphaDecay(0.04)
    .velocityDecay(0.34)
    .force("charge", d3.forceManyBody().strength(-980))
    .force("collision", d3.forceCollide().radius((node) => getNodeRadius(node) + 58).strength(1))
    .force("x", d3.forceX((node) => targetMap.get(node.id)?.x || width / 2).strength(0.22))
    .force("y", d3.forceY((node) => targetMap.get(node.id)?.y || height / 2).strength(0.22))
    .on("tick", updateStaticGraphPositions);

  state.simulationStopTimer = window.setTimeout(() => {
    stopActiveSimulation(false);
    topics.forEach((node) => {
      const target = targetMap.get(node.id) || { x: node.x || width / 2, y: node.y || height / 2 };
      node.x = Number.isFinite(node.x) ? node.x : target.x;
      node.y = Number.isFinite(node.y) ? node.y : target.y;
      node.fx = node.x;
      node.fy = node.y;
      state.manualMainPositions.set(node.id, { x: node.x, y: node.y });
    });
    updateStaticGraphPositions();
  }, GRAPH_ENTRY_TOPIC_SIM_STOP_MS);
}

function runConceptSurfaceSimulation() {
  const graphCard = document.querySelector(".graph-card");
  if (!graphCard) return;

  const width = graphCard.clientWidth;
  const height = graphCard.clientHeight;
  const nodes = (state.currentNodes || []).filter((node) => node.type === "topic" || node.type === "concept");
  const topics = nodes.filter((node) => node.type === "topic");
  const concepts = nodes.filter((node) => node.type === "concept");
  if (!nodes.length) return;

  stopActiveSimulation();
  const topicByConcept = buildTopicByConceptMap(concepts, topics, state.currentEdges || []);
  const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
  const conceptTargetMap = buildConceptTargetMap(concepts, topicByConcept, topicMap, width, height);

  topics.forEach((topic) => {
    if (!Number.isFinite(topic.x) || !Number.isFinite(topic.y)) {
      const saved = state.manualMainPositions.get(topic.id);
      topic.x = saved?.x || width / 2;
      topic.y = saved?.y || height / 2;
    }
    topic.fx = topic.x;
    topic.fy = topic.y;
    state.manualMainPositions.set(topic.id, { x: topic.x, y: topic.y });
  });

  concepts.forEach((concept, index) => {
    if (!Number.isFinite(concept.x) || !Number.isFinite(concept.y) || !state.initialAnimationDone) {
      const parentTopic = topicMap.get(topicByConcept.get(concept.id));
      const baseX = parentTopic?.x || width / 2;
      const baseY = parentTopic?.y || height / 2;
      concept.x = baseX + Math.cos(index * GOLDEN_ANGLE) * 10;
      concept.y = baseY + Math.sin(index * GOLDEN_ANGLE) * 10;
    }
    concept.fx = null;
    concept.fy = null;
  });

  const preparedEdges = (state.currentEdges || []).map((edge) => ({ ...edge }));

  state.simulation = d3.forceSimulation(nodes)
    .alpha(1)
    .alphaDecay(0.045)
    .velocityDecay(0.40)
    .force("link", d3.forceLink(preparedEdges)
      .id((node) => node.id)
      .distance((edge) => getLinkDistance(edge))
      .strength(0.20))
    .force("charge", d3.forceManyBody().strength((node) => node.type === "topic" ? -240 : -560))
    .force("collision", d3.forceCollide().radius((node) => getNodeRadius(node) + (node.type === "topic" ? 46 : 30)).strength(0.98))
    .force("x", d3.forceX((node) => {
      if (node.type === "topic") return node.x || width / 2;
      return conceptTargetMap.get(node.id)?.x || width / 2;
    }).strength((node) => node.type === "topic" ? 0.24 : 0.16))
    .force("y", d3.forceY((node) => {
      if (node.type === "topic") return node.y || height / 2;
      return conceptTargetMap.get(node.id)?.y || height / 2;
    }).strength((node) => node.type === "topic" ? 0.24 : 0.16))
    .on("tick", updateStaticGraphPositions);

  state.simulationStopTimer = window.setTimeout(() => {
    stopActiveSimulation(false);
    freezeCurrentUniversePositions();
    updateStaticGraphPositions();
  }, GRAPH_ENTRY_CONCEPT_SIM_STOP_MS);
}

function freezeCurrentUniversePositions() {
  (state.currentNodes || []).forEach((node) => {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
    if (node.type === "topic" || node.type === "concept") {
      node.fx = node.x;
      node.fy = node.y;
      state.manualMainPositions.set(node.id, { x: node.x, y: node.y });
    }
  });
}

function getGraphCenter(width, height) {
  return { x: width / 2, y: height / 2 };
}

function buildSpreadTargetMap(nodes, width, height, options = {}) {
  const marginX = clamp(width * (options.marginRatioX || 0.14), 54, 150);
  const marginY = clamp(height * (options.marginRatioY || 0.14), 54, 150);
  const usableWidth = Math.max(220, width - marginX * 2);
  const usableHeight = Math.max(220, height - marginY * 2);
  const sorted = [...nodes].sort((a, b) => seededUnitFromText(a.id, options.salt || 0) - seededUnitFromText(b.id, options.salt || 0));
  const columns = Math.max(1, Math.ceil(Math.sqrt(sorted.length * (usableWidth / Math.max(1, usableHeight)))));
  const rows = Math.max(1, Math.ceil(sorted.length / columns));
  const cellWidth = usableWidth / columns;
  const cellHeight = usableHeight / rows;
  const map = new Map();

  sorted.forEach((node, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const jitterX = (seededUnitFromText(node.id, (options.salt || 0) + 1) - 0.5) * cellWidth * 0.62;
    const jitterY = (seededUnitFromText(node.id, (options.salt || 0) + 2) - 0.5) * cellHeight * 0.62;
    map.set(node.id, {
      x: clamp(marginX + cellWidth * (col + 0.5) + jitterX, marginX, width - marginX),
      y: clamp(marginY + cellHeight * (row + 0.5) + jitterY, marginY, height - marginY),
    });
  });

  return map;
}

function buildConceptTargetMap(concepts, topicByConcept, topicMap, width, height) {
  const map = new Map();
  const groupMap = new Map();

  concepts.forEach((concept) => {
    const topicId = topicByConcept.get(concept.id) || "__ungrouped__";
    if (!groupMap.has(topicId)) groupMap.set(topicId, []);
    groupMap.get(topicId).push(concept);
  });

  groupMap.forEach((group, topicId) => {
    const topic = topicMap.get(topicId);
    const baseX = topic?.x || width / 2;
    const baseY = topic?.y || height / 2;
    const sorted = [...group].sort((a, b) => seededUnitFromText(a.id, 271) - seededUnitFromText(b.id, 271));
    const baseRadius = isMobileLayout() ? 96 : 132;
    const ringGap = isMobileLayout() ? 42 : 58;

    sorted.forEach((concept, index) => {
      const ring = Math.floor(index / 10);
      const ringIndex = index % 10;
      const ringCount = Math.min(10, sorted.length - ring * 10);
      const angle = (Math.PI * 2 * ringIndex) / Math.max(1, ringCount) + seededUnitFromText(concept.id, 272) * 0.42;
      const radius = baseRadius + ring * ringGap + seededUnitFromText(concept.id, 273) * 22;
      map.set(concept.id, {
        x: clamp(baseX + Math.cos(angle) * radius, 34, width - 34),
        y: clamp(baseY + Math.sin(angle) * radius, 40, height - 40),
      });
    });
  });

  return map;
}

// Compatibility wrapper for older calls.
function startMainViewBurstSimulation() {
  startUniverseEntryAnimation();
}

function buildTopicByConceptMap(concepts, topics, edges) {
  const topicByConcept = new Map();

  concepts.forEach((concept) => {
    const topic = findTopicForConcept(concept, topics, edges);
    if (topic) topicByConcept.set(concept.id, topic.id);
  });

  return topicByConcept;
}

function stopActiveSimulation(clearTimer = true) {
  if (clearTimer && state.simulationStopTimer) {
    window.clearTimeout(state.simulationStopTimer);
    state.simulationStopTimer = null;
  }

  if (state.simulation) {
    state.simulation.stop();
    state.simulation = null;
  }

  state.forceStarted = false;
}


function applyPresetMainLayout(nodes, edges, width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  const topicNodes = nodes.filter((node) => node.type === "topic");
  const conceptNodes = nodes.filter((node) => node.type === "concept");

  // Wider scatter: use more whiteboard area so Topic nodes open up earlier.
  const marginX = clamp(width * (isMobileLayout() ? 0.08 : 0.08), 34, 112);
  const marginY = clamp(height * (isMobileLayout() ? 0.10 : 0.09), 42, 118);
  const usableWidth = Math.max(260, width - marginX * 2);
  const usableHeight = Math.max(260, height - marginY * 2);
  const conceptOrbit = Math.max(78, Math.min(width, height) * (isMobileLayout() ? 0.15 : 0.16));

  const topicPositionMap = new Map();
  const sortedTopics = [...topicNodes].sort((a, b) => seededUnitFromText(a.id, 1) - seededUnitFromText(b.id, 1));
  const columns = Math.max(1, Math.ceil(Math.sqrt(sortedTopics.length * (usableWidth / Math.max(1, usableHeight)))));
  const rows = Math.max(1, Math.ceil(sortedTopics.length / columns));
  const cellWidth = usableWidth / columns;
  const cellHeight = usableHeight / rows;

  sortedTopics.forEach((node, index) => {
    const saved = state.manualMainPositions.get(node.id);
    const col = index % columns;
    const row = Math.floor(index / columns);
    const jitterX = (seededUnitFromText(node.id, 2) - 0.5) * cellWidth * 0.58;
    const jitterY = (seededUnitFromText(node.id, 3) - 0.5) * cellHeight * 0.58;
    const x = marginX + cellWidth * (col + 0.5) + jitterX;
    const y = marginY + cellHeight * (row + 0.5) + jitterY;

    node.x = saved ? saved.x : clamp(x, marginX, width - marginX);
    node.y = saved ? saved.y : clamp(y, marginY, height - marginY);
    node.fx = node.x;
    node.fy = node.y;

    const angleFromCenter = Math.atan2(node.y - centerY, node.x - centerX);
    topicPositionMap.set(node.id, { x: node.x, y: node.y, angle: angleFromCenter, node });
  });

  const conceptGroups = new Map();
  conceptNodes.forEach((node) => {
    const topic = findTopicForConcept(node, topicNodes, edges);
    const key = topic ? topic.id : "__ungrouped__";
    if (!conceptGroups.has(key)) conceptGroups.set(key, []);
    conceptGroups.get(key).push(node);
  });

  conceptGroups.forEach((groupNodes, topicId) => {
    const topicPosition = topicPositionMap.get(topicId);
    const baseX = topicPosition ? topicPosition.x : centerX;
    const baseY = topicPosition ? topicPosition.y : centerY;
    const outwardAngle = topicPosition ? topicPosition.angle : MAIN_LAYOUT_RING_START_ANGLE;
    const sortedGroup = [...groupNodes].sort((a, b) => seededUnitFromText(a.id, 4) - seededUnitFromText(b.id, 4));

    sortedGroup.forEach((node, index) => {
      const saved = state.manualMainPositions.get(node.id);
      const ringLevel = Math.floor(index / 4);
      const angle = outwardAngle + Math.PI + index * GOLDEN_ANGLE + (seededUnitFromText(node.id, 5) - 0.5) * 0.48;
      const ring = conceptOrbit + ringLevel * 56 + seededUnitFromText(node.id, 6) * 26;
      const x = baseX + Math.cos(angle) * ring;
      const y = baseY + Math.sin(angle) * ring;

      node.x = saved ? saved.x : clamp(x, marginX * 0.65, width - marginX * 0.65);
      node.y = saved ? saved.y : clamp(y, marginY * 0.75, height - marginY * 0.75);
      node.fx = node.x;
      node.fy = node.y;
    });
  });
}

function seededUnitFromText(value, salt = 0) {
  const text = `${String(value || "")}:${salt}`;
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 100000) / 100000;
}

function findTopicForConcept(conceptNode, topicNodes, edges) {
  if (!conceptNode || !topicNodes.length) return null;

  const rawCategory = String(conceptNode.level1_category || conceptNode.topic || conceptNode.primary_topic || "").trim();
  const category = cleanTopicLabel(rawCategory);

  if (category) {
    const matchedByCategory = topicNodes.find((topic) => {
      const values = [topic.id, topic.label, topic.canonical_term, topic.level1_category].map((item) => cleanTopicLabel(item || ""));
      return values.some((value) => value && (value === category || value.includes(category) || category.includes(value)));
    });
    if (matchedByCategory) return matchedByCategory;
  }

  const directTopicId = edges
    .map((edge) => {
      const sourceId = getEdgeSourceId(edge);
      const targetId = getEdgeTargetId(edge);
      if (sourceId === conceptNode.id) return targetId;
      if (targetId === conceptNode.id) return sourceId;
      return null;
    })
    .find((nodeId) => topicNodes.some((topic) => topic.id === nodeId));

  if (directTopicId) return topicNodes.find((topic) => topic.id === directTopicId) || null;
  return null;
}

function getEdgeNode(value, nodeMap) {
  if (value && typeof value === "object") return value;
  return nodeMap.get(value) || { x: 0, y: 0 };
}

/* ================================
   Graph Style Helpers
================================ */


function renderNodeLabel(textSelection, node) {
  textSelection.selectAll("*").remove();

  const label = shortenLabel(getNodeDisplayLabel(node), node.type);

  textSelection
    .append("tspan")
    .attr("class", "label-name")
    .text(label);
}

function formatCount(count) {
  const value = Number(count || 0);

  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}萬`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return String(value);
}

function getNodeRadius(node) {
  const isMobile = isMobileLayout();
  if (node.type === "topic") return isMobile ? 36 : 42;
  if (node.type === "concept") return isMobile ? 25 : 29;
  if (node.type === "term") return isMobile ? 13 : 15;
  return isMobile ? 12 : 13;
}

function getLabelSize(node) {
  if (node.type === "topic") return isMobileLayout() ? 15 : 16;
  if (node.type === "concept") return isMobileLayout() ? 13 : 14;
  if (node.type === "term") return isMobileLayout() ? 10 : 11;
  return 12;
}

function getCharge(node) {
  if (node.type === "topic") return -180;
  if (node.type === "concept") return -70;
  if (node.type === "term") return -28;
  return -40;
}

function getLinkDistance(edge) {
  const sourceNode = getNodeById(getEdgeSourceId(edge));
  const targetNode = getNodeById(getEdgeTargetId(edge));
  const types = new Set([sourceNode?.type, targetNode?.type]);
  if (types.has("topic") && types.has("concept")) return 120;
  if (types.has("term")) return 54;
  if (sourceNode?.type === "concept" && targetNode?.type === "concept") return 90;
  return 96;
}

function getNodeDisplayLabel(node) {
  const raw = node && (node.label || node.canonical_term || node.id);
  const text = String(raw || "").trim();
  if (!text) return "";

  // UI display only: remove leading ordering tokens such as 01_, 02. or 03、.
  // Keep the original node id/category for data matching.
  return cleanTopicLabel(text);
}

function shortenLabel(label, type) {
  if (!label) return "";

  const maxLen = type === "phrase" ? 9 : 8;

  if (label.length <= maxLen) return label;

  return label.slice(0, maxLen) + "…";
}

/* ================================
   Selection / Highlight
================================ */

/* =========================================================
[不要改壞] 12. Node interaction
- Concept click 必須保留自動展開 Terms。
========================================================= */
function handleNodeClick(node) {
  if (!node) return;
  state.activeTag = null;

  if (node.type === "concept") {
    if (state.currentFocus.type === "universe" && !state.previousMainTransform && state.svg) {
      state.previousMainTransform = d3.zoomTransform(state.svg.node());
    }
    state.viewMode = "concept_terms"; // backward compatible only: this is card call-out, not a layer.
    state.currentFocus = { type: "node", value: node.id };
    state.activeConceptId = node.id;
    state.activeTermId = null;
    state.selectedNodeId = node.id;
    expandTermsAroundConcept(node.id);
    updateGraph();
    selectNode(node.id);
    requestAnimationFrame(() => focusNode(node.id));
    updateBackToMainButton();
    return;
  }

  if (node.type === "term") {
    const parentConceptId = findParentConceptIdForTerm(node.id) || state.activeConceptId;
    state.viewMode = parentConceptId ? "term_context" : "main";
    state.currentFocus = parentConceptId ? { type: "node", value: parentConceptId } : { type: "universe", value: null };
    state.activeConceptId = parentConceptId;
    state.activeTermId = node.id;
    state.selectedNodeId = node.id;
    if (parentConceptId) expandTermsAroundConcept(parentConceptId);
    state.expandedTermNodeIds.add(node.id);
    updateGraph();
    selectNode(node.id);
    requestAnimationFrame(() => focusNode(node.id));
    updateBackToMainButton();
    return;
  }

  state.currentFocus = { type: "node", value: node.id };
  selectNode(node.id);
  requestAnimationFrame(() => focusNode(node.id));
}

function returnToMainView() {
  state.viewMode = "main";
  state.currentFocus = { type: "universe", value: null };
  state.activeConceptId = null;
  state.activeTermId = null;
  state.activeTag = null;
  state.selectedNodeId = null;
  state.seedFocusNodeIds = new Set();
  clearExpandedTerms();

  updateGraph();
  renderDefaultInfo();
  updateBackToMainButton();

  state.previousMainTransform = null;
  requestAnimationFrame(() => fitVisibleNodes());
}

function updateBackToMainButton() {
  const button = document.getElementById("backToMainBtn");
  if (!button) return;

  const isMain = state.currentFocus.type === "universe" && !state.activeConceptId && !state.activeTermId && state.expandedTermNodeIds.size === 0;
  button.classList.toggle("hidden", isMain);
  button.disabled = isMain;
  button.setAttribute("aria-hidden", isMain ? "true" : "false");
}

function selectNode(nodeId) {
  state.selectedNodeId = nodeId;
  highlightSelection();

  const node = state.allNodes.find((item) => item.id === nodeId);
  if (node) {
    renderInfoPanel(node);

    if (isMobileLayout()) {
      // Mobile：點節點後開啟 Bottom Sheet。
      openMobileBottomSheet(60);
    } else {
      // Desktop/Web：剛進頁面 Info Panel 預設收合；選取節點後自動展開。
      state.infoCompact = false;
      applyInfoCompactState();
    }
  }
}

function focusNode(nodeId) {
  selectNode(nodeId);

  const visibleIds = getVisibleDirectNeighborIds(nodeId);
  visibleIds.add(nodeId);

  if (visibleIds.size <= 1) {
    focusSingleNode(nodeId);
    return;
  }

  focusNodeGroup(Array.from(visibleIds));
}

function getVisibleDirectNeighborIds(nodeId) {
  const visibleIds = new Set((state.currentNodes || []).map((node) => node.id));
  const neighbors = new Set();

  (state.currentEdges || []).forEach((edge) => {
    const sourceId = getEdgeSourceId(edge);
    const targetId = getEdgeTargetId(edge);
    if (sourceId === nodeId && visibleIds.has(targetId)) neighbors.add(targetId);
    if (targetId === nodeId && visibleIds.has(sourceId)) neighbors.add(sourceId);
  });

  return neighbors;
}

function focusSingleNode(nodeId) {
  const visibleNode = state.nodeSelection
    .selectAll("g")
    .data()
    .find((item) => item.id === nodeId);

  if (!visibleNode || visibleNode.x === undefined || visibleNode.y === undefined) return;

  const graphCard = document.querySelector(".graph-card");
  const width = graphCard.clientWidth;
  const height = graphCard.clientHeight;
  const yOffset = isMobileLayout() && state.mobileSheetOpen ? -height * 0.12 : 0;
  const scale = isMobileLayout() ? 1.25 : 1.45;

  const transform = d3.zoomIdentity
    .translate(width / 2, height / 2 + yOffset)
    .scale(scale)
    .translate(-visibleNode.x, -visibleNode.y);

  state.svg.transition().duration(650).call(state.zoomBehavior.transform, transform);
}

function focusNodeGroup(nodeIds) {
  const visibleNodes = state.nodeSelection
    .selectAll("g")
    .data()
    .filter((node) => nodeIds.includes(node.id) && Number.isFinite(node.x) && Number.isFinite(node.y));

  if (visibleNodes.length === 0) return;
  if (visibleNodes.length === 1) {
    focusSingleNode(visibleNodes[0].id);
    return;
  }

  const graphCard = document.querySelector(".graph-card");
  const width = graphCard.clientWidth;
  const height = graphCard.clientHeight;
  const padding = isMobileLayout() ? 88 : 140;
  const yOffset = isMobileLayout() && state.mobileSheetOpen ? -height * 0.10 : 0;

  const xValues = visibleNodes.map((node) => node.x);
  const yValues = visibleNodes.map((node) => node.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const boxWidth = Math.max(1, maxX - minX);
  const boxHeight = Math.max(1, maxY - minY);
  const scale = clamp(
    Math.min((width - padding) / boxWidth, (height - padding) / boxHeight),
    isMobileLayout() ? 0.42 : 0.36,
    isMobileLayout() ? 1.65 : 2.2
  );

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const transform = d3.zoomIdentity
    .translate(width / 2, height / 2 + yOffset)
    .scale(scale)
    .translate(-centerX, -centerY);

  state.svg.transition().duration(680).call(state.zoomBehavior.transform, transform);
}

function fitVisibleNodes() {
  const nodeIds = (state.currentNodes || []).map((node) => node.id);
  if (nodeIds.length === 0) return;
  focusNodeGroup(nodeIds);
}

function centerSelectedNode() {
  if (!state.selectedNodeId) return;
  focusSingleNode(state.selectedNodeId);
}


function getConnectedNodeIds(selectedId) {
  const connected = new Set([selectedId]);

  state.allEdges.forEach((edge) => {
    const sourceId = typeof edge.source === "object" ? edge.source.id : edge.source;
    const targetId = typeof edge.target === "object" ? edge.target.id : edge.target;

    if (sourceId === selectedId) connected.add(targetId);
    if (targetId === selectedId) connected.add(sourceId);
  });

  return connected;
}

function highlightSelection() {
  applyGraphFocusClasses();
}

function applyGraphFocusClasses() {
  const selectedId = state.selectedNodeId;
  const activeConceptId = state.activeConceptId;
  const activeTag = state.activeTag;
  const seedIds = state.seedFocusNodeIds || new Set();
  const connectedIds = selectedId ? getConnectedNodeIds(selectedId) : new Set();

  if (activeConceptId) {
    connectedIds.add(activeConceptId);
    state.expandedTermNodeIds.forEach((id) => connectedIds.add(id));
  }

  state.nodeSelection
    .selectAll("g")
    .classed("selected", (node) => node.id === selectedId)
    .classed("node-focus-active", (node) => node.id === selectedId || node.id === activeConceptId)
    .classed("node-focus-related", (node) => connectedIds.has(node.id) || seedIds.has(node.id))
    .classed("hashtag-active", (node) => activeTag ? nodeMatchesTag(node, activeTag) : false)
    .classed("node-focus-dimmed", (node) => {
      if (activeTag) return !nodeMatchesTag(node, activeTag);
      if (seedIds.size > 0) return !seedIds.has(node.id);
      if (selectedId || activeConceptId) return !connectedIds.has(node.id) && node.id !== selectedId && node.id !== activeConceptId;
      return false;
    })
    .classed("dimmed", (node) => {
      if (activeTag) return !nodeMatchesTag(node, activeTag);
      if (seedIds.size > 0) return !seedIds.has(node.id);
      if (selectedId || activeConceptId) return !connectedIds.has(node.id) && node.id !== selectedId && node.id !== activeConceptId;
      return false;
    })
    .classed("related", (node) => connectedIds.has(node.id) || seedIds.has(node.id));

  state.linkSelection
    .selectAll("line")
    .classed("link-focus-related", (edge) => {
      const sourceId = getEdgeSourceId(edge);
      const targetId = getEdgeTargetId(edge);
      return sourceId === selectedId || targetId === selectedId ||
        sourceId === activeConceptId || targetId === activeConceptId ||
        seedIds.has(sourceId) || seedIds.has(targetId);
    })
    .classed("highlight", (edge) => {
      const sourceId = getEdgeSourceId(edge);
      const targetId = getEdgeTargetId(edge);
      return sourceId === selectedId || targetId === selectedId || sourceId === activeConceptId || targetId === activeConceptId;
    })
    .classed("link-dimmed", (edge) => {
      const sourceId = getEdgeSourceId(edge);
      const targetId = getEdgeTargetId(edge);
      if (activeTag) return !nodeMatchesTag(getNodeById(sourceId) || {}, activeTag) && !nodeMatchesTag(getNodeById(targetId) || {}, activeTag);
      if (seedIds.size > 0) return !seedIds.has(sourceId) && !seedIds.has(targetId);
      if (selectedId || activeConceptId) return sourceId !== selectedId && targetId !== selectedId && sourceId !== activeConceptId && targetId !== activeConceptId;
      return false;
    })
    .classed("dimmed", (edge) => {
      const sourceId = getEdgeSourceId(edge);
      const targetId = getEdgeTargetId(edge);
      if (activeTag) return !nodeMatchesTag(getNodeById(sourceId) || {}, activeTag) && !nodeMatchesTag(getNodeById(targetId) || {}, activeTag);
      if (seedIds.size > 0) return !seedIds.has(sourceId) && !seedIds.has(targetId);
      if (selectedId || activeConceptId) return sourceId !== selectedId && targetId !== selectedId && sourceId !== activeConceptId && targetId !== activeConceptId;
      return false;
    });
}

/* ================================
   Info Panel
================================ */

/* =========================================================
[可改] 13. Info Panel render
- Sentences / Sources 只放 Info Panel，不進主圖。
========================================================= */
function renderDefaultInfo() {
  setInfoTitle("尚未選擇節點");
  document.getElementById("infoTags").innerHTML = "<span>請點選圖上的節點</span>";
  document.getElementById("relatedTerms").innerHTML = '<span class="muted">尚無資料</span>';
  document.getElementById("relatedPhrases").innerHTML = '<span class="muted">尚無資料</span>';
  document.getElementById("sourceList").innerHTML = '<span class="muted">尚無資料</span>';
}

function renderInfoPanel(node) {
  const card = getCardForNode(node);
  setInfoTitle(card.display_name || card.title || node.label || node.id);

  const tags = collectDisplayTags(node, card);
  renderInfoTags(tags);

  renderRelatedTerms(node, card);
  renderRelatedPhrases(node, card);
  renderSources(node, card);
}

function getCardForNode(node) {
  if (!node) return {};
  return state.graphCards[node.id] || state.graphCards[node.card_id] || {};
}

function collectDisplayTags(node, card = {}) {
  const rawTags = [
    node.theme,
    card.theme,
    node.level1_category,
    card.topic,
    node.playlist_type_tag,
    card.playlist_type_tag,
    ...(Array.isArray(node.tags) ? node.tags : splitList(node.tags)),
    ...(Array.isArray(card.tags) ? card.tags : splitList(card.tags)),
  ];

  return Array.from(new Set(rawTags.map(cleanTagText).filter(Boolean))).slice(0, 18);
}

function renderInfoTags(tags) {
  const box = document.getElementById("infoTags");
  if (!box) return;

  if (!tags || tags.length === 0) {
    box.innerHTML = "<span>請點選圖上的節點</span>";
    return;
  }

  box.innerHTML = tags
    .map((tag) => {
      const label = tag.startsWith("#") ? tag : tag;
      return `<button type="button" class="hashtag-chip" data-tag="${escapeAttribute(tag)}">${escapeHtml(label)}</button>`;
    })
    .join("");
}

function renderRelatedTerms(node, card = {}) {
  const box = document.getElementById("relatedTerms");

  if (!box) return;

  const relatedNodes = getNeighborNodes(node.id)
    .filter((item) => item.type === "term")
    .slice(0, 30);

  const matchedTerms = splitList(node.matched_terms);
  const cardTerms = [
    ...splitList(card.related_terms),
    ...splitList(card.terms),
    ...splitList(card.aliases),
  ];

  const labels = Array.from(
    new Set([
      ...relatedNodes.map((item) => item.label),
      ...matchedTerms,
      ...cardTerms,
      node.canonical_term,
    ].filter(Boolean))
  ).slice(0, 36);

  if (labels.length === 0) {
    box.innerHTML = '<span class="muted">尚無資料</span>';
    return;
  }

  box.innerHTML = labels
    .map((label) => `<button type="button" class="related-term-chip" data-term="${escapeAttribute(label)}">${escapeHtml(label)}</button>`)
    .join("");
}

function renderRelatedPhrases(node, card = {}) {
  const box = document.getElementById("relatedPhrases");

  if (!box) return;

  const relatedPhrases = getNeighborNodes(node.id)
    .filter((item) => item.type === "phrase")
    .slice(0, 12);

  const phraseTexts = [];

  relatedPhrases.forEach((item) => {
    phraseTexts.push(item.label);
  });

  if (node.text_preview) {
    splitList(node.text_preview).forEach((item) => phraseTexts.push(item));
  }

  splitList(card.sentences || card.related_sentences || card.examples).forEach((item) => phraseTexts.push(item));

  const sources = getSourcesForNodeWithFallback(node, card);

  sources.slice(0, 4).forEach((source) => {
    if (source.text) {
      phraseTexts.push(source.text);
    }
  });

  const uniqueTexts = Array.from(new Set(phraseTexts)).slice(0, 10);

  if (uniqueTexts.length === 0) {
    box.innerHTML = '<span class="muted">尚無資料</span>';
    return;
  }

  box.innerHTML = uniqueTexts
    .map((text) => `<div class="quote-item">「${escapeHtml(text)}」</div>`)
    .join("");
}

function renderSources(node, card = {}) {
  const box = document.getElementById("sourceList");

  if (!box) return;

  const sources = getSourcesForNodeWithFallback(node, card);

  if (sources.length === 0) {
    box.innerHTML = '<span class="muted">尚無資料</span>';
    return;
  }

  box.innerHTML = sources
    .slice(0, 18)
    .map((source) => {
      const title = source.source_label || source.title || source.file || "未命名來源";
      const time = source.timestamp || "";
      const url = source.timestamp_url || source.base_url || "";
      const text = source.text || "";

      const linkHtml = url
        ? `<a class="source-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">
             ▶ ${escapeHtml(time || "開啟來源")}
           </a>`
        : `<span class="source-link disabled">▶ ${escapeHtml(time || "無連結")}</span>`;

      return `
        <div class="source-item">
          <div class="source-title">${escapeHtml(title)}</div>
          <div>${linkHtml}</div>
          <div class="source-text">${escapeHtml(shortenText(text, 100))}</div>
        </div>
      `;
    })
    .join("");
}

function getSourcesForNodeWithFallback(node, card = {}) {
  const cardSources = Array.isArray(card.sources) ? card.sources : [];
  const directSources = [...(state.graphSources[node.id] || []), ...cardSources];

  if (directSources.length > 0) {
    return directSources;
  }

  const neighborNodes = getNeighborNodes(node.id);
  const collected = [];

  neighborNodes.forEach((neighbor) => {
    const sources = state.graphSources[neighbor.id] || [];
    sources.forEach((source) => collected.push(source));
  });

  const seen = new Set();
  const unique = [];

  collected.forEach((source) => {
    const key = [
      source.title || "",
      source.timestamp || "",
      source.text || "",
    ].join("__");

    if (seen.has(key)) return;

    seen.add(key);
    unique.push(source);
  });

  return unique;
}

function getNeighborNodes(nodeId) {
  const neighborIds = new Set();

  state.allEdges.forEach((edge) => {
    const sourceId = typeof edge.source === "object" ? edge.source.id : edge.source;
    const targetId = typeof edge.target === "object" ? edge.target.id : edge.target;

    if (sourceId === nodeId) neighborIds.add(targetId);
    if (targetId === nodeId) neighborIds.add(sourceId);
  });

  return state.allNodes.filter((node) => neighborIds.has(node.id));
}


/* ================================
   Related terms / tags interaction
================================ */

/* =========================================================
[保留] 14. Related terms / tags interaction
- Related term 與 hashtag 都要能連動 zoom / focus。
========================================================= */
function setupRelatedInteractions() {
  const relatedTerms = document.getElementById("relatedTerms");
  if (!relatedTerms) return;

  relatedTerms.addEventListener("click", (event) => {
    const button = event.target.closest(".related-term-chip");
    if (!button) return;
    focusByRelatedTerm(button.dataset.term || button.textContent || "");
  });
}

function setupTagInteractions() {
  const infoTags = document.getElementById("infoTags");
  if (!infoTags) return;

  infoTags.addEventListener("click", (event) => {
    const button = event.target.closest(".hashtag-chip");
    if (!button) return;
    focusByHashtag(button.dataset.tag || button.textContent || "");
  });
}

function focusByRelatedTerm(termText) {
  const keyword = normalizeSearchKeyword(termText);
  if (!keyword) return;

  const matchedNode = state.allNodes.find((node) => {
    if (node.type !== "term" && node.type !== "concept" && node.type !== "topic") return false;
    return buildSearchHaystack(node).includes(keyword);
  });

  if (matchedNode) {
    if (matchedNode.type === "term") {
      const parentConceptId = findParentConceptIdForTerm(matchedNode.id);
      state.viewMode = parentConceptId ? "term_context" : "main";
      state.activeConceptId = parentConceptId;
      state.activeTermId = matchedNode.id;
    } else if (matchedNode.type === "concept") {
      state.viewMode = "concept_terms";
      state.activeConceptId = matchedNode.id;
      state.activeTermId = null;
    } else {
      state.viewMode = "main";
      state.activeConceptId = null;
      state.activeTermId = null;
    }

    state.selectedNodeId = matchedNode.id;
    updateGraph();
    window.setTimeout(() => {
      selectNode(matchedNode.id);
      focusNode(matchedNode.id);
      updateBackToMainButton();
    }, 160);
    return;
  }

  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = termText;
  searchNode();
}

function focusByHashtag(tagText) {
  const tag = cleanTagText(tagText);
  if (!tag) return;

  // Tag click is a visual navigation action only:
  // - It does not change viewMode.
  // - It does not inject a large number of hidden Terms into the main graph.
  // - It only highlights currently visible Concept / Term nodes and zooms to that visible group.
  const visibleNodes = state.currentNodes || [];
  const matchedNodes = visibleNodes.filter((node) => {
    if (node.type !== "concept" && node.type !== "term") return false;
    return nodeMatchesTag(node, tag);
  });

  if (matchedNodes.length === 0) {
    state.activeTag = null;
    highlightSelection();
    return;
  }

  state.activeTag = tag;
  state.currentFocus = { type: "tag", value: tag };
  const matchedIds = new Set(matchedNodes.map((node) => node.id));

  state.nodeSelection
    .selectAll("g")
    .classed("hashtag-active", (node) => matchedIds.has(node.id))
    .classed("dimmed", (node) => node.type === "concept" || node.type === "term" ? !matchedIds.has(node.id) : false);

  state.linkSelection
    .selectAll("line")
    .classed("dimmed", (edge) => {
      const sourceId = getEdgeSourceId(edge);
      const targetId = getEdgeTargetId(edge);
      return !matchedIds.has(sourceId) && !matchedIds.has(targetId);
    });

  focusNodeGroup(Array.from(matchedIds));
}

function nodeMatchesTag(node, tag) {
  const card = getCardForNode(node);
  const values = [
    node.theme,
    card.theme,
    node.level1_category,
    node.level2_concept,
    node.playlist_type_tag,
    card.playlist_type_tag,
    node.label,
    node.canonical_term,
    ...(Array.isArray(node.tags) ? node.tags : splitList(node.tags)),
    ...(Array.isArray(card.tags) ? card.tags : splitList(card.tags)),
  ];

  const normalizedTag = tag.replace(/^#/, "");
  return values
    .map(cleanTagText)
    .filter(Boolean)
    .some((value) => value === tag || value.replace(/^#/, "") === normalizedTag || value.includes(normalizedTag));
}

/* ================================
   Search / Zoom
================================ */

/* =========================================================
[保留] 7. Search
- 搜尋既有節點 / 卡片，不與 Seed 共用。
========================================================= */

function resolveGraphNodeForSearchMatch(node) {
  if (!node) return null;
  if (["topic", "concept", "term"].includes(node.type)) return node;

  // Sentence / phrase 不進主網絡：搜尋命中時，改聚焦其相鄰 Concept / Term。
  const neighbor = getNeighborNodes(node.id).find((item) => item.type === "concept" || item.type === "term");
  return neighbor || null;
}

function searchNode() {
  const input = document.getElementById("searchInput");
  const keyword = normalizeSearchKeyword(input ? input.value : "");

  if (!keyword) return;
  addHistoryItem("search", keyword);

  const matchedNodes = state.allNodes.filter((node) => buildSearchHaystack(node).includes(keyword));

  if (matchedNodes.length === 0) {
    appendSearchFeedback(0);
    return;
  }

  const matchedNode = matchedNodes[0];
  const graphTargetNode = resolveGraphNodeForSearchMatch(matchedNode) || matchedNode;
  state.activeTag = null;
  setVisibleTypes(["topic", "concept", "term"]);

  if (graphTargetNode.type === "term") {
    const parentConceptId = findParentConceptIdForTerm(graphTargetNode.id);
    if (parentConceptId) {
      state.viewMode = "term_context";
      state.currentFocus = { type: "node", value: parentConceptId };
      state.activeConceptId = parentConceptId;
      state.activeTermId = graphTargetNode.id;
      state.selectedNodeId = graphTargetNode.id;
      expandTermsAroundConcept(parentConceptId);
      state.expandedTermNodeIds.add(graphTargetNode.id);
    }
  } else if (graphTargetNode.type === "concept") {
    state.viewMode = "concept_terms";
    state.currentFocus = { type: "node", value: graphTargetNode.id };
    state.activeConceptId = graphTargetNode.id;
    state.activeTermId = null;
    state.selectedNodeId = graphTargetNode.id;
    expandTermsAroundConcept(graphTargetNode.id);
  } else {
    state.viewMode = "main";
    state.currentFocus = { type: "universe", value: null };
    state.activeConceptId = null;
    state.activeTermId = null;
    clearExpandedTerms();
    state.selectedNodeId = graphTargetNode.id;
  }

  updateGraph();

  // JS-6C：手機搜尋後自動收合 Sidebar，桌機維持原狀。
  if (isMobileLayout()) {
    const appShell = document.querySelector(".app-shell");
    const panel = document.getElementById("sidebarSearchPanel");
    if (appShell) appShell.classList.add("sidebar-collapsed");
    if (panel) panel.classList.add("search-collapsed");
    localStorage.setItem("searchPanelOpen", "0");
    updateFloatingLayoutVars();
    updateMobileToolbarPosition();
  }

  setTimeout(() => {
    selectNode(state.selectedNodeId || graphTargetNode.id);
    focusNode(state.selectedNodeId || graphTargetNode.id);
    appendSearchFeedback(matchedNodes.length);
    updateBackToMainButton();
  }, 280);
}

function appendSearchFeedback(count) {
  // JS-10C：搜尋後先聚焦第一個結果，並在資訊欄標籤顯示找到幾個。
  const tags = document.getElementById("infoTags");
  if (!tags) return;

  const old = tags.querySelector(".search-result-pill");
  if (old) old.remove();

  const pill = document.createElement("span");
  pill.className = "search-result-pill";
  pill.textContent = count > 0 ? `搜尋結果 ${count} 個` : "搜尋結果 0 個";
  tags.appendChild(pill);
}

function resetZoom() {
  if (!state.svg || !state.zoomBehavior) return;

  const visibleIds = (state.currentNodes || []).map((node) => node.id);
  if (visibleIds.length > 1) {
    focusNodeGroup(visibleIds);
    return;
  }

  state.svg
    .transition()
    .duration(550)
    .call(state.zoomBehavior.transform, d3.zoomIdentity);
}

/* ================================
   Text Helpers
================================ */

function typeLabel(type) {
  const map = {
    topic: "主題",
    concept: "概念",
    term: "詞彙",
    phrase: "句子",
    sentence: "句子",
  };

  return map[type] || type;
}


function splitList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);

  return String(value)
    .split(/\s*\|\|\s*|[、,，;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanTopicLabel(value) {
  return String(value || "")
    .trim()
    .replace(/^\d+[_\.．、\-\s]+/, "")
    .replace(/^0\d+[_\.．、\-\s]+/, "");
}

function cleanTagText(value) {
  const text = cleanTopicLabel(value)
    .replace(/^(主題|概念|詞彙|句子|terms?)[:：\s]+/i, "")
    .trim();
  if (!text || text === "none") return "";
  return text;
}

/* =========================================================
[可改] 9. Recent history
========================================================= */
function restoreRecentHistory() {
  state.searchHistory = readHistory(STORAGE_KEYS.searchHistory);
  state.seedHistory = readHistory(STORAGE_KEYS.seedHistory);
}

function readHistory(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

function addHistoryItem(type, value) {
  const text = String(value || "").trim();
  if (!text) return;

  const key = type === "seed" ? STORAGE_KEYS.seedHistory : STORAGE_KEYS.searchHistory;
  const next = [text, ...readHistory(key).filter((item) => item !== text)].slice(0, MAX_HISTORY_ITEMS);
  localStorage.setItem(key, JSON.stringify(next));

  if (type === "seed") state.seedHistory = next;
  else state.searchHistory = next;
}


function shortenText(text, maxLen) {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "…";
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(text) {
  return escapeHtml(text).replaceAll("`", "&#096;");
}

function updateStaticGraphPositions() {
  const currentNodeMap = new Map((state.currentNodes || []).map((node) => [node.id, node]));

  if (state.nodeSelection) {
    state.nodeSelection
      .selectAll("g")
      .attr("transform", (node) => `translate(${node.x || 0},${node.y || 0})`);
  }

  if (state.linkSelection) {
    state.linkSelection
      .selectAll("line")
      .attr("x1", (edge) => {
        const node = currentNodeMap.get(getEdgeSourceId(edge));
        return node ? node.x || 0 : 0;
      })
      .attr("y1", (edge) => {
        const node = currentNodeMap.get(getEdgeSourceId(edge));
        return node ? node.y || 0 : 0;
      })
      .attr("x2", (edge) => {
        const node = currentNodeMap.get(getEdgeTargetId(edge));
        return node ? node.x || 0 : 0;
      })
      .attr("y2", (edge) => {
        const node = currentNodeMap.get(getEdgeTargetId(edge));
        return node ? node.y || 0 : 0;
      });
  }
}

/* ================================
   Drag Nodes
================================ */

function dragStarted(event, node) {
  node.fx = node.x;
  node.fy = node.y;

  if (state.simulation && !event.active) {
    state.simulation.alphaTarget(state.viewMode === "main" ? 0.16 : 0.3).restart();
  }

  if (state.viewMode === "main") {
    state.manualMainPositions.set(node.id, { x: node.x || 0, y: node.y || 0 });
  }
}

function dragged(event, node) {
  node.fx = event.x;
  node.fy = event.y;
  node.x = event.x;
  node.y = event.y;

  if (state.viewMode === "main") {
    state.manualMainPositions.set(node.id, { x: node.x, y: node.y });
    updateStaticGraphPositions();
  }
}

function dragEnded(event, node) {
  if (state.simulation && !event.active) state.simulation.alphaTarget(0);

  if (state.viewMode === "main") {
    // Keep the manually adjusted Topic/Core Concept position in the main board.
    node.fx = node.x;
    node.fy = node.y;
    state.manualMainPositions.set(node.id, { x: node.x || 0, y: node.y || 0 });
    updateStaticGraphPositions();
    return;
  }

  node.fx = null;
  node.fy = null;
}

/* ================================
   Resize Window
================================ */

window.addEventListener("resize", () => {
  updateFloatingLayoutVars();
  syncMobileOnlyResizeHandles();
  updateMobileToolbarPosition();

  if (isMobileLayout()) {
    if (state.mobileSheetOpen) {
      setMobileBottomSheetHeight(state.mobileSheetExpanded ? 90 : 60);
    } else {
      closeMobileBottomSheet(false);
    }
  } else {
    const infoPanel = document.getElementById("infoPanel");
    if (infoPanel) {
      infoPanel.style.transform = "";
      infoPanel.style.height = "";
    }
  }

  resizeGraphAfterPanelChange();
});
