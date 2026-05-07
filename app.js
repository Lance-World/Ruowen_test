const DATA_PATHS = {
  nodes: "./data/graph_nodes.json",
  edges: "./data/graph_edges.json",
  sources: "./data/graph_sources.json",
  meta: "./data/graph_meta.json",
  intro: "./data/intro_messages.json",
};

const state = {
  allNodes: [],
  allEdges: [],
  graphSources: {},
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
};

const nodeColors = {
  topic: "#CFEAF4",      // 第一層：霧感淡藍
  concept: "#D7EEE9",    // 第二層：霧青綠，與背景融合
  term: "#DCD9EA",       // 第三層：低飽和灰紫
  phrase: "#F6F1E8",     // 第四層：奶霜米白
  unknown: "#E8F3F1",
};

const edgeColors = {
  contains: "rgba(92, 142, 157, 0.62)",
  related_to: "rgba(92, 166, 168, 0.62)",
  alias_of: "rgba(126, 156, 168, 0.42)",
  related_phrase: "rgba(150, 168, 176, 0.34)",
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    await loadData();
    restoreSidebarState();
    restoreSidebarWidth();
    restoreSearchPanelState();
    restorePanelPreferences();
    updateFloatingLayoutVars();
    syncMobileOnlyResizeHandles();
    updateMobileToolbarPosition();
    setupCategoryChips();
    setupControls();
    setupResizablePanels();
    setupInfoCompactToggle();
    setupMobileBottomSheetGestures();
    setupAboutModal();
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

async function loadData() {
  const [nodes, edges, sources, meta] = await Promise.all([
    fetchJson(DATA_PATHS.nodes),
    fetchJson(DATA_PATHS.edges),
    fetchJson(DATA_PATHS.sources),
    fetchJson(DATA_PATHS.meta),
  ]);

  state.allNodes = nodes;
  state.allEdges = edges;
  state.graphSources = sources;
  state.meta = meta;

  console.log("nodes:", state.allNodes.length);
  console.log("edges:", state.allEdges.length);
  console.log("source nodes:", Object.keys(state.graphSources).length);
}

async function fetchJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}`);
  }

  return response.json();
}

/* ================================
   Sidebar
================================ */

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
    button.textContent = category;
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
    updateGraph();

    // Mobile: category selection is a completed action, so dismiss the Sidebar
    // without changing graph zoom/pan or Bottom Sheet state.
    collapseMobileSidebarOnly();
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
  const resetViewBtn = document.getElementById("resetViewBtn");
  const expandAllBtn = document.getElementById("expandAllBtn");
  const clearSelectionBtn = document.getElementById("clearSelectionBtn");
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
  const searchToggleBtn = document.getElementById("searchToggleBtn");
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

  if (resetViewBtn) {
    resetViewBtn.addEventListener("click", resetZoom);
  }

  if (expandAllBtn) {
    expandAllBtn.addEventListener("click", showAll);
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

  if (isMobileLayout()) {
    closeMobileBottomSheet();
  }
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
    if (state.svg) {
      state.svg.on("dblclick.zoom", null);
    }

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

function setupSidebarResize() {
  const handle = document.getElementById("sidebarResizeHandle");
  const sidebar = document.getElementById("sidebar");

  if (!handle || !sidebar) return;

  enablePointerResize(handle, {
    cursor: "col-resize",
    onMove: (event) => {
      // JS-3A：手機完全停用 Sidebar resize。
      if (isMobileLayout()) return;

      const minWidth = 220;
      const maxWidth = Math.min(520, window.innerWidth * 0.68);
      const nextWidth = clamp(event.clientX - 18, minWidth, maxWidth);

      sidebar.style.width = `${nextWidth}px`;

      // JS-2B：不寫入 localStorage，重新整理後回到預設寬度。
      updateFloatingLayoutVars();
      resizeGraphAfterPanelChange();
    },
  });
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


function collapseMobileSidebarOnly() {
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

  requestAnimationFrame(() => {
    updateMobileToolbarPosition();
    resizeGraphAfterPanelChange();
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
    state.simulation.alpha(0.18).restart();
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

  if (!overlay || !textEl) return;

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
  ];

  const sources = getSourcesForNodeWithFallback(node);
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
  const searchInput = document.getElementById("searchInput");
  const keyword = normalizeSearchKeyword(searchInput ? searchInput.value : "");

  let nodes = state.allNodes.filter((node) => {
    if (!state.visibleTypes.has(node.type)) return false;

    if (
      state.selectedCategory !== "all" &&
      node.level1_category !== state.selectedCategory
    ) {
      return false;
    }

    if (keyword) {
      return buildSearchHaystack(node).includes(keyword);
    }

    return true;
  });

  const visibleIds = new Set(nodes.map((node) => node.id));

  let edges = state.allEdges.filter((edge) => {
    return visibleIds.has(edge.source) && visibleIds.has(edge.target);
  });

  const connectedIds = new Set();

  edges.forEach((edge) => {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  });

  if (keyword) {
    nodes.forEach((node) => connectedIds.add(node.id));
  }

  nodes = nodes.filter((node) => {
    if (node.type === "topic") return true;
    if (keyword) return true;
    return connectedIds.has(node.id);
  });

  return { nodes, edges };
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

  // Mobile uses double-tap blank space as an intentional reset / escape action.
  // Disable D3's default double-click zoom only on mobile so it does not fight resetZoom().
  if (isMobileLayout()) {
    svg.on("dblclick.zoom", null);
  }

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

  if (state.simulation) {
    state.simulation.stop();
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  const preparedEdges = edges
    .filter((edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target))
    .map((edge) => ({ ...edge }));

  state.linkSelection
    .selectAll("line")
    .data(preparedEdges, (edge) => edge.id)
    .join(
      (enter) =>
        enter
          .append("line")
          .attr("class", "link")
          .attr("stroke", (edge) => edgeColors[edge.type] || "rgba(96,129,137,0.5)")
          .attr(
            "stroke-width",
            (edge) => Math.max(1, Math.min(5, Math.log((edge.weight || 1) + 1)))
          ),
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
          .attr("class", "node")
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

          // JS-9B：手機點同一節點第二次才聚焦；桌機維持單擊選取。
          if (isMobileLayout()) {
            if (state.selectedNodeId === node.id && state.lastMobileTapNodeId === node.id) {
              focusNode(node.id);
            } else {
              selectNode(node.id);
              state.lastMobileTapNodeId = node.id;
            }
            return;
          }

          selectNode(node.id);
        });

        g.on("dblclick", (event, node) => {
          event.stopPropagation();
          if (!isMobileLayout()) {
            focusNode(node.id);
          }
        });

        return g;
      },
      (update) => {
        update
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

  state.svg.on("click", (event) => {
    // Mobile backdrop dismissal: tapping blank graph space collapses Sidebar only.
    // It intentionally preserves current zoom/pan and does not reset selection.
    if (isMobileLayout()) {
      event.preventDefault();
      collapseMobileSidebarOnly();
      return;
    }

    // Desktop keeps existing behavior.
    clearSelection();
  });

  state.svg.on("dblclick", (event) => {
    // Mobile escape hatch: double-tap blank graph space returns to the full view.
    // Node dblclick/tap handlers already stop propagation, so this is blank-space only.
    if (!isMobileLayout()) return;

    event.preventDefault();
    collapseMobileSidebarOnly();
    resetZoom();
  });

  state.simulation = d3
    .forceSimulation(nodes)
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
    .force("collision", d3.forceCollide().radius((node) => getNodeRadius(node) + 32))
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

  highlightSelection();
}

/* ================================
   Graph Style Helpers
================================ */


function renderNodeLabel(textSelection, node) {
  textSelection.selectAll("*").remove();

  const label = shortenLabel(node.label, node.type);
  const count = Number(node.count || 0);

  textSelection
    .append("tspan")
    .attr("class", "label-name")
    .text(label);

  if (count > 0) {
    textSelection
      .append("tspan")
      .attr("class", "label-count")
      .attr("dx", 5)
      .text(formatCount(count));
  }
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
  const size = Number(node.size || 20);

  if (node.type === "topic") return Math.max(22, Math.min(36, size));
  if (node.type === "concept") return Math.max(20, Math.min(42, size));
  if (node.type === "term") return Math.max(12, Math.min(27, size));
  if (node.type === "phrase") return Math.max(10, Math.min(24, size));

  return 16;
}

function getLabelSize(node) {
  if (node.type === "topic") return 13;
  if (node.type === "concept") return 13;
  if (node.type === "term") return 11;
  if (node.type === "phrase") return 10;
  return 11;
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

  const visibleNode = state.nodeSelection
    .selectAll("g")
    .data()
    .find((item) => item.id === nodeId);

  if (!visibleNode || visibleNode.x === undefined || visibleNode.y === undefined) return;

  const graphCard = document.querySelector(".graph-card");
  const width = graphCard.clientWidth;
  const height = graphCard.clientHeight;

  const targetScale = isMobileLayout() ? 1.05 : 1.55;
  const targetY = isMobileLayout() ? height * 0.42 : height / 2;

  const transform = d3.zoomIdentity
    .translate(width / 2, targetY)
    .scale(targetScale)
    .translate(-visibleNode.x, -visibleNode.y);

  state.svg
    .transition()
    .duration(650)
    .call(state.zoomBehavior.transform, transform);
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

function renderDefaultInfo() {
  setInfoTitle("尚未選擇節點");
  document.getElementById("infoTags").innerHTML = "<span>請點選圖上的節點</span>";
  document.getElementById("relatedTerms").innerHTML = '<span class="muted">尚無資料</span>';
  document.getElementById("relatedPhrases").innerHTML = '<span class="muted">尚無資料</span>';
  document.getElementById("sourceList").innerHTML = '<span class="muted">尚無資料</span>';
}

function renderInfoPanel(node) {
  setInfoTitle(node.label || node.id);

  const tags = [
    typeLabel(node.type),
    node.level1_category,
    node.level2_concept && node.type !== "concept" ? node.level2_concept : "",
    `出現次數 ${node.count || 0}`,
  ].filter(Boolean);

  document.getElementById("infoTags").innerHTML = tags
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("");

  renderRelatedTerms(node);
  renderRelatedPhrases(node);
  renderSources(node);
}

function renderRelatedTerms(node) {
  const box = document.getElementById("relatedTerms");

  if (!box) return;

  const relatedNodes = getNeighborNodes(node.id)
    .filter((item) => item.type === "term")
    .slice(0, 30);

  const matchedTerms = String(node.matched_terms || "")
    .split("、")
    .map((item) => item.trim())
    .filter(Boolean);

  const labels = Array.from(
    new Set([
      ...relatedNodes.map((item) => item.label),
      ...matchedTerms,
      node.canonical_term,
    ].filter(Boolean))
  ).slice(0, 36);

  if (labels.length === 0) {
    box.innerHTML = '<span class="muted">尚無資料</span>';
    return;
  }

  box.innerHTML = labels
    .map((label) => `<span>${escapeHtml(label)}</span>`)
    .join("");
}

function renderRelatedPhrases(node) {
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
    String(node.text_preview)
      .split(" || ")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => phraseTexts.push(item));
  }

  const sources = getSourcesForNodeWithFallback(node);

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

function renderSources(node) {
  const box = document.getElementById("sourceList");

  if (!box) return;

  const sources = getSourcesForNodeWithFallback(node);

  if (sources.length === 0) {
    box.innerHTML = '<span class="muted">尚無資料</span>';
    return;
  }

  box.innerHTML = sources
    .slice(0, 18)
    .map((source) => {
      const title = source.title || source.file || "未命名來源";
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

function getSourcesForNodeWithFallback(node) {
  const directSources = state.graphSources[node.id] || [];

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
   Search / Zoom
================================ */

function searchNode() {
  const input = document.getElementById("searchInput");
  const keyword = normalizeSearchKeyword(input ? input.value : "");

  updateGraph();

  if (!keyword) return;

  const matchedNodes = state.allNodes.filter((node) => {
    return buildSearchHaystack(node).includes(keyword);
  });

  if (matchedNodes.length === 0) {
    appendSearchFeedback(0);
    return;
  }

  const matchedNode = matchedNodes[0];
  setVisibleTypes(["topic", "concept", "term", "phrase"]);

  // JS-6C：手機搜尋後自動收合 Sidebar，桌機維持原狀。
  if (isMobileLayout()) {
    const appShell = document.querySelector(".app-shell");
    const panel = document.getElementById("sidebarSearchPanel");
    if (appShell) appShell.classList.add("sidebar-collapsed");
    if (panel) panel.classList.add("search-collapsed");
    localStorage.setItem("searchPanelOpen", "0");
    updateFloatingLayoutVars();
  }

  setTimeout(() => {
    focusNode(matchedNode.id);
    appendSearchFeedback(matchedNodes.length);
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
    topic: "第一層主題",
    concept: "第二層概念",
    term: "詞彙",
    phrase: "句子",
  };

  return map[type] || type;
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

/* ================================
   Drag Nodes
================================ */

function dragStarted(event, node) {
  if (!event.active) state.simulation.alphaTarget(0.3).restart();

  node.fx = node.x;
  node.fy = node.y;
}

function dragged(event, node) {
  node.fx = event.x;
  node.fy = event.y;
}

function dragEnded(event, node) {
  if (!event.active) state.simulation.alphaTarget(0);

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
