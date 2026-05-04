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
  infoPanelCompact: false,
};

const nodeColors = {
  topic: "#b9dcec",
  concept: "#bfe7e2",
  term: "#f4d982",
  phrase: "#f7ead0",
  unknown: "#d8eeee",
};

const edgeColors = {
  contains: "rgba(92, 142, 157, 0.62)",
  related_to: "rgba(92, 166, 168, 0.62)",
  alias_of: "rgba(217, 170, 56, 0.62)",
  related_phrase: "rgba(196, 166, 95, 0.56)",
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    await loadData();
    restoreSidebarState();
    restoreSidebarWidth();
    restoreSearchPanelState();
    setupCategoryChips();
    setupControls();
    setupResizablePanels();
    renderGraph();
    renderDefaultInfo();
    setupInfoPanelCompact();
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
  const isCollapsed = localStorage.getItem("sidebarCollapsed") === "1";

  if (isCollapsed) {
    appShell.classList.add("sidebar-collapsed");
  }
}

function restoreSidebarWidth() {
  const sidebar = document.getElementById("sidebar");
  const savedWidth = localStorage.getItem("sidebarWidth");

  if (!sidebar || !savedWidth) return;

  const width = Number(savedWidth);

  if (Number.isFinite(width) && width >= 220 && width <= 420) {
    sidebar.style.width = `${width}px`;
  }
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

  setTimeout(() => {
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

  setTimeout(() => {
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
  const resetViewBtn = document.getElementById("resetViewBtn");
  const expandAllBtn = document.getElementById("expandAllBtn");
  const clearSelectionBtn = document.getElementById("clearSelectionBtn");
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
  const searchToggleBtn = document.getElementById("searchToggleBtn");

  if (searchBtn) {
    searchBtn.addEventListener("click", searchNode);
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      showAll();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        searchNode();
      }

      if (event.key === "Escape") {
        const panel = document.getElementById("sidebarSearchPanel");
        if (panel) {
          panel.classList.add("search-collapsed");
          localStorage.setItem("searchPanelOpen", "0");
        }
      }
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
}

function clearSelection() {
  state.selectedNodeId = null;
  highlightSelection();
  renderDefaultInfo();
}

/* ================================
   Resizable Panels
================================ */

function setupResizablePanels() {
  setupSidebarResize();
  setupMainVerticalResize();
  setupInnerHorizontalResize();
}

function setupSidebarResize() {
  const handle = document.getElementById("sidebarResizeHandle");
  const sidebar = document.getElementById("sidebar");
  const appShell = document.querySelector(".app-shell");

  if (!handle || !sidebar || !appShell) return;

  let isDragging = false;

  handle.addEventListener("mousedown", () => {
    if (appShell.classList.contains("sidebar-collapsed")) return;

    isDragging = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  window.addEventListener("mousemove", (event) => {
    if (!isDragging) return;

    const minWidth = 220;
    const maxWidth = 420;
    const nextWidth = Math.max(minWidth, Math.min(maxWidth, event.clientX - 18));

    sidebar.style.width = `${nextWidth}px`;
    localStorage.setItem("sidebarWidth", String(nextWidth));

    resizeGraphAfterPanelChange();
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;

    isDragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });
}

function setupMainVerticalResize() {
  const handle = document.getElementById("mainResizeHandle");
  const workspace = document.getElementById("workspace");

  if (!handle || !workspace) return;

  let isDragging = false;

  handle.addEventListener("mousedown", () => {
    isDragging = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  });

  window.addEventListener("mousemove", (event) => {
    if (!isDragging) return;

    const rect = workspace.getBoundingClientRect();
    const infoHeight = rect.bottom - event.clientY;

    const minInfo = 180;
    const maxInfo = Math.max(240, rect.height * 0.62);
    const nextHeight = Math.max(minInfo, Math.min(maxInfo, infoHeight));

    workspace.style.setProperty("--info-height", `${nextHeight}px`);
    resizeGraphAfterPanelChange();
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;

    isDragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });
}

function setupInnerHorizontalResize() {
  const handle = document.getElementById("innerResizeHandle");
  const splitArea = document.querySelector(".info-split-area");

  if (!handle || !splitArea) return;

  let isDragging = false;

  handle.addEventListener("mousedown", () => {
    isDragging = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  window.addEventListener("mousemove", (event) => {
    if (!isDragging) return;

    const rect = splitArea.getBoundingClientRect();
    const ratio = ((event.clientX - rect.left) / rect.width) * 100;

    const nextRatio = Math.max(28, Math.min(72, ratio));
    splitArea.style.setProperty("--sentence-width", `${nextRatio}%`);
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;

    isDragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });
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

const INTRO_MAX_CHARS = 14;
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

function renderGraph() {
  const svg = d3.select("#graphSvg");
  state.svg = svg;

  const graphCard = document.querySelector(".graph-card");
  const width = graphCard.clientWidth;
  const height = graphCard.clientHeight;

  svg.attr("viewBox", [0, 0, width, height]);
  svg.selectAll("*").remove();

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
          .attr("text-anchor", "middle")
          .attr("dy", (node) => getNodeRadius(node) + 15)
          .attr("font-size", (node) => getLabelSize(node))
          .text((node) => shortenLabel(node.label, node.type));

        g.on("click", (event, node) => {
          event.stopPropagation();
          selectNode(node.id);
        });

        g.on("dblclick", (event, node) => {
          event.stopPropagation();
          focusNode(node.id);
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
          .text((node) => shortenLabel(node.label, node.type));

        return update;
      },
      (exit) => exit.remove()
    );

  state.svg.on("click", () => {
    clearSelection();
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

  const transform = d3.zoomIdentity
    .translate(width / 2, height / 2)
    .scale(1.55)
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
   Info Panel Compact / Title Number
   各平台資訊欄：點擊圖案收合/展開，標題後方顯示隨機 0000-9999
================================ */

function setupInfoPanelCompact() {
  const infoPanel = document.getElementById("infoPanel");
  const infoIcon = document.querySelector(".info-icon");

  if (!infoPanel || !infoIcon) return;

  infoIcon.setAttribute("role", "button");
  infoIcon.setAttribute("tabindex", "0");
  infoIcon.setAttribute("title", "收合 / 展開資訊欄");

  infoIcon.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleInfoPanelCompact();
  });

  infoIcon.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    event.stopPropagation();
    toggleInfoPanelCompact();
  });

  applyInfoPanelCompactState();
}

function toggleInfoPanelCompact() {
  state.infoPanelCompact = !state.infoPanelCompact;
  applyInfoPanelCompactState();

  requestAnimationFrame(() => {
    resizeGraphAfterPanelChange();
  });
}

function applyInfoPanelCompactState() {
  const infoPanel = document.getElementById("infoPanel");
  const workspace = document.getElementById("workspace");

  if (!infoPanel) return;

  infoPanel.classList.toggle("info-panel-compact", state.infoPanelCompact);

  if (workspace) {
    workspace.classList.toggle("info-panel-compact-workspace", state.infoPanelCompact);
  }
}

function setInfoTitle(titleText) {
  const title = document.getElementById("infoTitle");
  if (!title) return;

  const text = String(titleText || "尚未選擇節點").trim() || "尚未選擇節點";
  const code = generateInfoTitleNumber();

  title.innerHTML = `
    <span class="info-title-text">${escapeHtml(text)}</span>
    <span class="info-title-number">${code}</span>
  `;
}

function generateInfoTitleNumber() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
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
  applyInfoPanelCompactState();
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

  setTimeout(() => {
    const matchedNode = state.allNodes.find((node) => {
      return buildSearchHaystack(node).includes(keyword);
    });

    if (matchedNode) {
      setVisibleTypes(["topic", "concept", "term", "phrase"]);

      setTimeout(() => {
        focusNode(matchedNode.id);
      }, 280);
    }
  }, 280);
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
  resizeGraphAfterPanelChange();
});
