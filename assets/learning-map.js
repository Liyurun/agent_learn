(function () {
  "use strict";

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
    "#ff986c",
  ];
  var SHELL_CAPACITIES = [2, 8, 18, 32];
  var SHELL_NAMES = ["K", "L", "M", "N"];

  function byId(id) {
    return document.getElementById(id);
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

  function domainColor(graph, domainId) {
    var index = graph.domains.findIndex(function (domain) {
      return domain.id === domainId;
    });
    return COLORS[(index < 0 ? 0 : index) % COLORS.length];
  }

  function rgba(hex, alpha) {
    var red = parseInt(hex.slice(1, 3), 16);
    var green = parseInt(hex.slice(3, 5), 16);
    var blue = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + red + "," + green + "," + blue + "," + alpha + ")";
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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

  function crossTrackNodes(data, track, chapterId) {
    var otherTrack = track === "concise" ? "advanced" : "concise";
    var otherNodes = indexNodes(data.tracks[otherTrack]);
    return (data.crossEdges || []).reduce(function (related, edge) {
      var targetId = track === "concise"
        ? (edge.source === chapterId ? edge.target : null)
        : (edge.target === chapterId ? edge.source : null);
      if (targetId && otherNodes[targetId]) related.push(otherNodes[targetId]);
      return related;
    }, []);
  }

  function shellState(index, total) {
    var start = 0;
    for (var shell = 0; shell < SHELL_CAPACITIES.length; shell += 1) {
      var capacity = SHELL_CAPACITIES[shell];
      if (index < start + capacity) {
        return {
          shell: shell,
          n: shell + 1,
          name: SHELL_NAMES[shell] || ("N" + (shell + 1)),
          local: index - start,
          capacity: capacity,
          used: Math.min(capacity, Math.max(0, total - start)),
          orbital: orbitalName(shell, index - start),
        };
      }
      start += capacity;
    }
    return {
      shell: 3,
      n: 4,
      name: "N",
      local: index - start,
      capacity: 32,
      used: Math.max(0, total - start),
      orbital: "4f",
    };
  }

  function orbitalName(shell, local) {
    if (shell === 0) return "1s";
    if (shell === 1) return local < 2 ? "2s" : "2p";
    if (shell === 2) return local < 2 ? "3s" : (local < 8 ? "3p" : "3d");
    return local < 2 ? "4s" : (local < 8 ? "4p" : (local < 18 ? "4d" : "4f"));
  }

  function shellSpeed(state) {
    return (state.shell % 2 ? -1 : 1) *
      (0.00076 / (state.n * state.n)) *
      (1 + state.local * 0.018);
  }

  function shellSpin(shell) {
    return (shell % 2 ? -1 : 1) * (0.00012 / (shell + 1));
  }

  function shellRadii(shell, compact) {
    return {
      rx: (compact ? 18 : 58) + shell * (compact ? 15 : 27),
      ry: (compact ? 7 : 22) + shell * (compact ? 6 : 11),
    };
  }

  function shellPoint(theta, shell, rx, ry) {
    if (shell === 1) {
      return {
        x: Math.sin(theta) * rx,
        y: Math.sin(theta * 2) * ry * 0.82,
      };
    }
    if (shell === 2) {
      var fold = 1 + 0.16 * Math.cos(theta * 4);
      return {
        x: Math.cos(theta) * rx * fold,
        y: Math.sin(theta) * ry * fold,
      };
    }
    return {
      x: Math.cos(theta) * rx,
      y: Math.sin(theta) * ry,
    };
  }

  function focusGroups(sections) {
    var count = Math.min(4, Math.max(1, Math.ceil(sections.length / 4)));
    var size = Math.ceil(sections.length / count);
    var groups = [];
    for (var index = 0; index < count; index += 1) groups.push([]);
    sections.forEach(function (section, index) {
      groups[Math.min(count - 1, Math.floor(index / size))].push(section);
    });
    return groups;
  }

  function focusPlacement(sections) {
    var groups = focusGroups(sections);
    var map = {};
    groups.forEach(function (group, groupIndex) {
      group.forEach(function (section, localIndex) {
        map[sections.indexOf(section)] = {
          group: groupIndex,
          state: shellState(localIndex, group.length),
        };
      });
    });
    return map;
  }

  function createStarmapRenderer(data, track, getState, selectChapter) {
    var canvas = byId("globalKnowledgeGraph");
    var tooltip = byId("graphTooltip");
    if (!canvas || !canvas.getContext) return null;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = 1;
    var height = 1;
    var time = 0;
    var last = 0;
    var stars = [];
    var hits = [];
    var drag = null;
    var dragMoved = false;
    var hoverId = null;
    var selectedPoint = null;
    var mode = "global";
    var activeChapterId = null;
    var camera = defaultCamera();

    function defaultCamera() {
      return {
        scale: 1,
        x: 0,
        y: 0,
        rotX: -0.38,
        rotY: 0.32,
        depth: 940,
      };
    }

    function graph() {
      var current = data.tracks[track.value];
      current.track = track.value;
      return current;
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!stars.length) {
        var random = 1729;
        for (var index = 0; index < 150; index += 1) {
          random = random * 48271 % 2147483647;
          stars.push({
            x: (random % 1000) / 1000,
            y: ((random * 31) % 1000) / 1000,
            r: 0.25 + (random % 9) / 10,
            a: 0.06 + (random % 24) / 100,
          });
        }
      }
    }

    function project(point, zOverride) {
      var ox = point.x - width / 2;
      var oy = point.y - height / 2;
      var oz = zOverride === undefined ? (point.z || 0) : zOverride;
      var cy = Math.cos(camera.rotY);
      var sy = Math.sin(camera.rotY);
      var cx = Math.cos(camera.rotX);
      var sx = Math.sin(camera.rotX);
      var x1 = ox * cy + oz * sy;
      var z1 = oz * cy - ox * sy;
      var y1 = oy * cx - z1 * sx;
      var z2 = oy * sx + z1 * cx;
      var perspective = camera.depth / (camera.depth + z2);
      return {
        x: width / 2 + camera.x + x1 * perspective * camera.scale,
        y: height / 2 + camera.y + y1 * perspective * camera.scale,
        scale: perspective * camera.scale,
        z: z2,
      };
    }

    function glow(x, y, radius, color, alpha) {
      var gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, rgba(color, alpha));
      gradient.addColorStop(0.42, rgba(color, alpha * 0.32));
      gradient.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawBackground() {
      var gradient = ctx.createRadialGradient(
        width * 0.5,
        height * 0.42,
        0,
        width * 0.5,
        height * 0.42,
        width * 0.78
      );
      gradient.addColorStop(0, "#0d1b2b");
      gradient.addColorStop(1, "#071019");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      stars.forEach(function (star, index) {
        ctx.fillStyle = "rgba(150,201,222," +
          (star.a * (0.7 + 0.3 * Math.sin(time * 0.001 + index))) + ")";
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function chapterLayout(currentGraph) {
      var list = chapterNodes(currentGraph);
      var columns = 6;
      var rows = Math.ceil(list.length / columns);
      var positions = {};
      list.forEach(function (chapter, index) {
        var row = Math.floor(index / columns);
        var column = index % columns;
        if (row % 2) column = columns - 1 - column;
        positions[chapter.id] = {
          x: 90 + column * ((width - 180) / Math.max(1, columns - 1)),
          y: 88 + row * ((height - 185) / Math.max(1, rows - 1)),
          z: (row - (rows - 1) / 2) * 42 + Math.sin(index * 0.9) * 36,
        };
      });
      return positions;
    }

    function orbitTilt(seed, shell) {
      return seed * 0.47 + shell * 0.86 + time * shellSpin(shell);
    }

    function drawShellOrbit(cx, cy, shell, scale, tilt, color, alpha, compact) {
      var radii = shellRadii(shell, compact);
      var rx = radii.rx * scale;
      var ry = radii.ry * scale;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = compact ? 0.85 : 1.15;
      ctx.beginPath();
      for (var index = 0; index <= 96; index += 1) {
        var p = shellPoint(index / 96 * Math.PI * 2, shell, rx, ry);
        if (index === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    function drawKnowledgePoint(x, y, radius, color, active, label) {
      glow(x, y, active ? radius * 5 : radius * 3.4, color, active ? 0.72 : 0.34);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = color;
      ctx.strokeStyle = active ? "#fff" : "rgba(255,255,255,.72)";
      ctx.lineWidth = active ? 1.8 : 1;
      ctx.beginPath();
      ctx.rect(-radius, -radius, radius * 2, radius * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      if (label) {
        ctx.fillStyle = active ? "#fff" : "#cfe3ee";
        ctx.font = "700 8px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.fillText(label, x, y - radius - 6);
      }
    }

    function drawGlobal(currentGraph, state) {
      var positions = chapterLayout(currentGraph);
      var nodes = indexNodes(currentGraph);
      hits = [];
      currentGraph.edges.forEach(function (edge, edgeIndex) {
        var source = nodes[edge.source];
        var target = nodes[edge.target];
        if (!source || !target || source.kind !== "chapter" ||
            target.kind !== "chapter") return;
        var start = project(positions[source.id]);
        var end = project(positions[target.id]);
        ctx.strokeStyle = edge.type === "sequence"
          ? "rgba(69,96,121,.58)"
          : "rgba(120,135,154,.34)";
        ctx.lineWidth = edge.type === "sequence" ? 1.8 : 1;
        ctx.setLineDash(edge.type === "sequence" ? [] : [5, 7]);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        var progress = (time * 0.00008 + edgeIndex * 0.17) % 1;
        glow(
          start.x + (end.x - start.x) * progress,
          start.y + (end.y - start.y) * progress,
          8 * end.scale,
          domainColor(currentGraph, target.parent),
          0.3
        );
      });
      ctx.setLineDash([]);

      chapterNodes(currentGraph)
        .map(function (chapter, index) {
          var projected = project(positions[chapter.id]);
          return { chapter: chapter, index: index, projected: projected };
        })
        .sort(function (left, right) { return left.projected.z - right.projected.z; })
        .forEach(function (entry) {
          var chapter = entry.chapter;
          var p = entry.projected;
          var sections = sectionsFor(currentGraph, chapter.id);
          var color = domainColor(currentGraph, chapter.parent);
          var hover = hoverId === chapter.id;
          var active = state.currentChapter === chapter.id;
          var scale = p.scale * (hover ? 1.22 : 1);
          var maxShell = sections.length
            ? shellState(sections.length - 1, sections.length).shell
            : 0;
          ctx.save();
          ctx.globalAlpha = hoverId && !hover ? 0.42 : 1;
          for (var shell = 0; shell <= maxShell; shell += 1) {
            drawShellOrbit(
              p.x,
              p.y,
              shell,
              scale,
              orbitTilt(entry.index, shell),
              shell === 1
                ? COLORS[(currentGraph.domains.findIndex(function (domain) {
                    return domain.id === chapter.parent;
                  }) + 2) % COLORS.length]
                : color,
              shell === 0 ? 0.58 : 0.34,
              true
            );
          }
          sections.forEach(function (section, sectionIndex) {
            var shell = shellState(sectionIndex, sections.length);
            var radii = shellRadii(shell.shell, true);
            var angle = orbitTilt(entry.index, shell.shell);
            var theta = shell.local / shell.capacity * Math.PI * 2 +
              time * shellSpeed(shell) + entry.index * 0.11;
            var local = shellPoint(theta, shell.shell, radii.rx * scale, radii.ry * scale);
            var x = p.x + local.x * Math.cos(angle) - local.y * Math.sin(angle);
            var y = p.y + local.x * Math.sin(angle) + local.y * Math.cos(angle);
            drawKnowledgePoint(
              x,
              y,
              hover ? 3.2 : 2.25,
              COLORS[(sectionIndex + currentGraph.domains.findIndex(function (domain) {
                return domain.id === chapter.parent;
              })) % COLORS.length],
              active && sectionIndex === 0,
              hover ? "S" + String(sectionIndex + 1).padStart(2, "0") : ""
            );
          });
          glow(p.x, p.y, hover ? 24 : 17, color, hover ? 0.65 : 0.38);
          ctx.fillStyle = active ? "#e0a63a" : color;
          ctx.strokeStyle = "#eaffff";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, hover ? 7 : 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = hover ? "#fff" : "#8fa3b5";
          ctx.font = (hover ? "700 " : "500 ") +
            Math.max(8, (hover ? 11 : 9) * p.scale) + "px PingFang SC";
          ctx.textAlign = "center";
          ctx.fillText(
            chapter.id.replace(/^advanced-/, "").toUpperCase() + " · " +
              chapter.title.replace(/^第\s*\d+\s*章\s*[·：:]?\s*/, "").slice(0, hover ? 16 : 11),
            p.x,
            p.y + 35 * scale
          );
          ctx.restore();
          hits.push({
            type: "chapter",
            id: chapter.id,
            node: chapter,
            x: p.x,
            y: p.y,
            r: 34 * scale,
          });
        });
    }

    function drawFocus(currentGraph) {
      var chapter = indexNodes(currentGraph)[activeChapterId];
      if (!chapter) {
        mode = "global";
        return;
      }
      var sections = sectionsFor(currentGraph, chapter.id);
      var groups = focusGroups(sections);
      var center = { x: width * 0.5, y: height * 0.5, z: 0 };
      var centerProjected = project(center);
      var base = domainColor(currentGraph, chapter.parent);
      var groupPositions = [];
      hits = [];

      groups.forEach(function (_, index) {
        var angle = -Math.PI / 2 + index * Math.PI * 2 / groups.length;
        groupPositions.push({
          x: center.x + Math.cos(angle) * width * 0.28,
          y: center.y + Math.sin(angle) * height * 0.29,
          z: Math.cos(angle * 2) * 120,
        });
      });
      groupPositions.forEach(function (position, index) {
        var projected = project(position, position.z);
        ctx.strokeStyle = rgba(COLORS[(currentGraph.domains.findIndex(function (domain) {
          return domain.id === chapter.parent;
        }) + index) % COLORS.length], 0.42);
        ctx.lineWidth = 2 * projected.scale;
        ctx.beginPath();
        ctx.moveTo(centerProjected.x, centerProjected.y);
        ctx.lineTo(projected.x, projected.y);
        ctx.stroke();
        var progress = (time * 0.00011 + index * 0.23) % 1;
        glow(
          centerProjected.x + (projected.x - centerProjected.x) * progress,
          centerProjected.y + (projected.y - centerProjected.y) * progress,
          11 * projected.scale,
          COLORS[index % COLORS.length],
          0.45
        );
      });
      glow(centerProjected.x, centerProjected.y, 62 * centerProjected.scale, base, 0.4);
      ctx.fillStyle = "#e0a63a";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerProjected.x, centerProjected.y, 15 * centerProjected.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "700 " + Math.max(12, 15 * centerProjected.scale) + "px PingFang SC";
      ctx.textAlign = "center";
      ctx.fillText(chapter.title, centerProjected.x, centerProjected.y + 42 * centerProjected.scale);

      groups.forEach(function (group, groupIndex) {
        if (!group.length) return;
        var origin = groupPositions[groupIndex];
        var projectedOrigin = project(origin, origin.z);
        var color = COLORS[(currentGraph.domains.findIndex(function (domain) {
          return domain.id === chapter.parent;
        }) + groupIndex) % COLORS.length];
        var maxShell = shellState(group.length - 1, group.length).shell;
        glow(projectedOrigin.x, projectedOrigin.y, 40 * projectedOrigin.scale, color, 0.3);
        ctx.fillStyle = color;
        ctx.strokeStyle = "#fff";
        ctx.beginPath();
        ctx.arc(projectedOrigin.x, projectedOrigin.y, 10 * projectedOrigin.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#dce8ef";
        ctx.font = "600 " + Math.max(9, 11 * projectedOrigin.scale) + "px PingFang SC";
        ctx.textAlign = "center";
        ctx.fillText(group[0].title.slice(0, 8), projectedOrigin.x, projectedOrigin.y + 29 * projectedOrigin.scale);
        for (var shell = 0; shell <= maxShell; shell += 1) {
          drawShellOrbit(
            projectedOrigin.x,
            projectedOrigin.y,
            shell,
            projectedOrigin.scale,
            groupIndex * 0.8 + shellSpin(shell) * time + shell * 0.62,
            COLORS[(currentGraph.domains.findIndex(function (domain) {
              return domain.id === chapter.parent;
            }) + groupIndex + shell) % COLORS.length],
            shell === 0 ? 0.5 : 0.32,
            false
          );
        }
        group.forEach(function (section, localIndex) {
          var sectionIndex = sections.indexOf(section);
          var shell = shellState(localIndex, group.length);
          var radii = shellRadii(shell.shell, false);
          var tilt = groupIndex * 0.8 + shell.shell * 0.62 + shellSpin(shell.shell) * time;
          var theta = shell.local / shell.capacity * Math.PI * 2 +
            time * shellSpeed(shell) + groupIndex * 0.31;
          var local = shellPoint(theta, shell.shell, radii.rx, radii.ry);
          var world = {
            x: origin.x + local.x * Math.cos(tilt) - local.y * Math.sin(tilt),
            y: origin.y + local.x * Math.sin(tilt) + local.y * Math.cos(tilt),
            z: origin.z + Math.sin(theta) * (24 + shell.shell * 12),
          };
          var projected = project(world, world.z);
          var pointColor = COLORS[(sectionIndex + groupIndex) % COLORS.length];
          for (var trail = -5; trail <= 5; trail += 1) {
            var trailTheta = theta + trail * 0.045;
            var weight = Math.exp(-(trail * trail) / 10);
            var trailPoint = shellPoint(trailTheta, shell.shell, radii.rx, radii.ry);
            var trailWorld = {
              x: origin.x + trailPoint.x * Math.cos(tilt) -
                trailPoint.y * Math.sin(tilt),
              y: origin.y + trailPoint.x * Math.sin(tilt) +
                trailPoint.y * Math.cos(tilt),
              z: origin.z + Math.sin(trailTheta) * (24 + shell.shell * 12),
            };
            var trailProjected = project(trailWorld, trailWorld.z);
            ctx.fillStyle = rgba(pointColor, weight * 0.1);
            ctx.beginPath();
            ctx.arc(
              trailProjected.x,
              trailProjected.y,
              Math.max(0.8, (1.1 + weight * 1.8) * trailProjected.scale),
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
          drawKnowledgePoint(
            projected.x,
            projected.y,
            Math.max(3.2, (selectedPoint === sectionIndex ? 6.5 : 5.1) * projected.scale),
            pointColor,
            selectedPoint === sectionIndex,
            "S" + String(sectionIndex + 1).padStart(2, "0")
          );
          hits.push({
            type: "section",
            index: sectionIndex,
            node: section,
            x: projected.x,
            y: projected.y,
            r: 18 * projected.scale,
            color: pointColor,
            state: shell,
            group: groupIndex,
          });
        });
      });
    }

    function renderFrame(now) {
      var elapsed = last ? Math.min(45, now - last) : 16;
      last = now;
      time += elapsed;
      drawBackground();
      var currentGraph = graph();
      if (mode === "focus") drawFocus(currentGraph);
      else drawGlobal(currentGraph, getState());
      window.requestAnimationFrame(renderFrame);
    }

    function pointFromEvent(event) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }

    function hitTest(point) {
      for (var index = hits.length - 1; index >= 0; index -= 1) {
        var hit = hits[index];
        if (Math.hypot(point.x - hit.x, point.y - hit.y) <= hit.r) return hit;
      }
      return null;
    }

    function openChapter(chapterId) {
      activeChapterId = chapterId;
      selectedPoint = null;
      mode = "focus";
      camera = defaultCamera();
      selectChapter(chapterId, "focus");
    }

    function openPoint(hit) {
      selectedPoint = hit.index;
      renderEnergyCard(hit);
      highlightSection(hit.index);
    }

    function renderEnergyCard(hit) {
      var card = byId("chapterEnergyCard");
      if (!card || !hit || !hit.state) return;
      selectedPoint = hit.index;
      highlightSection(hit.index);
      var state = hit.state;
      var energy = (-13.6 / (state.n * state.n)).toFixed(2);
      card.hidden = false;
      card.innerHTML =
        '<p class="panel-eyebrow">KNOWLEDGE LEVEL STATE</p>' +
        "<h3>" + hit.node.title + "</h3>" +
        '<div class="energy-chip-row">' +
        "<span>" + state.name + " 层</span>" +
        "<span>n=" + state.n + "</span>" +
        "<span>" + state.orbital + " 轨道</span>" +
        "<span>" + (state.local + 1) + " / " + state.capacity + "</span>" +
        "</div>" +
        '<table class="energy-table">' +
        "<tr><td>壳层容量</td><td>" + state.capacity + " 个知识点</td></tr>" +
        "<tr><td>轨道能级 Eₙ</td><td>" + energy + " eV</td></tr>" +
        "<tr><td>相对旋转速度</td><td>×" +
        (3 / (state.n * state.n)).toFixed(2) + "</td></tr>" +
        "<tr><td>概率峰值</td><td>|ψ|² " + (72 + hit.index % 21) + "%</td></tr>" +
        "<tr><td>所属主题原子</td><td>G" + (hit.group + 1) + "</td></tr>" +
        "</table>";
    }

    function highlightSection(index) {
      byId("chapterSectionList").querySelectorAll(".chapter-section-link")
        .forEach(function (item) {
          item.classList.toggle("is-active", Number(item.dataset.sectionIndex) === index);
        });
    }

    function showTooltip(point, hit) {
      if (!tooltip || !hit) {
        if (tooltip) tooltip.classList.remove("is-visible");
        return;
      }
      tooltip.innerHTML = "<strong>" + hit.node.title + "</strong>" + (
        hit.type === "chapter"
          ? sectionsFor(graph(), hit.node.id).length + " 个知识点"
          : "点击查看知识点能级与壳层"
      );
      tooltip.style.left = point.x + "px";
      tooltip.style.top = point.y + "px";
      tooltip.classList.add("is-visible");
    }

    canvas.addEventListener("pointerdown", function (event) {
      var point = pointFromEvent(event);
      drag = {
        point: point,
        rotX: camera.rotX,
        rotY: camera.rotY,
        x: camera.x,
        y: camera.y,
      };
      dragMoved = false;
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", function (event) {
      var point = pointFromEvent(event);
      if (drag) {
        var dx = point.x - drag.point.x;
        var dy = point.y - drag.point.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
        if (event.shiftKey) {
          camera.x = drag.x + dx;
          camera.y = drag.y + dy;
        } else {
          camera.rotY = drag.rotY + dx * 0.006;
          camera.rotX = clamp(drag.rotX + dy * 0.005, -1.1, 1.1);
        }
      }
      var hit = hitTest(point);
      hoverId = hit && hit.type === "chapter" ? hit.id : null;
      showTooltip(point, hit);
    });

    canvas.addEventListener("pointerup", function (event) {
      if (!drag) return;
      var hit = hitTest(pointFromEvent(event));
      if (!dragMoved && hit) {
        if (hit.type === "chapter") openChapter(hit.id);
        else openPoint(hit);
      }
      drag = null;
    });

    canvas.addEventListener("pointerleave", function () {
      drag = null;
      hoverId = null;
      if (tooltip) tooltip.classList.remove("is-visible");
    });

    canvas.addEventListener("wheel", function (event) {
      event.preventDefault();
      camera.scale = clamp(camera.scale - event.deltaY * 0.001, 0.58, 2.55);
    }, { passive: false });

    canvas.addEventListener("dblclick", function () {
      camera = defaultCamera();
    });

    window.addEventListener("resize", resize);
    resize();
    window.requestAnimationFrame(renderFrame);

    return {
      focusChapter: openChapter,
      resetForTrack: function () {
        mode = "global";
        selectedPoint = null;
        activeChapterId = null;
        camera = defaultCamera();
      },
      showGlobal: function () {
        mode = "global";
        selectedPoint = null;
        activeChapterId = null;
        camera = defaultCamera();
      },
      renderEnergyCard: renderEnergyCard,
    };
  }

  function renderLegend(graph, selectedId, openChapter) {
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
        if (domain.chapterIds.length) openChapter(domain.chapterIds[0]);
      });
      legend.appendChild(button);
    });
  }

  function renderSideOverview(graph, track, openChapter) {
    var title = byId("chapterGraphTitle");
    var meta = byId("chapterGraphMeta");
    var list = byId("chapterSectionList");
    var enter = byId("chapterEnterLink");
    var card = byId("chapterEnergyCard");
    if (!title || !meta || !list || !enter || !card) return;
    var chapters = chapterNodes(graph);
    title.textContent = track === "advanced" ? "进阶完整版图谱" : "精炼版知识图谱";
    meta.textContent = chapters.length +
      " 个章节分子连接成完整学习路径。拖动画布旋转三维视角。";
    card.hidden = true;
    card.replaceChildren();
    enter.hidden = true;
    list.replaceChildren();
    chapters.forEach(function (chapter) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "chapter-section-link";
      button.dataset.chapterId = chapter.id;
      button.style.color = domainColor(graph, chapter.parent);
      var number = document.createElement("span");
      number.className = "section-number";
      number.textContent = chapter.id.replace(/^advanced-/, "").toUpperCase();
      var status = document.createElement("i");
      status.className = "section-status";
      var copy = document.createElement("span");
      copy.textContent = chapter.title;
      var count = document.createElement("span");
      count.className = "section-number";
      count.textContent = sectionsFor(graph, chapter.id).length + " 点";
      button.appendChild(number);
      button.appendChild(status);
      button.appendChild(copy);
      button.appendChild(count);
      button.addEventListener("click", function () { openChapter(chapter.id); });
      list.appendChild(button);
    });
  }

  function renderSideFocus(data, graph, track, chapterId) {
    var chapter = indexNodes(graph)[chapterId];
    var title = byId("chapterGraphTitle");
    var meta = byId("chapterGraphMeta");
    var list = byId("chapterSectionList");
    var enter = byId("chapterEnterLink");
    var card = byId("chapterEnergyCard");
    if (!chapter || !title || !meta || !list || !enter || !card) return;
    var sections = sectionsFor(graph, chapter.id);
    var groups = focusGroups(sections);
    var placements = focusPlacement(sections);
    var related = crossTrackNodes(data, track, chapter.id);
    title.textContent = chapter.title;
    meta.textContent = "知识点按 K/L/M 壳层排布：每个主题原子的 K 层最多 2 个，L 层最多 8 个，M 层承接剩余。";
    card.hidden = true;
    card.replaceChildren();
    enter.hidden = false;
    enter.href = nodeHref(chapter);
    enter.textContent = "进入章节";
    list.replaceChildren();
    sections.forEach(function (section, index) {
      var placement = placements[index];
      var item = document.createElement("button");
      item.type = "button";
      item.className = "chapter-section-link";
      item.dataset.sectionIndex = String(index);
      item.style.color = COLORS[(index + graph.domains.findIndex(function (domain) {
        return domain.id === chapter.parent;
      })) % COLORS.length];
      var number = document.createElement("span");
      number.className = "section-number";
      number.textContent = "G" + (placement.group + 1) + "." +
        placement.state.name + (placement.state.local + 1);
      var status = document.createElement("i");
      status.className = "section-status";
      var copy = document.createElement("span");
      copy.textContent = section.title;
      item.appendChild(number);
      item.appendChild(status);
      item.appendChild(copy);
      item.addEventListener("click", function () {
        var energyHit = {
          index: index,
          node: section,
          state: placement.state,
          group: placement.group,
        };
        var renderer = window.__starmapRenderer;
        if (renderer) renderer.renderEnergyCard(energyHit);
      });
      list.appendChild(item);
    });
    if (related.length) {
      related.forEach(function (node) {
        var link = document.createElement("a");
        link.className = "chapter-section-link deep-dive-reading";
        link.href = nodeHref(node);
        var number = document.createElement("span");
        number.className = "section-number";
        number.textContent = "关联";
        var status = document.createElement("i");
        status.className = "section-status";
        var copy = document.createElement("span");
        copy.textContent = node.title;
        link.appendChild(number);
        link.appendChild(status);
        link.appendChild(copy);
        list.appendChild(link);
      });
    }
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

      var chapterList = document.createElement("div");
      chapterList.className = "mobile-chapters";
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
        chapterCount.textContent = sectionsFor(graph, chapter.id).length + " 点";
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
          chapterList.querySelectorAll(".mobile-section-list").forEach(function (item) {
            item.hidden = true;
          });
          chapterList.querySelectorAll(".mobile-chapter-button").forEach(function (item) {
            item.setAttribute("aria-expanded", "false");
          });
          sectionList.hidden = !opening;
          button.setAttribute("aria-expanded", opening ? "true" : "false");
          if (opening) selectChapter(chapter.id, true);
        });
        row.appendChild(button);
        row.appendChild(sectionList);
        chapterList.appendChild(row);
      });
      details.appendChild(chapterList);
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

    var trackRef = {
      value: readStringStorage(TRACK_KEY, data.defaultTrack || "concise"),
    };
    if (!data.tracks[trackRef.value]) trackRef.value = "concise";
    var state = null;
    var selectedId = null;

    function graph() {
      var value = data.tracks[trackRef.value];
      value.track = trackRef.value;
      return value;
    }

    function getState() {
      return state || progressState(trackRef.value, graph());
    }

    function selectChapter(chapterId, source) {
      selectedId = chapterId;
      var currentGraph = graph();
      state = progressState(trackRef.value, currentGraph);
      renderLegend(currentGraph, selectedId, openChapter);
      renderSideFocus(data, currentGraph, trackRef.value, selectedId);
      updateProgress(trackRef.value, state);
      if (source !== "focus" && window.__starmapRenderer) {
        window.__starmapRenderer.focusChapter(chapterId);
      }
      var status = byId("graphStatus");
      if (status) {
        status.textContent = "当前视图：" + (
          trackRef.value === "advanced" ? "进阶完整版" : "精炼版"
        ) + " · 已聚焦 " + indexNodes(currentGraph)[chapterId].title;
      }
    }

    function openChapter(chapterId) {
      selectChapter(chapterId);
    }

    function renderTrack() {
      var currentGraph = graph();
      state = progressState(trackRef.value, currentGraph);
      var chapters = chapterNodes(currentGraph);
      selectedId = chapters.some(function (chapter) {
        return chapter.id === state.currentChapter;
      }) ? state.currentChapter : chapters[0].id;
      if (window.__starmapRenderer) window.__starmapRenderer.resetForTrack();
      document.querySelectorAll("[data-track]").forEach(function (button) {
        if (button.tagName !== "BUTTON") return;
        button.setAttribute(
          "aria-pressed",
          button.dataset.track === trackRef.value ? "true" : "false"
        );
      });
      renderLegend(currentGraph, selectedId, openChapter);
      renderSideOverview(currentGraph, trackRef.value, openChapter);
      renderMobileDomains(currentGraph, state, selectedId, selectChapter);
      updateProgress(trackRef.value, state);
      var status = byId("graphStatus");
      if (status) {
        status.textContent = "当前视图：" + (
          trackRef.value === "advanced" ? "进阶完整版全局图" : "精炼版全局图"
        );
      }
    }

    window.__starmapRenderer = createStarmapRenderer(
      data,
      trackRef,
      getState,
      selectChapter
    );

    document.querySelectorAll("#trackSwitcher [data-track]").forEach(function (button) {
      button.addEventListener("click", function () {
        trackRef.value = button.dataset.track;
        writeStringStorage(TRACK_KEY, trackRef.value);
        renderTrack();
      });
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
