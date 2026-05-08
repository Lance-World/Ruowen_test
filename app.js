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
  visibleTypes: new Set(["topic", "concept", "term", "phrase"]),
  selectedCategory: "all",
  selectedNodeId: null,
  simulation: null,
  svg: null,
  zoomLayer: null,
  linkSelection: null,
  nodeSelection: null,
  zoomBehavior: null,
  infoCompact: false,
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
  viewMode: "main",
  activeConceptId: null,
  activeTermId: null,
  previousMainTransform: null,
  currentNodes: [],
  currentEdges: [],
  // Main view uses a static preset layout at page load, but Topic/Core Concept nodes remain draggable.
  manualMainPositions: new Map(),
};

/* =========================================================
[保留] 3. constants
========================================================= */
const nodeColors = {
  topic: "#CFEAF4",      // 主題：霧感淡藍
  concept: "#D7EEE9",    // 概念：霧青綠，與背景融合
  term: "#DCD9EA",       // 詞彙：低飽和灰紫
  phrase: "#F6F1E8",     // 句子：奶霜米白
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

function restoreSeedPanelState() {
  const panel = document.getElementById("sidebarSeedPanel");
  if (!panel) return;

  const isOpen = localStorage.getItem("seedPanelOpen") === "1";
  panel.classList.toggle("seed-collapsed", !isOpen);
}

function setupSeedPanel() {
  restoreSeedPanelState();

  const input = document.getElementById("seedInput");
  const submitBtn = document.getElementById("seedSubmitBtn");
  const randomBtn = document.getElementById("seedRandomBtn");
  const resultBox = document.getElementById("seedResult");

  function runSeed(randomOnly = false) {
    const raw = input ? input.value.trim() : "";
    const idea = generateSeedIdea(randomOnly ? "" : raw);
    if (resultBox) resultBox.textContent = idea;
    if (raw && !randomOnly) addHistoryItem("seed", raw);
  }

  if (submitBtn) submitBtn.addEventListener("click", () => runSeed(false));
  if (randomBtn) randomBtn.addEventListener("click", () => runSeed(true));
  if (input) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") runSeed(false);
      if (event.key === "Escape") {
        const panel = document.getElementById("sidebarSeedPanel");
        if (panel) panel.classList.add("seed-collapsed");
        localStorage.setItem("seedPanelOpen", "0");
      }
    });
  }
}

function generateSeedIdea(userText = "") {
  const topicPool = state.allNodes
    .filter((node) => node.type === "topic" || node.type === "concept")
    .map((node) => cleanTopicLabel(node.label || node.canonical_term || node.id))
    .filter(Boolean);

  const termPool = state.allNodes
    .filter((node) => node.type === "term")
    .map((node) => node.label || node.canonical_term || node.id)
    .filter(Boolean);

  const pick = (items, fallback) => items.length ? items[Math.floor(Math.random() * items.length)] : fallback;
  const topic = pick(topicPool, "內在覺察");
  const term = pick(termPool, "安全感");
  const inputText = String(userText || "").trim();

  if (!inputText) {
    return `今天可以從「${topic}」靠近「${term}」，問自己：它正在提醒我什麼？`;
  }

  return `把「${inputText}」放進「${topic}」脈絡裡看：它和「${term}」之間，也許有一條新的理解路徑。`;
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
          ? new Set(["topic", "concept", "term", "phrase"])
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
      const allEnabled = ["topic", "concept", "term", "phrase"].every((item) =>
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
      chip.classList.toggle("active", types.length === 4);
      return;
    }

    chip.classList.toggle("active", state.visibleTypes.has(type));
  });

  updateGraph();
}

