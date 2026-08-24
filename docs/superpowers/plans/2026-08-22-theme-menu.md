# 四主题菜单与顶栏精简实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除顶栏学习进度计数，保留章末学习标记，并将二元深浅模式升级为可持久化的四主题下拉菜单。

**Architecture:** 主题颜色由模板 CSS 变量控制，菜单和主题状态由模板内联脚本管理；学习进度仍由 `learner-guide.js` 管理，但不再向顶栏注入计数按钮。PDF 导出显式切回纸张白，避免本地状态污染打印结果。

**Tech Stack:** HTML、CSS Custom Properties、原生 JavaScript、localStorage、Puppeteer、Node Test、Python unittest。

---

### Task 1: 增加主题与计数回归测试

**Files:**
- Modify: `tests/test_build_system.py`
- Modify: `tests/test_export_pdf.js`

- [ ] 增加模板静态测试，断言四个主题 ID、菜单 ARIA 属性和 `ah-theme` 存储键存在。
- [ ] 增加导学脚本测试，断言不再包含 `lg-counter` 与“已学 + 计数”，但仍包含 `.lg-read-btn` 和 `ah-read-chapters`。
- [ ] 增加 PDF 测试，断言导出前设置 `data-theme="paper"`。
- [ ] 运行 `npm test`，确认新增测试在实现前失败。

### Task 2: 删除顶栏已学计数

**Files:**
- Modify: `assets/learner-guide.js`
- Modify: `templates/handbook.html`

- [ ] 删除 `.lg-counter` CSS。
- [ ] 删除 `counterEl`、`refreshCounter()`、计数按钮创建、插入和点击跳转。
- [ ] 将章末状态切换改为只执行 `saveRead()` 与 `paintRead()`。
- [ ] 保留 `READ_KEY`、章末按钮和 `.is-read` 状态。

### Task 3: 实现四主题样式与菜单

**Files:**
- Modify: `templates/handbook.html`

- [ ] 增加 `paper`、`warm`、`mist`、`dark` 的 CSS 变量集和顶栏背景变量。
- [ ] 增加主题菜单按钮、四个 `menuitemradio` 选项和当前状态样式。
- [ ] 实现主题读取、旧值迁移、应用、持久化和图表重绘。
- [ ] 实现按钮开关、选择后关闭、外部点击关闭和 `Escape` 关闭。
- [ ] 确保窄屏菜单不会溢出视口。

### Task 4: 固定 PDF 打印主题

**Files:**
- Modify: `tools/export_pdf.js`
- Modify: `tests/test_export_pdf.js`

- [ ] 在打印预处理阶段设置 `document.documentElement.dataset.theme = "paper"`。
- [ ] 关闭菜单并设置 `aria-expanded="false"`。
- [ ] 调用 `window.__ah_recolorCharts(false)` 后等待双帧渲染。
- [ ] 运行 Node 测试确认通过。

### Task 5: 构建与成品回归

**Files:**
- Generated: `agent-learning-handbook.html`
- Generated: `Agent学习与面试宝典.pdf`

- [ ] 运行 `npm test`。
- [ ] 运行 `python3 tools/verify_handbook.py source`。
- [ ] 运行 `npm run build && npm run verify`。
- [ ] 运行 `npm ci && npm run pdf`。
- [ ] 检查生成 HTML 中不存在 `.lg-counter`，且存在四个主题选项。
- [ ] 清理 `node_modules` 和 `__pycache__`。

## 验收

- 顶栏不再出现“已学 0/24”。
- 章末仍可标记学完并持久化。
- 用户可明确选择纸张白、暖米色、雾蓝色、深夜黑。
- 旧的深色偏好继续生效，非法值回退纸张白。
- 菜单具备基本键盘和 ARIA 支持。
- PDF 始终使用纸张白。
- 自动测试、构建、校验和 PDF 导出全部通过。
