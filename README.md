# Agent 学习与面试宝典

本项目把全书内容拆分为可独立维护的 Markdown 文件，并由固定命令生成 HTML 与 PDF。

## 文件边界

- `content/book.json`：全书顺序、锚点、标题、类型和目录分组。
- `content/**/*.md`：正文唯一事实来源。仅由原生块级 HTML 组成的迁移文件会原样注入；其他文件按 Markdown（可混合原生 HTML）渲染。
- `templates/handbook.html`：页面外壳、样式和脚本，包含 `{{BOOK_CONTENT}}`。
- `assets/`、`_shared/`：现有交互脚本、图片、字体和第三方前端资源。
- `agent-learning-handbook.html`、`Agent学习与面试宝典.pdf`：生成物，请勿直接编辑。
- `tools/`：拆分、构建、校验和 PDF 导出脚本。

## 环境准备

需要 Python 3.10+、Node.js 18+ 与 Chromium/Chrome。

```bash
python3 -m pip install -r requirements.txt
npm install
```

如 Chromium 不在系统路径，可指定：

```bash
CHROME_PATH=/absolute/path/to/chrome npm run pdf
```

## 常用命令

```bash
npm test          # 单元测试
npm run build     # 生成 HTML
npm run pages     # 生成 GitHub Pages 发布目录 dist/
npm run verify    # 校验清单、锚点、链接、标签和资源
npm run pdf       # 从 HTML 导出 PDF
npm run all       # build → verify → pdf
python3 tools/verify_handbook.py source  # 只校验内容清单与源文件
python3 tools/verify_handbook.py final   # 校验源文件与最终 HTML
```

以上 `npm run ...` 命令请在项目目录中执行；如果当前不在项目目录，可使用
`npm --prefix /path/to/agent-learning-handbook run all`。Python 工具按脚本自身位置
定位项目根目录，因此也可以通过脚本的绝对路径从其他目录调用。

## 修改现有章节

1. 在 `content/chapters/`、`content/labs/` 或其他内容目录中编辑对应文件。
2. 保留已有章节 `id`，否则旧书签和交互挂载点会失效。
3. 运行 `npm test && npm run all`。

首次迁移的 `.md` 文件是 HTML-in-Markdown，无需立即转换成纯 Markdown。只有注释、空白和原生块级 HTML、且没有块外 Markdown 文本时，构建器才会原样注入。包含 Markdown 的文件会整体交给 Markdown 渲染器，并支持表格、围栏代码、属性列表，以及带 `markdown="1"` 的 HTML 容器。

## 新增章节

1. 创建 `content/chapters/ch25.md`，可使用标准 Markdown。
2. 在 `content/book.json` 的目标位置增加条目：

```json
{
  "path": "chapters/ch25.md",
  "id": "ch25",
  "kind": "chapter",
  "title": "新章节标题",
  "toc": true,
  "toc_group": "第五篇 · 进阶",
  "number": "25"
}
```

3. 运行 `npm test && npm run all`。目录会从清单自动更新；源文件校验要求原有 24 章仍存在，但允许继续增加 `chapter` 条目。

## 首次拆分工具

`tools/split_html.py` 仅用于从单文件迁移或显式重建源文件。写入前会完成全部边界解析和目标冲突预检；每个文件通过同目录临时文件原子替换。默认拒绝覆盖：

```bash
python3 tools/split_html.py --source agent-learning-handbook.html
python3 tools/split_html.py --source agent-learning-handbook.html --force
```

## 故障处理

- 缺少 Markdown：运行 `python3 -m pip install -r requirements.txt`。
- 缺少 Puppeteer：运行 `npm install`。
- 找不到浏览器：设置 `CHROME_PATH`，或安装 Chromium。
- 校验失败：按输出修复缺失文件、重复/悬空锚点、不平衡标签或不存在的本地资源。
- PDF 导出会动态等待 Mermaid、ECharts、交互面板和字体完成渲染，而不是固定休眠；等待上限可用 `PDF_RENDER_TIMEOUT_MS` 调整。
- PDF 默认必须至少 250 页，可用正整数环境变量 `PDF_MIN_PAGES` 调整。大小或页数检查失败时不会覆盖上一次成功生成的 PDF。

## 发布到 GitHub Pages

仓库内置 `.github/workflows/deploy-pages.yml`。推送到 `main` 后，GitHub Actions 会自动：

1. 安装 Python 与 Node 依赖。
2. 运行 `npm test`。
3. 执行 `npm run pages`，生成 `dist/index.html`、`dist/assets/`、`dist/_shared/` 和 PDF。
4. 执行 `npm run verify`。
5. 将 `dist/` 发布到 GitHub Pages。

首次发布前，在 GitHub 仓库页面进入：

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

启用后，公开访问地址通常为：

```text
https://<你的 GitHub 用户名>.github.io/<仓库名>/
```

当前仓库若使用 `Liyurun/agent_learn`，默认地址通常为：

```text
https://Liyurun.github.io/agent_learn/
```

维护者只需要修改 `content/` 下的 Markdown 源文件并提交到 `main`，或通过 Pull Request 合并到 `main`，公开网页就会自动更新。
