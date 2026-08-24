# Agent 学习手册 Markdown 构建系统设计

## 目标

把当前单文件 `agent-learning-handbook.html` 拆分为按章维护的 Markdown 源文件，并提供稳定、可重复的一键构建流程。首次迁移必须保留现有页面视觉、章节锚点、动态案例、测验、图表和 PDF 输出；后续新增或修改章节时，只需编辑独立内容文件并运行构建命令。

## 设计原则

1. `content/` 是正文唯一事实来源，生成后的 HTML 和 PDF 不直接编辑。
2. 首次拆分优先无损，不强制一次性重写 13.7 万字正文。
3. 构建器同时接受标准 Markdown 和原生 HTML，使章节可以逐步 Markdown 化。
4. 所有现有 `id`、CSS 类名和 JavaScript 挂载点保持不变。
5. 构建、校验和 PDF 导出都必须可通过固定命令重复执行。
6. 尽量减少依赖；构建器使用 Python，Markdown 渲染依赖显式锁定。

## 目录结构

```text
agent-learning-handbook/
├── content/
│   ├── book.json
│   ├── frontmatter/
│   ├── chapters/
│   │   ├── ch01.md
│   │   └── ch24.md
│   ├── labs/
│   │   ├── intro.md
│   │   └── lab04.md
│   └── appendices/
│       └── references.md
├── templates/
│   └── handbook.html
├── assets/
├── tools/
│   ├── split_html.py
│   ├── build.py
│   ├── verify_handbook.py
│   └── export_pdf.js
├── requirements.txt
├── package.json
├── agent-learning-handbook.html
└── Agent学习与面试宝典.pdf
```

## 内容模型

`content/book.json` 维护构建顺序和每个内容单元的元数据。每项至少包含：

```json
{
  "path": "chapters/ch01.md",
  "id": "ch1",
  "kind": "chapter",
  "title": "Agent 到底是什么",
  "toc": true
}
```

内容文件支持两种模式：

- **无损模式**：文件包含完整原生 HTML 区块。首次迁移使用该模式，构建器原样注入。
- **Markdown 模式**：文件包含 Markdown 正文。构建器渲染后按清单元数据生成章节 `<section>` 外壳。

模式由内容自动判断：首个非空字符为 HTML 区块且包含顶层 `<section>` 时按无损模式处理，否则按 Markdown 模式处理。章节元数据集中保存在 `book.json`，避免在几十个文件中重复维护 YAML。

## 模板与产物

`templates/handbook.html` 保存当前页面外壳、CSS、封面、脚本引用和唯一的 `{{BOOK_CONTENT}}` 占位符。`tools/build.py` 按 `book.json` 顺序读取内容文件，渲染后替换占位符，输出根目录的 `agent-learning-handbook.html`。

生成文件顶部加入注释：

```html
<!-- GENERATED FILE: 请修改 content/、templates/ 或 assets/，不要直接编辑本文件。 -->
```

现有路径保持不变，避免用户书签和静态资源引用失效。

## 首次拆分

`tools/split_html.py` 只负责从当前 HTML 提取内容：

1. 识别页面内容容器的开始和结束。
2. 按章节、分篇、导学和附录边界切分。
3. 写入对应 `.md` 文件。
4. 生成 `content/book.json`。
5. 把内容容器之外的 HTML 写为模板。
6. 不覆盖已存在的内容文件，除非显式传入 `--force`。

首次运行后立即执行构建，并对原文件与生成文件进行规范化结构对比。比较忽略生成注释和空白差异，但不得忽略元素顺序、`id`、文本或脚本引用。

## 构建流程

核心命令：

```bash
python3 tools/build.py
python3 tools/verify_handbook.py final
npm run pdf
```

快捷命令：

```bash
npm run build
npm run verify
npm run all
```

`npm run all` 串行执行 HTML 构建、校验和 PDF 导出，任一步失败即返回非零状态。

## 自动目录

目录中的章节列表由 `book.json` 生成，不再手工维护。构建器只替换模板中的目录占位区，保留现有视觉结构。`toc=false` 的导学、动态面板和附录不会进入章节目录。

新增章节流程：

1. 新建 `content/chapters/ch25.md`。
2. 在 `book.json` 中增加条目和顺序。
3. 运行 `npm run all`。

## 校验

扩展后的 `tools/verify_handbook.py` 校验：

- `book.json` 中所有内容文件存在。
- 清单中的 `id` 唯一，生成 HTML 中对应锚点存在且唯一。
- 24 个原章节、4 个 Lab 以及原有导学和交互挂载点无缺失。
- 目录中的内部链接均指向存在的锚点。
- `section`、`div`、`pre`、`code`、`table`、`ul`、`ol`、`li` 标签数量配平。
- CSS、JavaScript、字体和图片等本地资源路径存在。
- 生成 HTML 包含“请勿直接编辑”标记。
- 可选 `--compare` 对比迁移前快照，验证首次拆分无内容丢失。

## PDF 导出

`tools/export_pdf.js` 固化当前已验证的 Puppeteer 导出逻辑：

- 等待 Mermaid、ECharts 和动态内容完成渲染。
- 展开测验解析和 `<details>`。
- 移除顶部导航、进度条和回到顶部按钮。
- 使用 A4、打印背景和页码页脚。
- 优先使用环境变量 `CHROME_PATH`，其次查找 Puppeteer 缓存和系统 Chromium。
- 无可用浏览器时输出明确错误和安装方法。

PDF 输出固定为 `Agent学习与面试宝典.pdf`。

## 依赖与兼容

Python 依赖写入 `requirements.txt` 并锁定兼容范围。Node 依赖写入 `package.json`。构建脚本使用相对项目根目录的路径，可从任意当前工作目录调用。

现有 `assets/` 与 `_shared/` 不改路径。原有 JavaScript 继续通过固定 `id` 挂载，无需重写。

## 错误处理

- 清单 JSON 无法解析时，报告具体文件和解析位置。
- 内容文件缺失时，列出全部缺失项后退出。
- Markdown 渲染失败时，指出内容文件。
- 模板缺少或包含多个 `{{BOOK_CONTENT}}` 时拒绝构建。
- 构建使用临时文件，全部成功后再原子替换 HTML，避免留下半成品。
- PDF 导出失败时保留现有 PDF，不覆盖为损坏文件。

## 验收标准

1. 全部正文已拆分到 `content/`，原 HTML 可由脚本重建。
2. 首次重建后 24 章、4 个 Lab、动态面板和附录均保留。
3. 结构校验、锚点校验和资源校验全部通过。
4. 现有页面交互仍可使用。
5. PDF 可通过固定命令重新导出。
6. 新增测试章节只需一个 Markdown 文件、一个清单条目和一次构建。
7. 项目内附有简短维护说明，明确哪些文件是源文件、哪些是生成物。

## 非目标

- 本次不重写现有视觉设计和交互逻辑。
- 本次不把所有原生 HTML 一次性人工改写为纯 Markdown。
- 本次不引入静态站点生成器或前端框架。
- 本次不修改现有章节内容与技术结论。
