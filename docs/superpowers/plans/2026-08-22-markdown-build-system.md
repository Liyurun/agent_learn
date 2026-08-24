# Markdown Build System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将单文件手册无损拆分为按章 Markdown 源文件，并提供可重复的 HTML 构建、结构校验和 PDF 导出命令。

**Architecture:** 以 `content/book.json` 作为内容顺序与元数据的唯一清单；章节文件首次保留完整 HTML `<section>`，构建器同时支持原生 HTML 和标准 Markdown。模板只保存内容容器之外的页面外壳，构建产物继续输出到现有 HTML/PDF 路径。

**Tech Stack:** Python 3.10+、Markdown 3.x、标准库 `html.parser`/`json`/`pathlib`、Node.js、Puppeteer。

---

## 文件职责

- `content/book.json`：内容单元顺序、路径、锚点、类型与目录配置。
- `content/**/*.md`：正文唯一事实来源；首次为无损 HTML-in-Markdown。
- `templates/handbook.html`：CSS、页面外壳、页脚和脚本，包含单一 `{{BOOK_CONTENT}}`。
- `tools/build.py`：读取清单、渲染内容、生成目录并原子输出 HTML。
- `tools/split_html.py`：从迁移快照提取模板和内容文件，只用于首次迁移或显式重建。
- `tools/verify_handbook.py`：校验清单、锚点、内部链接、标签、资源和原有挂载点。
- `tools/export_pdf.js`：等待动态内容、展开解析、隐藏网页控件并导出 A4 PDF。
- `tests/test_build_system.py`：构建器和校验器的自动化回归测试。
- `requirements.txt`、`package.json`：固定运行依赖和命令入口。
- `README.md`：维护、新增章节、构建和故障处理说明。

### Task 1: 保存迁移基线并建立失败测试

**Files:**
- Create: `tests/test_build_system.py`
- Create: `tests/fixtures/mini-handbook.html`
- Create: `tools/handbook_build.py`

- [ ] **Step 1: 保存当前 HTML 的规范化哈希与关键计数**

运行 Python，记录原始 HTML 的 24 个章节、4 个 Lab、关键动态挂载点和正文文本哈希，结果写入测试常量。

- [ ] **Step 2: 编写构建核心的失败测试**

覆盖 `load_manifest()`、`render_content_file()`、`replace_single_placeholder()`、`extract_anchor_ids()` 和 `normalize_for_compare()`；测试原生 HTML 原样返回、普通 Markdown 转换、占位符不唯一时报错、重复锚点可检测。

- [ ] **Step 3: 运行测试确认失败**

```bash
python3 -m unittest tests.test_build_system -v
```

预期：因 `tools.handbook_build` 尚未实现而失败。

### Task 2: 实现可复用构建核心

**Files:**
- Create: `tools/handbook_build.py`
- Modify: `tests/test_build_system.py`

- [ ] **Step 1: 实现清单读取与严格字段校验**

每项要求 `path`、`id`、`kind`、`title`、`toc`；拒绝重复路径和重复 `id`。

- [ ] **Step 2: 实现双模式内容渲染**

首个有效块是完整 `<section>` 时原样返回；否则使用 Markdown 扩展 `fenced_code`、`tables`、`attr_list` 渲染，并根据清单元数据包裹章节 `<section>`。

- [ ] **Step 3: 实现单占位符替换与规范化比较**

模板必须恰好包含一个 `{{BOOK_CONTENT}}`；规范化仅忽略生成注释、行尾空白和标签间空白。

- [ ] **Step 4: 运行核心测试**

```bash
python3 -m unittest tests.test_build_system -v
```

预期：核心单元测试全部通过。

### Task 3: 无损拆分当前手册

**Files:**
- Create: `tools/split_html.py`
- Create: `templates/handbook.html`
- Create: `content/book.json`
- Create: `content/frontmatter/*.md`
- Create: `content/parts/*.md`
- Create: `content/chapters/ch01.md` through `content/chapters/ch24.md`
- Create: `content/labs/intro.md` through `content/labs/lab04.md`
- Create: `content/appendices/references.md`
- Create: `content/appendices/footer.md`

- [ ] **Step 1: 实现基于顶层边界的提取器**

以内容容器内的顶层 `<section>`、分篇注释/分隔区块和页脚为边界，保持字节顺序；嵌套的 `tutorialMap` 等区块留在所属章节，不误拆。

- [ ] **Step 2: 先复制原始 HTML 为临时迁移快照**

快照放在临时目录，不进入最终工作区。

