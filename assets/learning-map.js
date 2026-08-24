(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var COLORS = ["#6fd3c8", "#5aa7e6", "#e0a63a", "#e78a7f", "#b28ad6", "#7ad6a0"];
  var LAYOUTS = [
    { center: [155, 130], points: [[-52, -25], [2, 32], [62, -22]] },
    { center: [465, 100], points: [[-82, 0], [-24, 42], [38, -14], [102, 28]] },
    { center: [775, 160], points: [[-72, -42], [-16, -7], [42, -38], [76, 28], [12, 57]] },
    { center: [790, 430], points: [[-54, -22], [22, 19], [76, -28]] },
    {
      center: [470, 430],
      points: [
        [-155, -35], [-108, 28], [-54, -17], [0, 34], [51, -28],
        [105, 22], [150, -22], [78, 64], [-23, 69],
      ],
    },
    { center: [150, 430], points: [[-48, -38], [20, -12], [60, 34], [-12, 51]] },
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

  function readJson(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function readCurrent(validIds) {
    try {
      var saved = localStorage.getItem("ah-last-chapter");
      return validIds.indexOf(saved) !== -1 ? saved : validIds[0];
    } catch (_) {
      return validIds[0];
    }
  }

  function stateClass(entry, readState, currentId) {
    if (entry.id === currentId) return "is-current";
    if (readState[entry.id]) return "is-done";
    return "is-pending";
  }

  function renderBackground(svg) {
    var random = 1729;
    for (var index = 0; index < 110; index += 1) {
      random = (random * 48271) % 2147483647;
      var x = 14 + (random % 912);
      random = (random * 48271) % 2147483647;
      var y = 10 + (random % 580);
      random = (random * 48271) % 2147483647;
      var radius = 0.5 + (random % 13) / 10;
      svg.appendChild(createSvg("circle", {
        class: "background-star",
        cx: x,
        cy: y,
        r: radius,
        fill: "#d9edf4",
        opacity: 0.12 + (random % 30) / 100,
        "aria-hidden": "true",
      }));
    }
  }

  function absolutePoints(groupIndex, count) {
    var layout = LAYOUTS[groupIndex];
    return layout.points.slice(0, count).map(function (point) {
      return {
        x: layout.center[0] + point[0],
        y: layout.center[1] + point[1],
      };
    });
  }

  function setFocus(groupId) {
    document.querySelectorAll(".constellation-group").forEach(function (group) {
      group.classList.toggle("is-muted", group.dataset.groupId !== groupId);
    });
  }

  function clearFocus() {
    document.querySelectorAll(".constellation-group").forEach(function (group) {
      group.classList.remove("is-muted");
    });
  }

  function renderDesktop(groups, readState, currentId, selectGroup) {
    var svg = byId("constellationCanvas");
    if (!svg) return;
    svg.replaceChildren();
    renderBackground(svg);

    groups.forEach(function (group, groupIndex) {
      var color = COLORS[groupIndex];
      var layout = LAYOUTS[groupIndex];
      var points = absolutePoints(groupIndex, group.entries.length);
      var wrapper = createSvg("g", {
        class: "constellation-group",
        "data-group-id": group.id,
      });

      points.slice(1).forEach(function (point, pointIndex) {
        var previous = points[pointIndex];
        wrapper.appendChild(createSvg("line", {
          class: "constellation-line",
          x1: previous.x,
          y1: previous.y,
          x2: point.x,
          y2: point.y,
          stroke: color,
        }));
      });

      group.entries.forEach(function (entry, entryIndex) {
        var point = points[entryIndex];
        var state = stateClass(entry, readState, currentId);
        var link = createSvg("a", {
          class: "star-link " + state,
          href: entry.href,
          "aria-label": entry.number + " " + entry.title,
        });
        link.style.color = color;
        link.appendChild(createSvg("circle", {
          class: "star-target",
          cx: point.x,
          cy: point.y,
          r: 22,
        }));
        if (state === "is-current") {
          link.appendChild(createSvg("circle", {
            class: "star-current-ring",
            cx: point.x,
            cy: point.y,
            r: 15,
          }));
        }
        link.appendChild(createSvg("circle", {
          class: "star-core",
          cx: point.x,
          cy: point.y,
          r: state === "is-pending" ? 6 : 9,
          fill: state === "is-current" ? "#e0a63a" : (
            state === "is-done" ? color : "transparent"
          ),
          stroke: state === "is-current" ? "#e0a63a" : (
            state === "is-done" ? color : "#4e6074"
          ),
        }));
        if (state !== "is-pending") {
          link.appendChild(createSvg("circle", {
            cx: point.x,
            cy: point.y,
            r: 2.4,
            fill: "#ffffff",
            opacity: 0.92,
            "aria-hidden": "true",
          }));
        }
        wrapper.appendChild(link);
      });

      var top = Math.min.apply(null, points.map(function (point) { return point.y; }));
      var label = createSvg("text", {
        class: "constellation-name",
        x: layout.center[0],
        y: top - 22,
        "text-anchor": "middle",
      });
      label.textContent = group.title;
      wrapper.appendChild(label);

      var meta = createSvg("text", {
        class: "constellation-meta",
        x: layout.center[0],
        y: top - 8,
        "text-anchor": "middle",
      });
      meta.textContent = group.subtitle + " · " + group.entries.length;
      wrapper.appendChild(meta);

      wrapper.addEventListener("mouseenter", function () {
        setFocus(group.id);
        selectGroup(group.id);
      });
      wrapper.addEventListener("focusin", function () {
        setFocus(group.id);
        selectGroup(group.id);
      });
      wrapper.addEventListener("mouseleave", clearFocus);
      wrapper.addEventListener("focusout", function (event) {
        if (!wrapper.contains(event.relatedTarget)) clearFocus();
      });
      svg.appendChild(wrapper);
    });
  }

  function renderTrack(group, readState, currentId) {
    var track = byId("constellationTrack");
    if (!track || !group) return;
    var color = group.color;
    track.replaceChildren();

    var eyebrow = document.createElement("p");
    eyebrow.className = "track-eyebrow";
    eyebrow.textContent = "Star track · 星轨";
    track.appendChild(eyebrow);

    var heading = document.createElement("h2");
    heading.className = "track-title";
    var pip = document.createElement("span");
    pip.className = "track-pip";
    pip.style.color = color;
    heading.appendChild(pip);
    heading.appendChild(document.createTextNode(group.title));
    track.appendChild(heading);

    var complete = group.entries.filter(function (entry) {
      return Boolean(readState[entry.id]);
    }).length;
    var meta = document.createElement("p");
    meta.className = "track-meta";
    meta.textContent = group.subtitle + " · 已点亮 " + complete + "/" +
      group.entries.length + " 颗星";
    track.appendChild(meta);

    var list = document.createElement("div");
    list.className = "track-list";
    group.entries.forEach(function (entry) {
      var link = document.createElement("a");
      link.className = "track-link " + stateClass(entry, readState, currentId);
      link.href = entry.href;
      link.style.color = group.color;

      var number = document.createElement("span");
      number.className = "track-number";
      number.textContent = entry.number;
      link.appendChild(number);

      var star = document.createElement("span");
      star.className = "track-star";
      link.appendChild(star);

      var copy = document.createElement("span");
      copy.className = "track-copy";
      copy.textContent = entry.title;
      var status = document.createElement("small");
      status.textContent = entry.id === currentId
        ? "你在这里 · 继续"
        : (readState[entry.id] ? "已点亮" : "尚未阅读");
      copy.appendChild(status);
      link.appendChild(copy);
      list.appendChild(link);
    });
    track.appendChild(list);
  }

  function renderLegend(groups, onSelect) {
    var legend = byId("constellationLegend");
    if (!legend) return;
    groups.forEach(function (group) {
      var button = document.createElement("button");
      button.className = "legend-button";
      button.type = "button";
      button.dataset.groupId = group.id;
      button.style.color = group.color;
      button.setAttribute("aria-pressed", "false");
      var dot = document.createElement("span");
      dot.className = "legend-dot";
      button.appendChild(dot);
      button.appendChild(document.createTextNode(group.title));
      button.addEventListener("mouseenter", function () { setFocus(group.id); });
      button.addEventListener("mouseleave", clearFocus);
      button.addEventListener("focus", function () { setFocus(group.id); });
      button.addEventListener("blur", clearFocus);
      button.addEventListener("click", function () { onSelect(group.id); });
      legend.appendChild(button);
    });
  }

  function renderMobile(groups, readState, currentId) {
    var mobile = byId("constellationMobile");
    if (!mobile) return;
    groups.forEach(function (group) {
      var details = document.createElement("details");
      details.className = "mobile-group";
      details.style.setProperty("--group-color", group.color);
      details.open = group.entries.some(function (entry) {
        return entry.id === currentId;
      });

      var summary = document.createElement("summary");
      var groupStar = document.createElement("span");
      groupStar.className = "mobile-group-star";
      summary.appendChild(groupStar);
      var title = document.createElement("span");
      title.className = "mobile-group-title";
      title.textContent = group.title;
      summary.appendChild(title);
      var count = document.createElement("span");
      count.className = "mobile-group-count";
      count.textContent = group.entries.filter(function (entry) {
        return Boolean(readState[entry.id]);
      }).length + "/" + group.entries.length;
      summary.appendChild(count);
      details.appendChild(summary);

      var links = document.createElement("div");
      links.className = "mobile-links";
      group.entries.forEach(function (entry) {
        var link = document.createElement("a");
        link.className = "mobile-entry " + stateClass(entry, readState, currentId);
        link.href = entry.href;
        var number = document.createElement("span");
        number.className = "mobile-entry-number";
        number.textContent = entry.number;
        var star = document.createElement("span");
        star.className = "mobile-entry-star";
        var text = document.createElement("span");
        text.textContent = entry.title;
        link.appendChild(number);
        link.appendChild(star);
        link.appendChild(text);
        links.appendChild(link);
      });
      details.appendChild(links);
      mobile.appendChild(details);
    });
  }

  function updateProgress(entries, readState) {
    var complete = entries.filter(function (entry) {
      return Boolean(readState[entry.id]);
    }).length;
    var count = byId("starmapProgressCount");
    var fill = byId("starmapProgressFill");
    var text = byId("starmapProgressText");
    if (count) count.textContent = complete + "/" + entries.length;
    if (fill) fill.style.width = (
      entries.length ? Math.round(complete / entries.length * 100) : 0
    ) + "%";
    if (text) {
      text.textContent = complete
        ? "已点亮 " + complete + " 颗星"
        : "开始点亮你的学习星图";
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

    var groups = data.groups || [];
    groups.forEach(function (group, index) {
      group.color = COLORS[index % COLORS.length];
    });
    var entries = groups.reduce(function (all, group) {
      return all.concat(group.entries);
    }, []);
    var validIds = entries.map(function (entry) { return entry.id; });
    var readState = readJson("ah-read-chapters", {});
    var currentId = readCurrent(validIds);
    var selectedId = (groups.find(function (group) {
      return group.entries.some(function (entry) { return entry.id === currentId; });
    }) || groups[0] || {}).id;

    function selectGroup(groupId) {
      selectedId = groupId;
      groups.forEach(function (group) {
        renderTrack(group.id === selectedId ? group : null, readState, currentId);
      });
      document.querySelectorAll(".legend-button").forEach(function (button) {
        button.setAttribute(
          "aria-pressed",
          button.dataset.groupId === selectedId ? "true" : "false"
        );
      });
    }

    renderDesktop(groups, readState, currentId, selectGroup);
    renderLegend(groups, function (groupId) {
      setFocus(groupId);
      selectGroup(groupId);
    });
    renderMobile(groups, readState, currentId);
    updateProgress(entries, readState);
    selectGroup(selectedId);
    document.documentElement.classList.add("starmap-enhanced");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}());
