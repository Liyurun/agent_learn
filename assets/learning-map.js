(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var TRACK_KEY = "ah-learning-track";
  var COLORS = [
    "#6fd3c8",
    "#5aa7e6",
    "#e0a63a",
    "#e78a7f",
    "#7ad6a0",
    "#b28ad6",
    "#db7fb3",
    "#6dbdd1",
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function createSvg(tag, attributes) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attributes || {}).forEach(function (key) {
      node.setAttribute(key, String(attributes[key]));
    });
    return node;
  }

  function readJsonStorage(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function readStringStorage(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeStringStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {
      document.documentElement.classList.add("starmap-storage-unavailable");
    }
  }

  function indexNodes(graph) {
    var lookup = {};
    graph.nodes.forEach(function (node) { lookup[node.id] = node; });
    return lookup;
  }

  function chapterNodes(graph) {
    return graph.nodes
      .filter(function (node) { return node.kind === "chapter"; })
      .sort(function (left, right) { return left.order - right.order; });
  }

  function sectionsFor(graph, chapterId) {
    return graph.nodes
      .filter(function (node) {
        return node.kind === "section" && node.parent === chapterId;
      })
      .sort(function (left, right) { return left.order - right.order; });
  }

  function nodeHref(node) {
    return "./" + node.route + "/" + (
      node.fragment ? "#" + encodeURIComponent(node.fragment) : ""
    );
  }

  function progressState(track, graph) {
    var chapters = chapterNodes(graph);
    if (track === "advanced") {
      var advanced = readJsonStorage("ah-advanced-learning-state", {});
      var completedSections = Array.isArray(advanced.completedSections)
        ? advanced.completedSections
        : [];
      var completedChapters = Array.isArray(advanced.completedChapters)
        ? advanced.completedChapters
        : [];
      var last = readStringStorage(
        "ah-advanced-last-page",
        advanced.lastPage || chapters[0].id
      );
      var lookup = indexNodes(graph);
      var current = lookup[last];
      return {
        completedSections: new Set(completedSections),
        completedChapters: new Set(completedChapters),
        currentChapter: current && current.kind === "section"
          ? current.parent
          : (current && current.kind === "chapter" ? current.id : chapters[0].id),
        complete: completedSections.length + completedChapters.length,
        total: graph.progressTotal,
      };
    }
    var concise = readJsonStorage("ah-read-chapters", {});
    var completed = new Set(Object.keys(concise).filter(function (id) {
      return Boolean(concise[id]);
    }));
    var currentId = readStringStorage("ah-last-chapter", chapters[0].id);
    if (!chapters.some(function (chapter) { return chapter.id === currentId; })) {
      currentId = chapters[0].id;
    }
    return {
      completedSections: new Set(),
      completedChapters: completed,
      currentChapter: currentId,
      complete: completed.size,
      total: graph.progressTotal,
    };
  }

  function sectionIsDone(track, state, section) {
    return track === "advanced"
      ? state.completedSections.has(section.id)
      : state.completedChapters.has(section.parent);
  }

  function renderBackground(svg, layer) {
    var random = 1729;
    for (var index = 0; index < 100; index += 1) {
      random = (random * 48271) % 2147483647;
      var x = 12 + (random % 1014);
      random = (random * 48271) % 2147483647;
      var y = 10 + (random % 590);
      random = (random * 48271) % 2147483647;
      layer.appendChild(createSvg("circle", {
        class: "background-star",
        cx: x,
        cy: y,
        r: 0.5 + (random % 10) / 10,
        fill: "#d9edf4",
        opacity: 0.1 + (random % 24) / 100,
      }));
    }
    svg.appendChild(layer);
  }

  function layoutChapterClusters(graph, width, height) {
    var chapters = chapterNodes(graph);
    var columns = 7;
    var rows = Math.ceil(chapters.length / columns);
    return new Map(chapters.map(function (chapter, index) {
      var row = Math.floor(index / columns);
      var column = index % columns;
      var serpentine = row % 2 ? columns - 1 - column : column;
      return [
        chapter.id,
        {
          x: 70 + serpentine * ((width - 140) / (columns - 1)) +
            (row % 2 ? 18 : 0),
          y: 70 + row * ((height - 140) / Math.max(1, rows - 1)),
        },
      ];
    }));
  }

  function sectionPoints(center, sections) {
    return sections.map(function (_, index) {
      var angle = Math.PI * 2 * index / Math.max(1, sections.length) - Math.PI / 2;
      var radius = 11 + (index % 2) * 4;
      return {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      };
    });
  }

  function domainColor(graph, domainId) {
    var index = graph.domains.findIndex(function (domain) {
      return domain.id === domainId;
    });
    return COLORS[(index < 0 ? 0 : index) % COLORS.length];
  }

  function renderChapterEdges(graph, layer, positions) {
    var nodes = indexNodes(graph);
    graph.edges.forEach(function (edge) {
      var source = nodes[edge.source];
      var target = nodes[edge.target];
      if (!source || !target || source.kind !== "chapter" ||
          target.kind !== "chapter") return;
      var start = positions.get(source.id);
      var end = positions.get(target.id);
      if (!start || !end) return;
      layer.appendChild(createSvg("line", {
        class: edge.type === "sequence"
          ? "chapter-main-edge"
          : "chapter-relation-edge",
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        "data-edge-type": edge.type,
      }));
    });
  }

  function addSectionLink(wrapper, section, point, color, done) {
    var link = createSvg("a", {
      href: nodeHref(section),
      "aria-label": section.title,
      tabindex: "-1",
    });
    link.style.color = color;
    link.appendChild(createSvg("circle", {
      cx: point.x,
      cy: point.y,
      r: 5.5,
      fill: "transparent",
    }));
    link.appendChild(createSvg("circle", {
      class: "section-node" + (done ? " is-done" : ""),
      cx: point.x,
      cy: point.y,
      r: 2.1,
    }));
    wrapper.appendChild(link);
  }

  function renderChapterCluster(
    graph,
    chapter,
    center,
    state,
    selectedId,
    selectChapter
  ) {
    var sections = sectionsFor(graph, chapter.id);
    var points = sectionPoints(center, sections);
    var color = domainColor(graph, chapter.parent);
    var wrapper = createSvg("g", {
      class: "chapter-cluster" + (
        selectedId === chapter.id ? " is-selected" : ""
      ),
      "data-chapter-id": chapter.id,
      tabindex: "0",
      role: "button",
      "aria-label": chapter.title,
    });
    wrapper.style.color = color;

    points.forEach(function (point, index) {
      var next = points[(index + 1) % points.length];
      if (!next || points.length < 2) return;
      wrapper.appendChild(createSvg("line", {
        class: "section-edge",
        x1: point.x,
        y1: point.y,
        x2: next.x,
        y2: next.y,
      }));
    });
    points.forEach(function (point, index) {
      addSectionLink(
        wrapper,
        sections[index],
        point,
        color,
        sectionIsDone(graph.track, state, sections[index])
      );
    });

    wrapper.appendChild(createSvg("circle", {
      class: "chapter-hit",
      cx: center.x,
      cy: center.y,
      r: 24,
    }));
    wrapper.appendChild(createSvg("circle", {
      class: "chapter-node" + (
        state.currentChapter === chapter.id ? " is-current" : ""
      ),
      cx: center.x,
      cy: center.y,
      r: 4.5,
    }));
    var label = createSvg("text", {
      class: "chapter-label",
      x: center.x,
      y: center.y + 27,
      "text-anchor": "middle",
    });
    label.textContent = chapter.id.replace(/^advanced-/, "").toUpperCase() +
      " " + chapter.title.replace(/^第\s*\d+\s*章\s*[·：:]?\s*/, "").slice(0, 11);
    wrapper.appendChild(label);

    function activate(event) {
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") {
        return;
      }
      if (event.type === "keydown") event.preventDefault();
      selectChapter(chapter.id);
    }
    wrapper.addEventListener("click", activate);
    wrapper.addEventListener("keydown", activate);
    return wrapper;
  }

  function renderDesktopGraph(graph, state, selectedId, selectChapter, viewport) {
    var svg = byId("globalKnowledgeGraph");
    if (!svg) return;
    svg.replaceChildren();
    var background = createSvg("g", {});
    renderBackground(svg, background);
    var layer = createSvg("g", { class: "graph-layer" });
    layer.style.transform = "translate(" + viewport.x + "px," + viewport.y +
      "px) scale(" + viewport.scale + ")";
    var positions = layoutChapterClusters(graph, 1040, 620);
    renderChapterEdges(graph, layer, positions);
    chapterNodes(graph).forEach(function (chapter) {
      layer.appendChild(renderChapterCluster(
        graph,
        chapter,
        positions.get(chapter.id),
        state,
        selectedId,
        selectChapter
      ));
    });
    svg.appendChild(layer);
  }

  function renderChapterSubgraph(graph, chapter, state) {
    var svg = byId("chapterSubgraph");
    var list = byId("chapterSectionList");
    var title = byId("chapterGraphTitle");
    var meta = byId("chapterGraphMeta");
    var enter = byId("chapterEnterLink");
    if (!svg || !list || !title || !meta || !enter || !chapter) return;
    var sections = sectionsFor(graph, chapter.id);
    var color = domainColor(graph, chapter.parent);
    var center = { x: 142, y: 88 };
    var radius = sections.length > 8 ? 66 : 56;
    var points = sections.map(function (_, index) {
      var angle = Math.PI * 2 * index / Math.max(1, sections.length) - Math.PI / 2;
      return {
        x: center.x + Math.cos(angle) * (radius + (index % 2) * 8),
        y: center.y + Math.sin(angle) * (radius + (index % 2) * 8),
      };
    });
    svg.setAttribute("viewBox", "0 0 284 176");
    svg.replaceChildren();
    points.forEach(function (point, index) {
      var next = points[(index + 1) % points.length];
      if (!next || points.length < 2) return;
      svg.appendChild(createSvg("line", {
        x1: point.x,
        y1: point.y,
        x2: next.x,
        y2: next.y,
        stroke: color,
        "stroke-width": "1",
        opacity: "0.48",
      }));
    });
    points.forEach(function (point, index) {
      var section = sections[index];
      var link = createSvg("a", {
        href: nodeHref(section),
        "aria-label": section.title,
      });
      link.appendChild(createSvg("circle", {
        cx: point.x,
        cy: point.y,
        r: 5,
        fill: sectionIsDone(graph.track, state, section) ? color : "#0d1726",
        stroke: color,
        "stroke-width": "1.2",
      }));
      svg.appendChild(link);
    });
    svg.appendChild(createSvg("circle", {
      cx: center.x,
      cy: center.y,
      r: 9,
      fill: state.currentChapter === chapter.id ? "#e0a63a" : color,
    }));

    title.textContent = chapter.title;
    meta.textContent = sections.length + " 个小节 · " + (
      sections.filter(function (section) {
        return sectionIsDone(graph.track, state, section);
      }).length
    ) + " 个已完成";
    enter.href = nodeHref(chapter);
    list.replaceChildren();
    sections.forEach(function (section, index) {
      var link = document.createElement("a");
      link.className = "chapter-section-link" + (
        sectionIsDone(graph.track, state, section) ? " is-done" : ""
      );
      link.href = nodeHref(section);
      var number = document.createElement("span");
      number.className = "section-number";
      number.textContent = "S" + String(index + 1).padStart(2, "0");
      var status = document.createElement("i");
      status.className = "section-status";
      var copy = document.createElement("span");
      copy.textContent = section.title;
      link.appendChild(number);
      link.appendChild(status);
      link.appendChild(copy);
      list.appendChild(link);
    });
  }

  function renderLegend(graph, selectedId, selectChapter) {
    var legend = byId("constellationLegend");
    if (!legend) return;
    var selected = indexNodes(graph)[selectedId];
    legend.replaceChildren();
    graph.domains.forEach(function (domain, index) {
      var button = document.createElement("button");
      button.className = "legend-button";
      button.type = "button";
      button.style.color = COLORS[index % COLORS.length];
      button.setAttribute(
        "aria-pressed",
        selected && selected.parent === domain.id ? "true" : "false"
      );
      var dot = document.createElement("i");
      dot.className = "legend-dot";
      button.appendChild(dot);
      button.appendChild(document.createTextNode(domain.title));
      button.addEventListener("click", function () {
        if (domain.chapterIds.length) selectChapter(domain.chapterIds[0]);
      });
      legend.appendChild(button);
    });
  }

  function renderMobileChapterGraph(graph, chapter, state) {
    var wrapper = document.createElement("span");
    wrapper.className = "mobile-mini-graph";
    sectionsFor(graph, chapter.id).slice(0, 7).forEach(function (section) {
      var dot = document.createElement("i");
      if (sectionIsDone(graph.track, state, section)) dot.className = "is-done";
      wrapper.appendChild(dot);
    });
    return wrapper;
  }

  function renderMobileDomains(graph, state, selectedId, selectChapter) {
    var mobile = byId("constellationMobile");
    if (!mobile) return;
    mobile.replaceChildren();
    graph.domains.forEach(function (domain, domainIndex) {
      var details = document.createElement("details");
      details.className = "mobile-domain";
      details.style.setProperty(
        "--domain-color",
        COLORS[domainIndex % COLORS.length]
      );
      details.open = domain.chapterIds.indexOf(selectedId) !== -1;
      var summary = document.createElement("summary");
      var dot = document.createElement("i");
      dot.className = "mobile-domain-dot";
      var title = document.createElement("span");
      title.className = "mobile-domain-title";
      title.textContent = domain.title;
      var count = document.createElement("span");
      count.className = "mobile-domain-count";
      count.textContent = domain.chapterIds.length + " 章";
      summary.appendChild(dot);
      summary.appendChild(title);
      summary.appendChild(count);
      details.appendChild(summary);

      var chapters = document.createElement("div");
      chapters.className = "mobile-chapters";
      domain.chapterIds.forEach(function (chapterId) {
        var chapter = indexNodes(graph)[chapterId];
        var row = document.createElement("div");
        row.className = "mobile-chapter";
        var button = document.createElement("button");
        button.className = "mobile-chapter-button";
        button.type = "button";
        button.setAttribute("aria-expanded", "false");
        button.appendChild(renderMobileChapterGraph(graph, chapter, state));
        var chapterTitle = document.createElement("span");
        chapterTitle.textContent = chapter.title;
        var chapterCount = document.createElement("span");
        chapterCount.className = "mobile-chapter-count";
        chapterCount.textContent = sectionsFor(graph, chapter.id).length + " 节";
        button.appendChild(chapterTitle);
        button.appendChild(chapterCount);
        var sectionList = document.createElement("div");
        sectionList.className = "mobile-section-list";
        sectionList.hidden = true;
        var chapterLink = document.createElement("a");
        chapterLink.className = "mobile-section-link";
        chapterLink.href = nodeHref(chapter);
        chapterLink.textContent = "章节首页 · " + chapter.title;
        sectionList.appendChild(chapterLink);
        sectionsFor(graph, chapter.id).forEach(function (section) {
          var link = document.createElement("a");
          link.className = "mobile-section-link";
          link.href = nodeHref(section);
          link.textContent = section.title;
          sectionList.appendChild(link);
        });
        button.addEventListener("click", function () {
          var opening = sectionList.hidden;
          chapters.querySelectorAll(".mobile-section-list").forEach(function (item) {
            item.hidden = true;
          });
          chapters.querySelectorAll(".mobile-chapter-button").forEach(function (item) {
            item.setAttribute("aria-expanded", "false");
          });
          sectionList.hidden = !opening;
          button.setAttribute("aria-expanded", opening ? "true" : "false");
          if (opening) selectChapter(chapter.id, true);
        });
        row.appendChild(button);
        row.appendChild(sectionList);
        chapters.appendChild(row);
      });
      details.appendChild(chapters);
      mobile.appendChild(details);
    });
  }

  function updateProgress(track, state) {
    var count = byId("starmapProgressCount");
    var fill = byId("starmapProgressFill");
    var text = byId("starmapProgressText");
    var complete = Math.min(state.complete, state.total);
    if (count) count.textContent = complete + "/" + state.total;
    if (fill) fill.style.width = (
      state.total ? Math.round(complete / state.total * 100) : 0
    ) + "%";
    if (text) {
      text.textContent = track === "advanced"
        ? "进阶完整版独立进度"
        : "精炼版独立进度";
    }
  }

  function redirectLegacyHash(anchorRoutes) {
    if (!window.location.hash || window.location.hash.length < 2) return false;
    var target = decodeURIComponent(window.location.hash.slice(1));
    var route = anchorRoutes[target];
    if (!route) return false;
    var suffix = /^part\d+$/.test(target) ? "" : "#" + encodeURIComponent(target);
    window.location.replace("./" + route + "/" + suffix);
    return true;
  }

  function init() {
    var dataNode = byId("starmapData");
    if (!dataNode) return;
    var data;
    try {
      data = JSON.parse(dataNode.textContent);
    } catch (_) {
      return;
    }
    if (redirectLegacyHash(data.anchorRoutes || {})) return;

    var track = readStringStorage(TRACK_KEY, data.defaultTrack || "concise");
    if (!data.tracks[track]) track = "concise";
    var selectedId = null;
    var viewport = { scale: 1, x: 0, y: 0 };

    function graph() {
      var value = data.tracks[track];
      value.track = track;
      return value;
    }

    function selectChapter(chapterId, mobileOnly) {
      selectedId = chapterId;
      var currentGraph = graph();
      var state = progressState(track, currentGraph);
      var chapter = indexNodes(currentGraph)[selectedId];
      if (!chapter) return;
      renderChapterSubgraph(currentGraph, chapter, state);
      renderLegend(currentGraph, selectedId, selectChapter);
      if (!mobileOnly) {
        renderDesktopGraph(
          currentGraph,
          state,
          selectedId,
          selectChapter,
          viewport
        );
      }
      var status = byId("graphStatus");
      if (status) {
        status.textContent = "当前视图：" + (
          track === "advanced" ? "进阶完整版" : "精炼版"
        ) + " · 已聚焦 " + chapter.title;
      }
    }

    function renderTrack() {
      var currentGraph = graph();
      var state = progressState(track, currentGraph);
      var chapters = chapterNodes(currentGraph);
      selectedId = chapters.some(function (chapter) {
        return chapter.id === state.currentChapter;
      }) ? state.currentChapter : chapters[0].id;
      viewport = { scale: 1, x: 0, y: 0 };
      document.querySelectorAll("[data-track]").forEach(function (button) {
        if (button.tagName !== "BUTTON") return;
        button.setAttribute(
          "aria-pressed",
          button.dataset.track === track ? "true" : "false"
        );
      });
      renderDesktopGraph(
        currentGraph,
        state,
        selectedId,
        selectChapter,
        viewport
      );
      renderChapterSubgraph(
        currentGraph,
        indexNodes(currentGraph)[selectedId],
        state
      );
      renderLegend(currentGraph, selectedId, selectChapter);
      renderMobileDomains(currentGraph, state, selectedId, selectChapter);
      updateProgress(track, state);
      var status = byId("graphStatus");
      if (status) {
        status.textContent = "当前视图：" + (
          track === "advanced" ? "进阶完整版全局图" : "精炼版全局图"
        );
      }
    }

    document.querySelectorAll("#trackSwitcher [data-track]").forEach(function (button) {
      button.addEventListener("click", function () {
        track = button.dataset.track;
        writeStringStorage(TRACK_KEY, track);
        renderTrack();
      });
    });

    function updateZoom(delta) {
      viewport.scale = Math.max(0.65, Math.min(2.4, viewport.scale + delta));
      var state = progressState(track, graph());
      renderDesktopGraph(graph(), state, selectedId, selectChapter, viewport);
    }
    var zoomIn = byId("graphZoomIn");
    var zoomOut = byId("graphZoomOut");
    var reset = byId("graphReset");
    if (zoomIn) zoomIn.addEventListener("click", function () { updateZoom(0.18); });
    if (zoomOut) zoomOut.addEventListener("click", function () { updateZoom(-0.18); });
    if (reset) reset.addEventListener("click", function () {
      viewport = { scale: 1, x: 0, y: 0 };
      renderDesktopGraph(
        graph(),
        progressState(track, graph()),
        selectedId,
        selectChapter,
        viewport
      );
    });

    renderTrack();
    document.documentElement.classList.add("starmap-enhanced");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}());