- [ ] **Step 3: 运行拆分器**

```bash
python3 tools/split_html.py --source agent-learning-handbook.html
```

预期：生成模板、清单和全部内容文件；不覆盖已有文件。

- [ ] **Step 4: 校验清单覆盖**

确认 `ch1` 至 `ch24`、`lab1` 至 `lab4`、导学、六个分篇和参考来源均按原顺序存在。

### Task 4: 实现 HTML 构建与自动目录

**Files:**
- Create: `tools/build.py`
- Modify: `templates/handbook.html`
- Modify: `tests/test_build_system.py`

- [ ] **Step 1: 给模板加入生成标记、内容和目录占位符**

模板仅允许一个 `{{BOOK_CONTENT}}`，目录区使用 `{{BOOK_TOC}}`。

- [ ] **Step 2: 从 `book.json` 生成章节目录**

只渲染 `toc=true` 项，保留现有分篇标题和章节编号样式。

- [ ] **Step 3: 原子写出 HTML**

先写同目录临时文件，成功后 `os.replace()` 覆盖生成物。

- [ ] **Step 4: 构建并做首次无损对比**

```bash
python3 tools/build.py --compare /tmp/agent-learning-handbook-before.html
```

预期：规范化正文、锚点集合、脚本引用和可见文本哈希一致；仅生成注释和自动目录允许受控差异。

### Task 5: 扩展全书校验器

**Files:**
- Modify: `tools/verify_handbook.py`
- Modify: `tests/test_build_system.py`

- [ ] **Step 1: 增加清单、锚点和内部链接检查**

聚合报告全部缺失文件、重复 `id`、缺失锚点和悬空 `href="#..."`。

- [ ] **Step 2: 增加标签平衡和资源存在检查**

检查 `section/div/pre/code/table/ul/ol/li`；解析本地 `src`/`href`，忽略外部 URL、片段和 `data:`。

- [ ] **Step 3: 保留现有 stage 兼容性**

`python3 tools/verify_handbook.py final` 继续有效，同时增加 `source` 和 `built` 阶段。

- [ ] **Step 4: 运行测试与全书校验**

```bash
python3 -m unittest tests.test_build_system -v
python3 tools/verify_handbook.py source
python3 tools/verify_handbook.py final
```

预期：全部通过。

### Task 6: 固化 PDF 导出

**Files:**
- Create: `tools/export_pdf.js`
- Create: `package.json`

- [ ] **Step 1: 实现 Chromium 自动发现**

按 `CHROME_PATH`、Puppeteer 自带路径、缓存目录和系统命令顺序查找；找不到时输出安装提示并退出。

- [ ] **Step 2: 实现安全导出**

输出到临时 PDF，加载完成后等待动态面板，展开 `.quiz-exp`/`details`，移除网页控件，成功后原子替换正式 PDF。

- [ ] **Step 3: 增加命令入口**

`build`、`verify`、`pdf`、`all` 分别映射到固定脚本；`all` 串行执行并在失败时停止。

- [ ] **Step 4: 导出并验证 PDF**

```bash
npm run all
```

预期：生成非空 HTML 和 PDF，PDF 页数大于 250。

### Task 7: 编写维护文档并做端到端验收

**Files:**
- Create: `README.md`
- Create: `requirements.txt`
- Modify: `docs/superpowers/specs/2026-08-22-markdown-build-system-design.md` only if implementation reveals a necessary clarification

- [ ] **Step 1: 写明源文件和生成物边界**

明确禁止直接编辑根 HTML/PDF，提供修改现有章节、新增章节、更新目录和导出 PDF 的命令。

- [ ] **Step 2: 增加一个临时 Markdown 章节做验收**

在临时副本中加入标准 Markdown 章节，确认标题、表格、围栏代码、原生 callout 和目录链接均正确生成；测试后删除。

- [ ] **Step 3: 执行完整回归**

```bash
python3 -m unittest tests.test_build_system -v
npm run all
```

预期：测试、构建、校验、PDF 全部成功。

- [ ] **Step 4: 输出迁移统计**

报告内容文件数、章节数、Lab 数、锚点数、正文文本哈希、HTML 大小、PDF 大小和页数。

## 自检结论

- 设计中的内容模型、模板、首次拆分、自动目录、校验、PDF、错误处理和维护说明均有对应任务。
- 计划不包含占位实现或未定义接口。
- 文件职责与函数名在任务间保持一致。
- 当前目录没有 Git 元数据，因此计划不包含无法执行的 commit 步骤；如果后续初始化 Git，可按任务边界分别提交。
