(function () {
  "use strict";

  var STATE_KEY = "ah-advanced-learning-state";
  var LAST_PAGE_KEY = "ah-advanced-last-page";

  function emptyState() {
    return {
      completedSections: [],
      completedChapters: [],
      recent: [],
      lastPage: "",
      positions: {},
      updatedAt: 0,
    };
  }

  function uniqueValid(values, allowed) {
    var seen = {};
    return (Array.isArray(values) ? values : []).filter(function (value) {
      if (typeof value !== "string" || !allowed[value] || seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  function normalizeState(value, validIds) {
    var state = value && typeof value === "object" ? value : {};
    var allowed = {};
    validIds.forEach(function (id) { allowed[id] = true; });
    var recent = (Array.isArray(state.recent) ? state.recent : [])
      .filter(function (item) {
        return item && typeof item === "object" && allowed[item.id];
      })
      .slice(0, 10);
    var positions = {};
    if (state.positions && typeof state.positions === "object") {
      Object.keys(state.positions).forEach(function (id) {
        var ratio = Number(state.positions[id]);
        if (allowed[id] && Number.isFinite(ratio)) {
          positions[id] = Math.max(0, Math.min(1, ratio));
        }
      });
    }
    return {
      completedSections: uniqueValid(state.completedSections, allowed),
      completedChapters: uniqueValid(state.completedChapters, allowed),
      recent: recent,
      lastPage: allowed[state.lastPage] ? state.lastPage : "",
      positions: positions,
      updatedAt: Number(state.updatedAt) || 0,
    };
  }

  function readState(validIds) {
    try {
      return normalizeState(
        JSON.parse(localStorage.getItem(STATE_KEY) || "null"),
        validIds
      );
    } catch (_) {
      return emptyState();
    }
  }

  function writeState(state) {
    state.updatedAt = Date.now();
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
      if (state.lastPage) localStorage.setItem(LAST_PAGE_KEY, state.lastPage);
    } catch (_) {
      document.documentElement.classList.add("advanced-storage-unavailable");
    }
    window.dispatchEvent(new CustomEvent("advanced-learning-state-change", {
      detail: state,
    }));
  }

  function includes(values, target) {
    return values.indexOf(target) !== -1;
  }

  function toggleValue(values, target, enabled) {
    var next = values.filter(function (value) { return value !== target; });
    if (enabled) next.push(target);
    return next;
  }

  function updateChapterState(state, page) {
    if (!page.chapter || !page.chapterSections.length) return;
    var complete = page.chapterSections.every(function (id) {
      return includes(state.completedSections, id);
    });
    state.completedChapters = toggleValue(
      state.completedChapters,
      page.chapter,
      complete
    );
  }

  function updateProgress(state, page) {
    var complete = page.chapterSections.filter(function (id) {
      return includes(state.completedSections, id);
    }).length;
    var total = page.chapterSections.length;
    var count = document.getElementById("advancedChapterProgress");
    var fill = document.getElementById("advancedChapterProgressFill");
    if (count) count.textContent = complete + "/" + total;
    if (fill) fill.style.width = (
      total ? Math.round(complete / total * 100) : 0
    ) + "%";
  }

  function configureCompletion(state, page) {
    var button = document.getElementById("advancedComplete");
    if (!button) return;
    if (page.kind !== "section") {
      button.hidden = true;
      updateProgress(state, page);
      return;
    }

    function render() {
      var complete = includes(state.completedSections, page.id);
      button.setAttribute("aria-pressed", complete ? "true" : "false");
      button.textContent = complete ? "已完成" : "标记本节完成";
      updateProgress(state, page);
    }

    button.addEventListener("click", function () {
      var next = !includes(state.completedSections, page.id);
      state.completedSections = toggleValue(
        state.completedSections,
        page.id,
        next
      );
      updateChapterState(state, page);
      writeState(state);
      render();
    });
    render();
  }

  function configureDrawers() {
    var book = document.getElementById("advancedBookNav");
    var toc = document.getElementById("advancedPageToc");
    var bookButton = document.getElementById("advancedBookToggle");
    var tocButton = document.getElementById("advancedTocToggle");
    var backdrop = document.getElementById("advancedBackdrop");
    if (!book || !toc || !bookButton || !tocButton || !backdrop) return;

    function closeAll() {
      book.classList.remove("is-open");
      toc.classList.remove("is-open");
      bookButton.setAttribute("aria-expanded", "false");
      tocButton.setAttribute("aria-expanded", "false");
      backdrop.hidden = true;
    }

    function open(target, button) {
      closeAll();
      target.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
      backdrop.hidden = false;
    }

    bookButton.addEventListener("click", function () {
      if (book.classList.contains("is-open")) closeAll();
      else open(book, bookButton);
    });
    tocButton.addEventListener("click", function () {
      if (toc.classList.contains("is-open")) closeAll();
      else open(toc, tocButton);
    });
    backdrop.addEventListener("click", closeAll);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeAll();
    });
  }

  function configurePosition(state, page) {
    var restored = Number(state.positions[page.id]) || 0;
    if (restored > 0 && restored < 1) {
      requestAnimationFrame(function () {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        if (max > 0) window.scrollTo(0, max * restored);
      });
    }

    var scheduled = false;
    window.addEventListener("scroll", function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        var max = document.documentElement.scrollHeight - window.innerHeight;
        state.positions[page.id] = max > 0 ? window.scrollY / max : 0;
        writeState(state);
      });
    }, { passive: true });
  }

  function rememberPage(state, page) {
    state.lastPage = page.id;
    state.recent = [{
      id: page.id,
      route: page.route,
      visitedAt: Date.now(),
    }].concat(state.recent.filter(function (item) {
      return item.id !== page.id;
    })).slice(0, 10);
    writeState(state);
  }

  function init() {
    var page = window.ADVANCED_PAGE;
    if (!page || !page.id || !Array.isArray(page.allIds)) return;
    page.chapterSections = Array.isArray(page.chapterSections)
      ? page.chapterSections
      : [];
    var state = readState(page.allIds);
    rememberPage(state, page);
    configureCompletion(state, page);
    configureDrawers();
    configurePosition(state, page);
    document.documentElement.classList.add("advanced-enhanced");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}());
