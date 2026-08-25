(function () {
  "use strict";

  const dialog = document.getElementById("unifiedSearch");
  if (!dialog) return;

  const input = dialog.querySelector('input[type="search"]');
  const status = dialog.querySelector("[data-search-status]");
  const results = dialog.querySelector("[data-search-results]");
  const filterButtons = Array.from(dialog.querySelectorAll("[data-filter]"));
  const openButtons = Array.from(document.querySelectorAll("[data-search-open]"));
  const siteRoot = new URL(document.body.dataset.siteRoot || "./", window.location.href);
  let documents = null;
  let loading = null;
  let filter = "all";

  function score(document, query) {
    const value = query.trim().toLowerCase();
    if (!value) return 0;
    let result = 0;
    if (document.title.toLowerCase().includes(value)) result += 20;
    if (document.chapter.toLowerCase().includes(value)) result += 10;
    if (document.description.toLowerCase().includes(value)) result += 6;
    if (document.text.includes(value)) result += 2;
    return result;
  }

  function matchesFilter(document) {
    if (filter === "all") return true;
    if (filter === "code") return document.tags.includes("code");
    if (filter === "interview") return document.tags.includes("interview");
    return document.track === filter;
  }

  function resultHref(document) {
    return new URL(document.route.replace(/^\/+/, "") + "/", siteRoot).href;
  }

  function excerpt(document, query) {
    const value = query.trim().toLowerCase();
    const index = document.text.indexOf(value);
    const start = Math.max(0, index < 0 ? 0 : index - 58);
    const copy = document.text.slice(start, start + 170);
    return (start ? "..." : "") + copy + (start + 170 < document.text.length ? "..." : "");
  }

  function appendResult(document, query) {
    const row = window.document.createElement("li");
    const link = window.document.createElement("a");
    const title = window.document.createElement("span");
    const meta = window.document.createElement("span");
    const copy = window.document.createElement("span");

    row.className = "unified-search-result";
    link.href = resultHref(document);
    title.className = "unified-search-result-title";
    meta.className = "unified-search-result-meta";
    copy.className = "unified-search-result-copy";
    title.textContent = document.title;
    meta.textContent = [
      document.track === "concise" ? "精炼版" : "进阶完整版",
      document.chapter,
    ].filter(Boolean).join(" · ");
    copy.textContent = excerpt(document, query);
    link.append(title, meta, copy);
    row.appendChild(link);
    results.appendChild(row);
  }

  function render() {
    const query = input.value.trim();
    results.replaceChildren();
    if (!documents) {
      status.textContent = loading ? "正在加载搜索索引..." : "打开搜索后加载索引";
      return;
    }
    if (!query) {
      status.textContent = "输入关键词开始搜索";
      return;
    }

    const matches = documents
      .filter(matchesFilter)
      .map((document) => ({ document, rank: score(document, query) }))
      .filter((entry) => entry.rank > 0)
      .sort((left, right) => right.rank - left.rank ||
        left.document.title.localeCompare(right.document.title, "zh-CN"))
      .slice(0, 20);

    matches.forEach((entry) => appendResult(entry.document, query));
    status.textContent = matches.length
      ? `显示 ${matches.length} 条结果`
      : "没有匹配结果";
  }

  function ensureIndex() {
    if (documents || loading) return loading;
    status.textContent = "正在加载搜索索引...";
    loading = fetch(new URL("search-index.json", siteRoot))
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        documents = Array.isArray(payload.documents) ? payload.documents : [];
        render();
      })
      .catch(() => {
        status.textContent = "搜索索引加载失败，请刷新后重试";
      });
    return loading;
  }

  function openSearch() {
    if (!dialog.open) dialog.showModal();
    ensureIndex();
    window.requestAnimationFrame(() => input.focus());
  }

  openButtons.forEach((button) => {
    button.addEventListener("click", openSearch);
  });

  dialog.addEventListener("toggle", () => {
    if (dialog.open) ensureIndex();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  input.addEventListener("input", render);
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filter = button.dataset.filter || "all";
      filterButtons.forEach((candidate) => {
        candidate.setAttribute(
          "aria-pressed",
          candidate === button ? "true" : "false",
        );
      });
      render();
    });
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
    }
  });
})();
