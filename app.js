const DATA_PATHS = {
  nodes: "./data/graph_nodes.json",
  edges: "./data/graph_edges.json",
  sources: "./data/graph_sources.json",
  meta: "./data/graph_meta.json",
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
    setupCategoryChips();
    setupControls();
    setupResizablePanels();
    renderGraph();
    renderDefaultInfo();
  } catch (error) {
    console.error(error);
    alert("讀取資料失敗，請確認 web/data/*.json 是否存在，並用本機伺服器開啟。");
  }
}

/* ================================
   Data Loading
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

function toggleSidebar() {
  const appShell = document.querySelector(".app-shell");
  appShell.classList.toggle("sidebar-collapsed");

  const isCollapsed = appShell.classList.contains("sidebar-collapsed");
  localStorage.setItem("sidebarCollapsed", isCollapsed ? "1" : "0");

  setTimeout(() => {
    resizeGraphAfterPanelChange();
  }, 320);
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

  document.getElementById("searchBtn").addEventListener("click", searchNode);

  document.getElementById("searchInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      searchNode();
    }
  });

  document.getElementById("resetViewBtn").addEventListener("click", resetZoom);
  document.getElementById("expandAllBtn").addEventListener("click", showAll);
  document.getElementById("clearSelectionBtn").addEventListener("click", clearSelection);
  document.getElementById("sidebarToggleBtn").addEventListener("click", toggleSidebar);

  document.getElementById("showTopicOnlyBtn").addEventListener("click", () => {
    setVisibleTypes(["topic"]);
  });

  document.getElementById("showConceptOnlyBtn").addEventListener("click", () => {
    setVisibleTypes(["topic", "concept"]);
  });
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

  document.getElementById("searchInput").value = "";

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
  setupMainVerticalResize();
  setupInnerHorizontalResize();
}

function setupMainVerticalResize() {
  const handle = document.getElementById("mainResizeHandle");
  const workspace = document.getElementById("workspace");

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
  const width = graphCard.clientWidth;
  const height = graphCard.clientHeight;

  state.svg.attr("viewBox", [0, 0, width, height]);

  if (state.simulation) {
    state.simulation.force("center", d3.forceCenter(width / 2, height / 2));
    state.simulation.alpha(0.18).restart();
  }
}

/* ================================
   Filtering
================================ */

function getFilteredData() {
  const keyword = document.getElementById("searchInput").value.trim().toLowerCase();

  let nodes = state.allNodes.filter((node) => {
    if (!state.visibleTypes.has(node.type)) return false;

    if (
      state.selectedCategory !== "all" &&
      node.level1_category !== state.selectedCategory
    ) {
      return false;
    }

    if (keyword) {
      const label = String(node.label || "").toLowerCase();
      const concept = String(node.level2_concept || "").toLowerCase();
      const category = String(node.level1_category || "").toLowerCase();
      const matchedTerms = String(node.matched_terms || "").toLowerCase();
      const preview = String(node.text_preview || "").toLowerCase();

      return (
        label.includes(keyword) ||
        concept.includes(keyword) ||
        category.includes(keyword) ||
        matchedTerms.includes(keyword) ||
        preview.includes(keyword)
      );
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

  document.getElementById("emptyState").classList.toggle("hidden", nodes.length > 0);

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

  const node = state.allNodes.find((item) => item.id === nodeId);
  if (!node || node.x === undefined || node.y === undefined) return;

  const graphCard = document.querySelector(".graph-card");
  const width = graphCard.clientWidth;
  const height = graphCard.clientHeight;

  const transform = d3.zoomIdentity
    .translate(width / 2, height / 2)
    .scale(1.55)
    .translate(-node.x, -node.y);

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
  document.getElementById("infoTitle").textContent = "尚未選擇節點";
  document.getElementById("infoTags").innerHTML = "<span>請點選圖上的節點</span>";
  document.getElementById("relatedTerms").innerHTML = '<span class="muted">尚無資料</span>';
  document.getElementById("relatedPhrases").innerHTML = '<span class="muted">尚無資料</span>';
  document.getElementById("sourceList").innerHTML = '<span class="muted">尚無資料</span>';
}

function renderInfoPanel(node) {
  document.getElementById("infoTitle").textContent = node.label || node.id;

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
  const sources = state.graphSources[node.id] || [];

  if (sources.length === 0) {
    box.innerHTML = '<span class="muted">尚無資料</span>';
    return;
  }

  box.innerHTML = sources
    .slice(0, 18)
    .map((source) => {
      const title = source.title || source.file || "未命名來源";
      const time = source.timestamp || "";
      const url = source.timestamp_url || source.base_url || "#";
      const text = source.text || "";

      return `
        <div class="source-item">
          <div class="source-title">${escapeHtml(title)}</div>
          <div>
            <a class="source-link" href="${escapeAttribute(url)}" target="_blank">
              ▶ ${escapeHtml(time || "開啟來源")}
            </a>
          </div>
          <div class="source-text">${escapeHtml(shortenText(text, 100))}</div>
        </div>
      `;
    })
    .join("");
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
  const keyword = document.getElementById("searchInput").value.trim();

  updateGraph();

  if (!keyword) return;

  setTimeout(() => {
    const lowerKeyword = keyword.toLowerCase();

    const matchedNode = state.allNodes.find((node) => {
      const label = String(node.label || "").toLowerCase();
      const concept = String(node.level2_concept || "").toLowerCase();
      const category = String(node.level1_category || "").toLowerCase();
      const terms = String(node.matched_terms || "").toLowerCase();
      const preview = String(node.text_preview || "").toLowerCase();

      return (
        label.includes(lowerKeyword) ||
        concept.includes(lowerKeyword) ||
        category.includes(lowerKeyword) ||
        terms.includes(lowerKeyword) ||
        preview.includes(lowerKeyword)
      );
    });

    if (matchedNode) {
      focusNode(matchedNode.id);
    }
  }, 280);
}

function resetZoom() {
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