# 分层目录导航系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从内容清单自动生成顶部章节下拉，并为当前章提供桌面右侧及移动端小节导航。

**Architecture:** `tools/handbook_build.py` 负责把 `book.json` 转为顶部导航 HTML，并为章节 `h3` 注入稳定 ID；`templates/handbook.html` 提供导航占位符、容器、样式和原生 JavaScript 交互。PDF 导出隐藏所有辅助导航，正文和锚点保留。

**Tech Stack:** Python、HTMLParser/正则、HTML/CSS、原生 JavaScript、IntersectionObserver、Puppeteer。

---

### Task 1: 建立失败测试

**Files:**
- Modify: `tests/test_build_system.py`
- Modify: `tests/test_export_pdf.js`

- [ ] 增加顶部导航生成测试，断言清单中 `toc=true` 项按 `toc_group` 进入正确菜单。
- [ ] 增加新增章节自动进入菜单测试。
- [ ] 增加 `h3` 稳定锚点测试：连续构建两次 ID 相同，已有 ID 不变。
- [ ] 增加生成 HTML 内部小节链接唯一性测试。
- [ ] 增加模板交互静态测试，覆盖 hover/focus、`Escape`、移动目录、外部关闭和当前章目录。
- [ ] 增加 PDF 预处理测试，断言隐藏顶部下拉、右侧导航和移动导航。
- [ ] 运行 `npm test`，确认测试先失败。

### Task 2: 扩展构建核心

**Files:**
- Modify: `tools/handbook_build.py`
- Modify: `tools/build.py`
- Modify: `templates/handbook.html`

- [ ] 定义 `NAV_PLACEHOLDER = "{{BOOK_NAV}}"`，模板必须恰好包含一个。
- [ ] 实现 `render_top_navigation(manifest)`，生成六个分篇菜单和资源直达链接。
- [ ] 分篇触发器关联 `part1` 至 `part6`，菜单项显示编号与标题。
- [ ] 实现 `inject_heading_ids(html, section_id)`，仅处理章节顶层内容中的 `h3`；已有 ID 保留，否则生成 `{section_id}-section-{NN}`。
- [ ] 在 `render_content_file()` 的原生 HTML 和 Markdown 两种路径中执行小节 ID 注入。
- [ ] 构建时依次替换导航、目录和正文占位符。

### Task 3: 实现桌面顶部下拉

**Files:**
- Modify: `templates/handbook.html`

- [ ] 增加分篇菜单容器、触发器和下拉项样式。
- [ ] 使用 hover 与 `focus-within` 提供无脚本基本展开。
- [ ] JavaScript 维护 `aria-expanded`、当前分篇和当前章节状态。
- [ ] 鼠标进入保持展开，离开菜单区域关闭。
- [ ] `Escape` 关闭并返回触发器焦点。
- [ ] 下拉项目点击后关闭并跳转。

### Task 4: 实现当前章导航

**Files:**
- Modify: `templates/handbook.html`

- [ ] 增加右侧 `.chapter-outline` 固定容器，宽度大于 1280px 时显示。
- [ ] 章节变化时读取当前章节 `h3[id]` 并生成小节链接。
- [ ] 使用 `IntersectionObserver` 或滚动降级计算当前章节和小节。
- [ ] 小节标题单行截断，`title` 保留完整文本。
- [ ] 当前小节使用 `aria-current="location"` 和主题强调色。
- [ ] 当前章无 `h3` 时隐藏导航。

### Task 5: 实现移动导航

**Files:**
- Modify: `templates/handbook.html`

- [ ] 在不超过 768px 时显示“目录”按钮和移动全书目录面板。
- [ ] 分篇按钮点击展开章节列表，单次允许一个分篇展开。
- [ ] 点击章节、外部区域或 `Escape` 后关闭。
- [ ] 增加“本章目录”浮动按钮和移动小节面板。
- [ ] 选择小节后关闭面板并平滑跳转。
- [ ] 两个移动面板互斥，避免重叠。

### Task 6: PDF 与打印规则

**Files:**
- Modify: `templates/handbook.html`
- Modify: `tools/export_pdf.js`

- [ ] `@media print` 隐藏所有下拉、右侧目录和移动按钮/面板。
- [ ] PDF 预处理移除 `.nav-dropdown`、`.chapter-outline`、`.mobile-book-nav`、`.mobile-outline`。
- [ ] 保留章节与小节锚点，不删除正文标题。

### Task 7: 完整回归

**Files:**
- Generated: `agent-learning-handbook.html`
- Generated: `Agent学习与面试宝典.pdf`

- [ ] 运行 `npm test`，Python 与 Node 测试全部通过。
- [ ] 运行 `python3 tools/verify_handbook.py source`。
- [ ] 运行 `npm run build && npm run verify`。
- [ ] 检查生成 HTML 中六个分篇下拉、24 章、4 个 Lab 和全部 `h3` 锚点。
- [ ] 运行 `npm ci && npm run pdf`，PDF 页数满足门槛。
- [ ] 清理 `node_modules` 和 `__pycache__`。

## 验收

- 悬浮或聚焦顶部“原理”等入口可看到对应章节。
- 顶部菜单内容随 `book.json` 自动变化。
- 宽屏右侧显示当前章 `h3`，滚动时当前项高亮。
- 移动端可点击打开全书目录和本章目录。
- 原有主题菜单、字号调节、章末学习标记和图表正常。
- PDF 不显示辅助导航。
- 全部测试、校验、构建和 PDF 回归通过。

## 自检结论

- 设计中的数据源、顶部交互、右侧目录、移动降级、稳定锚点、无障碍和打印规则均有对应任务。
- 顶部导航与正文目录的职责不重叠。
- 当前项目没有 Git 元数据，因此不包含提交步骤。