function showAll() {
  state.visibleTypes = new Set(["topic", "concept", "term", "phrase"]);
  state.selectedCategory = "all";
  state.selectedNodeId = null;
  state.viewMode = "main";
  state.activeConceptId = null;
  state.activeTermId = null;
  state.activeTag = null;

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
  highlightSelection();
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

  if (workspace) {
    workspace.classList.toggle("info-compact-workspace", Boolean(state.infoCompact));
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
  // J2 / K1：Sidebar 固定寬度，不啟用 Sidebar resize；保留其他資訊欄拖曳。
  setupMainVerticalResize();
  setupInnerHorizontalResize();
  setupInfoRightResize();
}

function setupMainVerticalResize() {
  const handle = document.getElementById("mainResizeHandle");
  const workspace = document.getElementById("workspace");

  if (!handle || !workspace) return;

  enablePointerResize(handle, {
    cursor: "row-resize",
    canStart: () => !isMobileLayout(),
    onMove: (event) => {
      const rect = workspace.getBoundingClientRect();
      const infoHeight = rect.bottom - event.clientY;

      const minInfo = isMobileLayout() ? 76 : 92;
      const maxInfo = Math.max(240, rect.height * 0.76);
      const nextHeight = clamp(infoHeight, minInfo, maxInfo);

      state.infoCompact = false;
      applyInfoCompactState();

      workspace.style.setProperty("--info-height", `${nextHeight}px`);
      if (!isMobileLayout()) {
        localStorage.setItem("infoHeight", String(nextHeight));
      } else {
        localStorage.removeItem("infoHeight");
      }

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
    if (Number.isFinite(savedInfoHeight) && savedInfoHeight >= 160 && savedInfoHeight <= window.innerHeight * 0.76) {
      workspace.style.setProperty("--info-height", `${savedInfoHeight}px`);
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
  const sidebarWidth = isCollapsed ? 64 : 280;
  const infoLeft = isCollapsed ? 96 : 340;

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

  if (!overlay || !textEl) {
    finishIntroGraphReveal();
    return;
  }

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

  // Page-load sequence:
  // 1. Intro overlay fades out first.
  // 2. Whiteboard fades in.
  // 3. Topic nodes run the first burst simulation.
  // 4. Core Concept nodes appear and run the second burst simulation.
  // 5. Interaction is enabled after the two-stage reveal starts.
  document.body.classList.remove("graph-intro-active");
  document.body.classList.add("graph-board-visible");

  requestAnimationFrame(() => {
    document.body.classList.add("graph-topic-visible");
    startMainViewBurstSimulation("topic");

    window.setTimeout(() => {
      document.body.classList.add("intro-concepts-visible");
      startMainViewBurstSimulation("concept");

      window.setTimeout(() => {
        document.body.classList.add("graph-interaction-enabled", "graph-intro-finished");
        fitVisibleNodes();
      }, 920);
    }, INITIAL_CONCEPT_DELAY_MS);
  });
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
  let data;

  if (state.viewMode === "concept_terms" && state.activeConceptId) {
    data = getConceptTermsData(state.activeConceptId);
  } else if (state.viewMode === "term_context" && state.activeConceptId && state.activeTermId) {
    data = getTermContextData(state.activeConceptId, state.activeTermId);
  } else {
    data = getMainViewData();
  }

  state.currentNodes = data.nodes;
  state.currentEdges = data.edges;
  return data;
}

function isCoreConceptNode(node) {
  const roleFields = [
    node.concept_role,
    node.role,
    node.card_role,
    node.node_role,
  ].filter(Boolean).map((item) => String(item).toLowerCase());

  if (roleFields.some((item) => item.includes("core") || item.includes("核心"))) return true;
  if (node.is_core === true || node.core === true) return true;
  return false;
}

function getMainViewData() {
  const allConcepts = state.allNodes.filter((node) => node.type === "concept");
  const hasCoreConcept = allConcepts.some(isCoreConceptNode);

  const nodes = state.allNodes.filter((node) => {
    if (node.type !== "topic" && node.type !== "concept") return false;
    if (!state.visibleTypes.has(node.type)) return false;
    if (state.selectedCategory !== "all" && node.level1_category !== state.selectedCategory) return false;

    // 首頁主圖：Topic + Core Concept。若舊資料還沒標 core，fallback 保留 concept，避免空圖。
    if (node.type === "concept" && hasCoreConcept && !isCoreConceptNode(node)) return false;
    return true;
  });

  const visibleIds = new Set(nodes.map((node) => node.id));
  const edges = state.allEdges.filter((edge) => {
    const sourceId = getEdgeSourceId(edge);
    const targetId = getEdgeTargetId(edge);
    if (!visibleIds.has(sourceId) || !visibleIds.has(targetId)) return false;

    const sourceNode = getNodeById(sourceId);
    const targetNode = getNodeById(targetId);
    if (!sourceNode || !targetNode) return false;

    const types = new Set([sourceNode.type, targetNode.type]);
    return (types.has("topic") && types.has("concept")) ||
      (sourceNode.type === "concept" && targetNode.type === "concept");
  });

  return { nodes, edges };
}

function getConceptTermsData(conceptId) {
  const main = getMainViewData();
  const termIds = getDirectTermIdsForConcept(conceptId);
  const visibleIds = new Set([...main.nodes.map((node) => node.id), conceptId, ...termIds]);

  const nodes = state.allNodes.filter((node) => visibleIds.has(node.id));
  const edges = state.allEdges.filter((edge) => {
    const sourceId = getEdgeSourceId(edge);
    const targetId = getEdgeTargetId(edge);
    if (!visibleIds.has(sourceId) || !visibleIds.has(targetId)) return false;

    const sourceNode = getNodeById(sourceId);
    const targetNode = getNodeById(targetId);
    if (!sourceNode || !targetNode) return false;

    const isConceptTerm = (sourceId === conceptId && targetNode.type === "term") ||
      (targetId === conceptId && sourceNode.type === "term");
    const isMainEdge = sourceNode.type !== "term" && targetNode.type !== "term";

    return isConceptTerm || isMainEdge;
  });

  return { nodes, edges };
}

function getTermContextData(conceptId, termId) {
  const main = getMainViewData();
  const conceptTermIds = getDirectTermIdsForConcept(conceptId);
  const relatedTermIds = getDirectTermNeighborIds(termId);
  const visibleIds = new Set([
    ...main.nodes.map((node) => node.id),
    conceptId,
    ...conceptTermIds,
    termId,
    ...relatedTermIds,
  ]);

  const nodes = state.allNodes.filter((node) => visibleIds.has(node.id));
  const edges = state.allEdges.filter((edge) => {
    const sourceId = getEdgeSourceId(edge);
    const targetId = getEdgeTargetId(edge);
    if (!visibleIds.has(sourceId) || !visibleIds.has(targetId)) return false;

    const sourceNode = getNodeById(sourceId);
    const targetNode = getNodeById(targetId);
    if (!sourceNode || !targetNode) return false;

    const isConceptTerm = (sourceId === conceptId && targetNode.type === "term") ||
      (targetId === conceptId && sourceNode.type === "term");
    const isTermRelated = sourceNode.type === "term" && targetNode.type === "term" &&
      (sourceId === termId || targetId === termId || (conceptTermIds.has(sourceId) && conceptTermIds.has(targetId)));
    const isMainEdge = sourceNode.type !== "term" && targetNode.type !== "term";

    return isConceptTerm || isTermRelated || isMainEdge;
  });

  return { nodes, edges };
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

  if (state.simulationStopTimer) {
    window.clearTimeout(state.simulationStopTimer);
    state.simulationStopTimer = null;
  }

  if (state.simulation) {
    state.simulation.stop();
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const preparedEdges = edges
    .filter((edge) => nodeMap.has(getEdgeSourceId(edge)) && nodeMap.has(getEdgeTargetId(edge)))
    .map((edge) => ({ ...edge }));

  const usePresetLayout = state.viewMode === "main";
  if (usePresetLayout) {
    applyPresetMainLayout(nodes, preparedEdges, width, height);
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
          .attr("class", (node) => `node node-${node.type}${isCoreConceptNode(node) ? " node-core" : ""}`)
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
          .attr("class", (node) => `node node-${node.type}${isCoreConceptNode(node) ? " node-core" : ""}`)
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

  if (usePresetLayout) {
    state.forceStarted = false;
    state.linkSelection
      .selectAll("line")
      .attr("x1", (edge) => getEdgeNode(edge.source, nodeMap).x)
      .attr("y1", (edge) => getEdgeNode(edge.source, nodeMap).y)
      .attr("x2", (edge) => getEdgeNode(edge.target, nodeMap).x)
      .attr("y2", (edge) => getEdgeNode(edge.target, nodeMap).y);

    nodeEnter.attr("transform", (node) => `translate(${node.x},${node.y})`);

    requestAnimationFrame(() => focusNodeGroup(nodes.map((node) => node.id)));
    highlightSelection();
    updateBackToMainButton();
    return;
  }

  state.forceStarted = true;
  state.simulation = d3
    .forceSimulation(nodes)
    .alphaDecay(0.08)
    .velocityDecay(0.45)
    .force(
      "link",
      d3
        .forceLink(preparedEdges)
        .id((node) => node.id)
        .distance((edge) => getLinkDistance(edge))
        .strength(0.45)
    )
    .force("charge", d3.forceManyBody().strength((node) => getCharge(node)))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius((node) => getNodeRadius(node) + (isMobileLayout() ? 34 : 38)))
    .force("x", d3.forceX(width / 2).strength(0.035))
    .force("y", d3.forceY(height / 2).strength(0.035))
    .on("tick", () => {
      state.linkSelection
        .selectAll("line")
        .attr("x1", (edge) => edge.source.x)
        .attr("y1", (edge) => edge.source.y)
        .attr("x2", (edge) => edge.target.x)
        .attr("y2", (edge) => edge.target.y);

      nodeEnter.attr("transform", (node) => `translate(${node.x},${node.y})`);
    });

  state.simulationStopTimer = window.setTimeout(() => {
    if (state.simulation) {
      state.simulation.stop();
    }
    state.simulationStopTimer = null;
  }, 2500);

  highlightSelection();
  updateBackToMainButton();
}


function startMainViewBurstSimulation(phase = "concept") {
  if (state.viewMode !== "main" || !state.introFinished) return;
  if (!state.currentNodes || state.currentNodes.length === 0) return;

  const graphCard = document.querySelector(".graph-card");
  if (!graphCard || !state.nodeSelection || !state.linkSelection) return;

  const width = graphCard.clientWidth;
  const height = graphCard.clientHeight;
  const allMainNodes = state.currentNodes;
  const topics = allMainNodes.filter((node) => node.type === "topic");
  const concepts = allMainNodes.filter((node) => node.type === "concept");

  const simNodes = phase === "topic" ? topics : allMainNodes;
  if (simNodes.length === 0) return;

  const simNodeIds = new Set(simNodes.map((node) => node.id));
  const allNodeIds = new Set(allMainNodes.map((node) => node.id));
  const simEdges = (state.currentEdges || [])
    .filter((edge) => allNodeIds.has(getEdgeSourceId(edge)) && allNodeIds.has(getEdgeTargetId(edge)))
    .map((edge) => ({ ...edge }));

  stopActiveSimulation();

  const topicAnchors = new Map();
  topics.forEach((node) => {
    const saved = state.manualMainPositions.get(node.id);
    if (saved) {
      node.x = saved.x;
      node.y = saved.y;
    }

    if (phase === "topic") {
      node.fx = null;
      node.fy = null;
    } else {
      node.fx = node.x;
      node.fy = node.y;
    }

    topicAnchors.set(node.id, { x: node.x || width / 2, y: node.y || height / 2 });
  });

  concepts.forEach((node) => {
    const saved = state.manualMainPositions.get(node.id);
    if (saved) {
      node.x = saved.x;
      node.y = saved.y;
    }

    if (phase === "topic") {
      node.fx = node.x;
      node.fy = node.y;
    } else {
      node.fx = null;
      node.fy = null;
    }
  });

  const topicByConcept = buildTopicByConceptMap(concepts, topics, simEdges);
  const conceptBurstRadius = isMobileLayout() ? 165 : 235;

  if (phase === "concept") {
    concepts.forEach((node, index) => {
      if (state.manualMainPositions.has(node.id)) return;

      const topicId = topicByConcept.get(node.id);
      const anchor = topicId ? topicAnchors.get(topicId) : null;
      const baseX = anchor ? anchor.x : width / 2;
      const baseY = anchor ? anchor.y : height / 2;
      const angle = index * GOLDEN_ANGLE + seededUnitFromText(node.id, 12) * Math.PI * 2;
      const radius = conceptBurstRadius * (0.42 + seededUnitFromText(node.id, 13) * 0.72);
      node.x = clamp(baseX + Math.cos(angle) * radius, 48, width - 48);
      node.y = clamp(baseY + Math.sin(angle) * radius, 54, height - 54);
    });
  }

  state.forceStarted = true;
  state.simulation = d3
    .forceSimulation(simNodes)
    .alpha(phase === "topic" ? 1 : 0.92)
    .alphaMin(0.035)
    .alphaDecay(phase === "topic" ? 0.048 : 0.052)
    .velocityDecay(phase === "topic" ? 0.42 : 0.50)
    .force("charge", d3.forceManyBody().strength((node) => {
      if (node.type === "topic") return phase === "topic" ? -2800 : -900;
      return -820;
    }))
    .force("collision", d3.forceCollide().radius((node) => {
      const base = getNodeRadius(node);
      if (node.type === "topic") return base + (phase === "topic" ? 86 : 58);
      return base + 56;
    }).strength(0.96))
    .force("center", d3.forceCenter(width / 2, height / 2).strength(phase === "topic" ? 0.045 : 0.018))
    .force("x", d3.forceX((node) => {
      if (node.type === "topic") return width / 2;
      const topicId = topicByConcept.get(node.id);
      const anchor = topicId ? topicAnchors.get(topicId) : null;
      return anchor ? anchor.x : width / 2;
    }).strength((node) => node.type === "topic" ? 0.045 : 0.075))
    .force("y", d3.forceY((node) => {
      if (node.type === "topic") return height / 2;
      const topicId = topicByConcept.get(node.id);
      const anchor = topicId ? topicAnchors.get(topicId) : null;
      return anchor ? anchor.y : height / 2;
    }).strength((node) => node.type === "topic" ? 0.045 : 0.075))
    .on("tick", updateStaticGraphPositions);

  if (phase === "concept") {
    state.simulation.force(
      "link",
      d3.forceLink(simEdges)
        .id((node) => node.id)
        .distance((edge) => {
          const sourceNode = getNodeById(getEdgeSourceId(edge));
          const targetNode = getNodeById(getEdgeTargetId(edge));
          if (sourceNode?.type === "topic" || targetNode?.type === "topic") return isMobileLayout() ? 190 : 240;
          return isMobileLayout() ? 132 : 170;
        })
        .strength(0.12)
    );
  }

  state.simulationStopTimer = window.setTimeout(() => {
    stopActiveSimulation(false);
    allMainNodes.forEach((node) => {
      state.manualMainPositions.set(node.id, { x: node.x || 0, y: node.y || 0 });
      if (state.viewMode === "main") {
        node.fx = node.x;
        node.fy = node.y;
      }
    });
    updateStaticGraphPositions();
  }, phase === "topic" ? 1150 : 2600);
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

  const label = shortenLabel(node.label, node.type);

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
  // 階層視覺規則：Topic 最大 → Concept 中等 → Term 小 → Sentence 最小。
  // 不直接吃 node.size 當主尺寸，避免資料 count/size 讓 Concept 比 Topic 還大。
  const isMobile = isMobileLayout();
  const count = Math.max(0, Number(node.count || node.frequency || 0));
  const countBoost = Math.min(6, Math.log(count + 1) * 1.2);

  if (node.type === "topic") return (isMobile ? 34 : 42) + countBoost;
  if (node.type === "concept") return (isMobile ? 25 : 31) + countBoost * 0.65;
  if (node.type === "term") return (isMobile ? 15 : 18) + countBoost * 0.38;
  if (node.type === "phrase" || node.type === "sentence") return isMobile ? 11 : 13;

  return isMobile ? 15 : 17;
}

function getLabelSize(node) {
  // 字體也跟著層級遞減，但差距不要太大，避免可讀性下降。
  if (node.type === "topic") return isMobileLayout() ? 16 : 18;
  if (node.type === "concept") return isMobileLayout() ? 14 : 16;
  if (node.type === "term") return isMobileLayout() ? 12 : 13;
  if (node.type === "phrase" || node.type === "sentence") return 12;
  return 13;
}

function getCharge(node) {
  if (node.type === "topic") return -900;
  if (node.type === "concept") return -650;
  if (node.type === "term") return -260;
  if (node.type === "phrase") return -220;
  return -300;
}

function getLinkDistance(edge) {
  if (edge.type === "contains") return 145;
  if (edge.type === "alias_of") return 88;
  if (edge.type === "related_phrase") return 110;
  return 105;
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
    if (state.viewMode === "main" && !state.previousMainTransform && state.svg) {
      state.previousMainTransform = d3.zoomTransform(state.svg.node());
    }
    state.viewMode = "concept_terms";
    state.activeConceptId = node.id;
    state.activeTermId = null;
    state.selectedNodeId = node.id;
    updateGraph();
    selectNode(node.id);
    requestAnimationFrame(() => focusNode(node.id));
    updateBackToMainButton();
    return;
  }

  if (node.type === "term") {
    const parentConceptId = findParentConceptIdForTerm(node.id) || state.activeConceptId;
    state.viewMode = parentConceptId ? "term_context" : "main";
    state.activeConceptId = parentConceptId;
    state.activeTermId = node.id;
    state.selectedNodeId = node.id;
    updateGraph();
    selectNode(node.id);
    requestAnimationFrame(() => focusNode(node.id));
    updateBackToMainButton();
    return;
  }

  selectNode(node.id);
  requestAnimationFrame(() => focusNode(node.id));
}

function returnToMainView() {
  state.viewMode = "main";
  state.activeConceptId = null;
  state.activeTermId = null;
  state.selectedNodeId = null;

  updateGraph();
  renderDefaultInfo();
  updateBackToMainButton();

  const previousTransform = state.previousMainTransform;
  state.previousMainTransform = null;

  requestAnimationFrame(() => {
    if (previousTransform && state.svg && state.zoomBehavior) {
      state.svg.transition().duration(560).call(state.zoomBehavior.transform, previousTransform);
    } else {
      resetZoom();
    }
  });
}

function updateBackToMainButton() {
  const button = document.getElementById("backToMainBtn");
  if (!button) return;

  const isMain = state.viewMode === "main" && !state.activeConceptId && !state.activeTermId;
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

    // JS-7C：手機點節點後開啟 Bottom Sheet；桌機維持目前狀態。
    if (isMobileLayout()) {
      openMobileBottomSheet(60);
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
  const selectedId = state.selectedNodeId;

  if (!selectedId) {
    state.nodeSelection
      .selectAll("g")
      .classed("selected", false)
      .classed("related", false)
      .classed("dimmed", false);

    state.linkSelection
      .selectAll("line")
      .classed("highlight", false)
      .classed("dimmed", false);

    return;
  }

  const connectedIds = getConnectedNodeIds(selectedId);

  state.nodeSelection
    .selectAll("g")
    .classed("selected", (node) => node.id === selectedId)
    .classed("related", (node) => connectedIds.has(node.id))
    .classed("dimmed", (node) => !connectedIds.has(node.id));

  state.linkSelection
    .selectAll("line")
    .classed("highlight", (edge) => {
      const sourceId = typeof edge.source === "object" ? edge.source.id : edge.source;
      const targetId = typeof edge.target === "object" ? edge.target.id : edge.target;

      return sourceId === selectedId || targetId === selectedId;
    })
    .classed("dimmed", (edge) => {
      const sourceId = typeof edge.source === "object" ? edge.source.id : edge.source;
      const targetId = typeof edge.target === "object" ? edge.target.id : edge.target;

      return sourceId !== selectedId && targetId !== selectedId;
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
  state.activeTag = null;
  setVisibleTypes(["topic", "concept", "term", "phrase"]);

  if (matchedNode.type === "term") {
    const parentConceptId = findParentConceptIdForTerm(matchedNode.id);
    if (parentConceptId) {
      state.viewMode = "term_context";
      state.activeConceptId = parentConceptId;
      state.activeTermId = matchedNode.id;
      state.selectedNodeId = matchedNode.id;
    }
  } else if (matchedNode.type === "concept") {
    state.viewMode = "concept_terms";
    state.activeConceptId = matchedNode.id;
    state.activeTermId = null;
    state.selectedNodeId = matchedNode.id;
  } else {
    state.viewMode = "main";
    state.activeConceptId = null;
    state.activeTermId = null;
    state.selectedNodeId = matchedNode.id;
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
    selectNode(state.selectedNodeId || matchedNode.id);
    focusNode(state.selectedNodeId || matchedNode.id);
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
  return UI_TYPES[type] || type;
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
