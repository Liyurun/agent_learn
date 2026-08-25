# Dual-Track Handbook Fusion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separately tracked 31-chapter advanced handbook to the existing concise handbook, render both through one static site, and visualize every chapter as a connected subgraph inside one route-level knowledge graph.

**Architecture:** Import only normalized Markdown and the runnable context-engineering example from the external ZIP into committed repository content; do not import the bundled Astro site or generated search files. Extend the Python static-site generator with an advanced-content model, advanced reading pages, one hierarchical graph model shared by both tracks, and a lazy unified search index. Preserve all existing concise routes, full-book HTML, and PDF behavior.

**Tech Stack:** Python 3.11+, `zipfile`, PyYAML, Python Markdown, HTML/CSS, vanilla JavaScript, SVG, `localStorage`, `unittest`, Node test runner, Puppeteer/Chromium, GitHub Pages.

---

## Execution Prerequisite

Execute this plan in a dedicated branch/worktree:

```bash
git worktree add ../agent-learning-handbook2-fusion \
  -b feat/dual-track-handbook-fusion main
cd ../agent-learning-handbook2-fusion
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
npm ci
```

Set the source archive only for import tasks:

```bash
export ADVANCED_SOURCE_ZIP='/Users/bytedance/Library/Application Support/Trae CN/User/workspaceStorage/ce40f13b94db2e71c43346064542a697/external-files/6a8c23eea25d37447414a263/0-mt7v9yx0-bfm5/AI-Agent-学习实践面试宝典-完整内容.zip'
```

The ZIP remains external and must not be committed.

## File Structure

### Create

- `tools/import_advanced_handbook.py`: deterministic ZIP importer and CLI.
- `tools/advanced_content.py`: manifest types, validation, Markdown rendering, route helpers.
- `tools/knowledge_graph.py`: concise/advanced graph nodes, internal edges, chapter edges, and relation validation.
- `tools/search_index.py`: lazy-search document extraction and JSON index generation.
- `content/advanced/manifest.json`: committed normalized advanced content manifest.
- `content/advanced/pages/**/*.md`: committed cleaned advanced Markdown.
- `content/advanced/relations.json`: curated cross-chapter and cross-track edges.
- `content/advanced/README.md`: source provenance and regeneration command.
- `examples/context-engineering-agent/**`: imported runnable example without generated metadata.
- `templates/advanced.html`: advanced chapter/section reading shell.
- `assets/advanced.css`: three-column advanced reading layout and responsive drawers.
- `assets/advanced.js`: advanced completion state, recent pages, drawers, and section progress.
- `assets/unified-search.js`: lazy index loading, filters, ranking, and keyboard dialog.
- `tests/test_advanced_import.py`: importer and cleaner tests.
- `tests/test_advanced_site.py`: manifest, routes, graph, progress contract, search, and verifier tests.

### Modify

- `requirements.txt`: add PyYAML.
- `package.json`: include new Python test modules.
- `tools/build_pages.py`: render advanced pages, graph JSON, search index, sitemap routes.
- `tools/verify_handbook.py`: validate advanced source, graph relations, routes, and banned author markers.
- `tools/handbook_build.py`: expose concise heading nodes for the shared graph.
- `templates/learning-map.html`: route switcher, global graph canvas, chapter subgraph panel, search dialog.
- `templates/handbook.html`: unified search trigger and concise-to-advanced links.
- `assets/learning-map.css`: graph-of-graphs desktop view and mobile chapter-cluster list.
- `assets/learning-map.js`: dual-track state, hierarchical graph rendering, zoom/focus, chapter panel.
- `assets/handbook-interactions.js`: initialize unified search on concise pages.
- `README.md`: import, build, route, and content-maintenance documentation.
- `.github/workflows/deploy-pages.yml`: no external ZIP access; build committed normalized content.

## Stable Contracts

### Advanced manifest

```json
{
  "version": 1,
  "track": "advanced",
  "source": "AI-Agent-学习实践面试宝典-完整内容.zip",
  "domains": [],
  "items": []
}
```

Every item contains:

```json
{
  "id": "advanced-ch27-context-problem",
  "slug": "chapter-27/context-problem",
  "route": "advanced/chapter-27/context-problem",
  "kind": "section",
  "title": "上下文工程解决什么问题",
  "description": "一个客服 Agent 第一轮正确记录过敏信息，第十轮却违反约束。",
  "domain": "advanced-frontier",
  "order": 23,
  "sourcePath": "第一部分-系统学习教材/卷七-进阶专题/第27章-上下文工程/01-上下文工程解决什么问题.md",
  "parent": "advanced-ch27",
  "sectionOrder": 2,
  "contentPath": "pages/chapter-27/context-problem.md"
}
```

Expected normalized totals:

```text
31 chapter landing pages
220 section pages
4 appendix pages
1 guide page
256 advanced Markdown pages total
```

### Relation types

Only these values are valid:

```text
sequence
prerequisite
deep-dive
related
practice
interview
```

### Progress keys

```text
Concise:  ah-read-chapters, ah-last-chapter
Advanced: ah-advanced-learning-state, ah-advanced-last-page
UI mode:  ah-learning-track
```

## Phase 1: Deterministic Content Import

### Task 1: Parse and validate the advanced ZIP

**Files:**
- Create: `tools/import_advanced_handbook.py`
- Create: `tests/test_advanced_import.py`
- Modify: `requirements.txt`

- [ ] **Step 1: Add the structured YAML dependency**

Append:

```text
PyYAML>=6.0,<7
```

Run:

```bash
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Expected: `python -c "import yaml"` exits zero.

- [ ] **Step 2: Write a failing in-memory ZIP discovery test**

```python
class ArchiveDiscoveryTests(unittest.TestCase):
    def test_discovers_only_normalized_site_markdown(self) -> None:
        archive = make_archive({
            "Book/site/src/content/chapters/chapter-01.md": SAMPLE_LANDING,
            "Book/site/src/content/chapters/chapter-01/s01.md": SAMPLE_SECTION,
            "Book/site/dist/index.html": "<html></html>",
            "Book/site/pagefind/pagefind.js": "generated",
        })
        members = discover_content_members(archive)
        self.assertEqual(
            [member.relative_path for member in members],
            ["chapter-01.md", "chapter-01/s01.md"],
        )
```

`make_archive()` creates an in-memory `BytesIO` ZIP with
`zipfile.ZipFile(buffer, "w")`; no binary fixture is committed.

- [ ] **Step 3: Run the test and confirm red**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_import.ArchiveDiscoveryTests -v
```

Expected: import error for `discover_content_members`.

- [ ] **Step 4: Implement safe member discovery**

```python
@dataclass(frozen=True)
class SourceMember:
    archive_name: str
    relative_path: str


def discover_content_members(archive: Path) -> list[SourceMember]:
    with ZipFile(archive) as source:
        names = source.namelist()
    marker = "/site/src/content/chapters/"
    members = []
    for name in names:
        if marker not in name or not name.endswith(".md"):
            continue
        relative = name.split(marker, 1)[1]
        path = PurePosixPath(relative)
        if path.is_absolute() or ".." in path.parts:
            raise ImportError(f"unsafe archive path: {relative}")
        members.append(SourceMember(name, path.as_posix()))
    return sorted(members, key=lambda member: member.relative_path)
```

Reject archives without exactly one `/site/src/content/chapters/` root.

- [ ] **Step 5: Parse YAML frontmatter**

```python
def split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---\n"):
        raise ImportError("advanced page is missing YAML frontmatter")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ImportError("advanced page has unterminated YAML frontmatter")
    metadata = yaml.safe_load(text[4:end]) or {}
    if not isinstance(metadata, dict):
        raise ImportError("advanced page frontmatter must be a mapping")
    return metadata, text[end + 5:]
```

Require `title`, `slug`, `section`, `volume`, `order`, `sourcePath`, and `description`.

- [ ] **Step 6: Run tests**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_import.ArchiveDiscoveryTests -v
```

Expected: all discovery/frontmatter tests pass.

- [ ] **Step 7: Commit**

```bash
git add requirements.txt tools/import_advanced_handbook.py tests/test_advanced_import.py
git commit -m "build: add advanced archive parser"
```

### Task 2: Clean imported Markdown deterministically

**Files:**
- Modify: `tools/import_advanced_handbook.py`
- Modify: `tests/test_advanced_import.py`

- [ ] **Step 1: Write failing cleaner tests**

```python
def test_clean_markdown_converts_refs_and_hides_author_prompts() -> None:
    source = """正文 [$TRAE_REF](https://example.com/source)

## 图片生成描述：架构图

> **用途**：作者提示，不应展示。

## 生产踩坑

保留这一节。
"""
    cleaned = clean_markdown(source)
    self.assertIn("[来源](https://example.com/source)", cleaned)
    self.assertNotIn("TRAE_REF", cleaned)
    self.assertNotIn("图片生成描述", cleaned)
    self.assertNotIn("作者提示", cleaned)
    self.assertIn("## 生产踩坑", cleaned)


def test_clean_markdown_rewrites_advanced_routes() -> None:
    source = "[预算](/chapters/chapter-27/context-budget/)"
    self.assertEqual(
        clean_markdown(source).strip(),
        "[预算](/advanced/chapter-27/context-budget/)",
    )
```

- [ ] **Step 2: Run the cleaner tests and confirm red**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_import.MarkdownCleanerTests -v
```

- [ ] **Step 3: Implement line-aware cleaning**

```python
IMAGE_PROMPT_RE = re.compile(r"^#{1,6}\s+图片生成描述")
HEADING_RE = re.compile(r"^(#{1,6})\s+")
TRAE_REF_RE = re.compile(r"\[\$TRAE_REF\]\(([^)]+)\)")
FENCE_RE = re.compile(r"^\s*(```|~~~)")


def remove_image_prompt_sections(text: str) -> str:
    output: list[str] = []
    skipped_level: int | None = None
    for line in text.splitlines():
        prompt = IMAGE_PROMPT_RE.match(line)
        heading = HEADING_RE.match(line)
        if prompt:
            skipped_level = len(prompt.group(0).split()[0])
            continue
        if skipped_level is not None:
            if heading and len(heading.group(1)) <= skipped_level:
                skipped_level = None
            else:
                continue
        output.append(line)
    return "\n".join(output).strip() + "\n"


def clean_prose(text: str) -> str:
    text = remove_image_prompt_sections(text)
    text = TRAE_REF_RE.sub(r"[来源](\1)", text)
    text = re.sub(
        r"\]\(/chapters/([^)#]+)(#[^)]+)?\)",
        lambda match: "](/advanced/" + match.group(1).strip("/") + "/" +
        (match.group(2) or "") + ")",
        text,
    )
    return text


def transform_outside_fences(
    text: str,
    transform: Callable[[str], str],
) -> str:
    output: list[str] = []
    prose: list[str] = []
    fence: str | None = None

    def flush_prose() -> None:
        if prose:
            output.append(transform("".join(prose)))
            prose.clear()

    for line in text.splitlines(keepends=True):
        match = FENCE_RE.match(line)
        if match and fence is None:
            flush_prose()
            fence = match.group(1)
            output.append(line)
        elif match and fence == match.group(1):
            output.append(line)
            fence = None
        elif fence is not None:
            output.append(line)
        else:
            prose.append(line)
    flush_prose()
    return "".join(output)


def clean_markdown(text: str) -> str:
    return transform_outside_fences(text, clean_prose)
```

Do not run route or reference replacements inside fenced code blocks.

- [ ] **Step 4: Validate banned markers**

```python
def validate_clean_markdown(text: str, source_path: str) -> None:
    errors = []
    if "TRAE_REF" in text:
        errors.append("residual TRAE_REF")
    if re.search(r"^#{1,6}\s+图片生成描述", text, re.MULTILINE):
        errors.append("visible image-generation prompt")
    if errors:
        raise ImportError(f"{source_path}: {', '.join(errors)}")
```

- [ ] **Step 5: Run tests**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_import.MarkdownCleanerTests -v
```

Expected: all cleaner tests pass.

- [ ] **Step 6: Commit**

```bash
git add tools/import_advanced_handbook.py tests/test_advanced_import.py
git commit -m "build: normalize advanced markdown"
```

### Task 3: Generate the advanced manifest and committed content

**Files:**
- Modify: `tools/import_advanced_handbook.py`
- Modify: `tests/test_advanced_import.py`
- Create: `content/advanced/README.md`
- Generate: `content/advanced/manifest.json`
- Generate: `content/advanced/pages/**/*.md`
- Generate: `examples/context-engineering-agent/**`

- [ ] **Step 1: Write failing manifest-generation tests**

```python
def test_build_item_normalizes_identity_and_parent() -> None:
    item = build_item({
        "title": "上下文预算与动态组装",
        "slug": "chapter-27/context-budget",
        "section": "第一部分 · 系统学习教材",
        "volume": "卷七 · 进阶专题",
        "order": 23,
        "sourcePath": "source.md",
        "description": "预算说明",
        "chapterSlug": "chapter-27",
        "sectionSlug": "context-budget",
        "sectionOrder": 3,
        "isChapterLanding": False,
    })
    self.assertEqual(item["id"], "advanced-ch27-context-budget")
    self.assertEqual(item["route"], "advanced/chapter-27/context-budget")
    self.assertEqual(item["kind"], "section")
    self.assertEqual(item["parent"], "advanced-ch27")
```

Add tests for chapter, appendix, and guide classification.

- [ ] **Step 2: Run and confirm red**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_import.ManifestGenerationTests -v
```

- [ ] **Step 3: Implement item and domain classification**

```python
DOMAIN_BY_VOLUME = {
    "开始阅读": ("advanced-start", 0),
    "卷一 · 认识 Agent": ("advanced-foundations", 1),
    "卷二 · 核心能力原语": ("advanced-primitives", 2),
    "卷三 · 协议与编排": ("advanced-orchestration", 3),
    "卷四 · 框架与实践": ("advanced-frameworks", 4),
    "卷五 · 工程化与生产": ("advanced-production", 5),
    "卷六 · 实战项目": ("advanced-projects", 6),
    "卷七 · 进阶专题": ("advanced-frontier", 7),
    "第二部分 · 面试冲刺": ("advanced-interview", 8),
    "附录": ("advanced-resources", 9),
}


def make_advanced_id(slug: str) -> str:
    normalized = re.sub(
        r"^chapter-(\d+)",
        lambda match: "ch" + match.group(1),
        slug.strip("/"),
    )
    return "advanced-" + normalized.replace("/", "-")


def build_item(metadata: dict[str, Any]) -> dict[str, Any]:
    slug = str(metadata["slug"]).strip("/")
    if metadata.get("isChapterLanding") is True:
        kind = "chapter"
    elif metadata.get("sectionSlug"):
        kind = "section"
    elif slug.startswith("appendix-"):
        kind = "appendix"
    elif slug == "guide":
        kind = "guide"
    else:
        raise ImportError(f"cannot classify advanced page: {slug}")

    domain_id, _ = DOMAIN_BY_VOLUME[str(metadata["volume"])]
    chapter_slug = metadata.get("chapterSlug")
    return {
        "id": make_advanced_id(slug),
        "slug": slug,
        "route": "advanced" if kind == "guide" else "advanced/" + slug,
        "kind": kind,
        "title": str(metadata["title"]),
        "description": str(metadata["description"]),
        "domain": domain_id,
        "order": int(metadata["order"]),
        "sourcePath": str(metadata["sourcePath"]),
        "parent": (
            make_advanced_id(str(chapter_slug))
            if kind == "section"
            else None
        ),
        "sectionOrder": (
            int(metadata["sectionOrder"])
            if metadata.get("sectionOrder") is not None
            else None
        ),
    }


def build_manifest(items: list[dict[str, Any]]) -> dict[str, Any]:
    seen_ids: set[str] = set()
    seen_routes: set[str] = set()
    for item in items:
        if item["id"] in seen_ids:
            raise ImportError(f"duplicate advanced id: {item['id']}")
        if item["route"] in seen_routes:
            raise ImportError(f"duplicate advanced route: {item['route']}")
        seen_ids.add(item["id"])
        seen_routes.add(item["route"])

    domains = []
    for volume, (domain_id, domain_order) in DOMAIN_BY_VOLUME.items():
        chapter_ids = [
            item["id"] for item in items
            if item["domain"] == domain_id and item["kind"] == "chapter"
        ]
        domains.append({
            "id": domain_id,
            "title": volume,
            "order": domain_order,
            "chapterIds": chapter_ids,
        })
    return {
        "version": 1,
        "track": "advanced",
        "source": "AI-Agent-学习实践面试宝典-完整内容.zip",
        "domains": domains,
        "items": items,
    }
```

- [ ] **Step 4: Implement deterministic import**

Expose:

```python
def import_archive(archive: Path, output_root: Path) -> dict[str, Any]:
    members = discover_content_members(archive)
    items = []
    staged = Path(tempfile.mkdtemp(prefix=".advanced-import-", dir=output_root.parent))
    try:
        pages = staged / "pages"
        with ZipFile(archive) as source:
            for member in members:
                metadata, body = split_frontmatter(
                    source.read(member.archive_name).decode("utf-8")
                )
                item = build_item(metadata)
                cleaned = clean_markdown(body)
                validate_clean_markdown(cleaned, item["sourcePath"])
                target = pages / (item["slug"] + ".md")
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(cleaned, encoding="utf-8", newline="")
                item["contentPath"] = target.relative_to(staged).as_posix()
                items.append(item)
        manifest = build_manifest(items)
        (staged / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        replace_tree(staged, output_root)
        return manifest
    except Exception:
        shutil.rmtree(staged, ignore_errors=True)
        raise
```

Sort items with:

```python
items.sort(key=lambda item: (
    item["order"],
    item["sectionOrder"] if item["sectionOrder"] is not None else 0,
    item["slug"],
))
```

Reject duplicate IDs, slugs, routes, and duplicate `(parent, sectionOrder)` pairs.

Implement atomic directory replacement:

```python
def replace_tree(staged: Path, target: Path) -> None:
    backup = target.with_name(target.name + ".previous")
    if backup.exists():
        shutil.rmtree(backup)
    if target.exists():
        os.replace(target, backup)
    try:
        os.replace(staged, target)
    except Exception:
        if backup.exists() and not target.exists():
            os.replace(backup, target)
        raise
    shutil.rmtree(backup, ignore_errors=True)
```

- [ ] **Step 5: Import only the runnable example**

Copy these archive paths from `examples/context-engineering-agent/`:

```text
README.md
pyproject.toml
.env.example
src/context_agent/*.py
tests/test_*.py
sample_data/*
```

Exclude:

```text
*.egg-info/
__pycache__/
.pytest_cache/
.env
```

Write them under `examples/context-engineering-agent/`.

- [ ] **Step 6: Add CLI**

```python
def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "content" / "advanced",
    )
    args = parser.parse_args()
    manifest = import_archive(args.archive.resolve(), args.output.resolve())
    counts = Counter(item["kind"] for item in manifest["items"])
    print(
        "[PASS] advanced import: "
        f"chapters={counts['chapter']} sections={counts['section']} "
        f"appendices={counts['appendix']} guides={counts['guide']}"
    )
    return 0
```

- [ ] **Step 7: Run the real import**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 tools/import_advanced_handbook.py \
  --archive "$ADVANCED_SOURCE_ZIP"
```

Expected:

```text
[PASS] advanced import: chapters=31 sections=220 appendices=4 guides=1
```

- [ ] **Step 8: Audit generated content**

```bash
test "$(find content/advanced/pages -name '*.md' | wc -l | tr -d ' ')" = "256"
! rg 'TRAE_REF|^#{1,6} 图片生成描述' content/advanced/pages
test -f examples/context-engineering-agent/pyproject.toml
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest tests.test_advanced_import -v
PATH="$PWD/.venv/bin:$PATH" python -m pip install \
  -e "examples/context-engineering-agent[dev]"
PATH="$PWD/.venv/bin:$PATH" python -m pytest \
  examples/context-engineering-agent/tests -q
```

Expected: all commands exit zero.

- [ ] **Step 9: Document provenance**

`content/advanced/README.md` records:

```markdown
# Advanced handbook content

Source archive: `AI-Agent-学习实践面试宝典-完整内容.zip`

This directory contains normalized source content only. The bundled Astro site,
generated HTML, Pagefind output, caches, logs, and build metadata are excluded.

Regenerate with:

```bash
python3 tools/import_advanced_handbook.py --archive "$ADVANCED_SOURCE_ZIP"
```
```

- [ ] **Step 10: Commit**

```bash
git add tools/import_advanced_handbook.py tests/test_advanced_import.py \
  content/advanced examples/context-engineering-agent
git commit -m "content: import normalized advanced handbook"
```

## Phase 2: Advanced Reading Pages

### Task 4: Add the advanced content domain model

**Files:**
- Create: `tools/advanced_content.py`
- Create: `tests/test_advanced_site.py`

- [ ] **Step 1: Write failing manifest validation tests**

```python
class AdvancedManifestTests(unittest.TestCase):
    def test_real_manifest_has_expected_shape(self) -> None:
        manifest = load_advanced_manifest(ROOT / "content/advanced/manifest.json")
        kinds = Counter(item.kind for item in manifest.items)
        self.assertEqual(kinds["chapter"], 31)
        self.assertEqual(kinds["section"], 220)
        self.assertEqual(kinds["appendix"], 4)
        self.assertEqual(kinds["guide"], 1)
        self.assertEqual(len({item.route for item in manifest.items}), 256)

    def test_section_requires_existing_parent(self) -> None:
        orphan = AdvancedItem(
            id="advanced-ch27-context-budget",
            slug="chapter-27/context-budget",
            route="advanced/chapter-27/context-budget",
            kind="section",
            title="上下文预算与动态组装",
            description="预算说明",
            domain="advanced-frontier",
            order=23,
            source_path="source.md",
            content_path="pages/chapter-27/context-budget.md",
            parent="advanced-missing",
            section_order=3,
        )
        domain = AdvancedDomain(
            id="advanced-frontier",
            title="卷七 · 进阶专题",
            order=7,
            chapter_ids=(),
        )
        with self.assertRaisesRegex(BuildError, "missing parent"):
            validate_advanced_manifest(
                AdvancedManifest(
                    version=1,
                    track="advanced",
                    source="fixture.zip",
                    domains=(domain,),
                    items=(orphan,),
                )
            )
```

- [ ] **Step 2: Run and confirm red**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_site.AdvancedManifestTests -v
```

- [ ] **Step 3: Define immutable domain types**

```python
@dataclass(frozen=True)
class AdvancedItem:
    id: str
    slug: str
    route: str
    kind: Literal["chapter", "section", "appendix", "guide"]
    title: str
    description: str
    domain: str
    order: int
    source_path: str
    content_path: str
    parent: str | None = None
    section_order: int | None = None


@dataclass(frozen=True)
class AdvancedDomain:
    id: str
    title: str
    order: int
    chapter_ids: tuple[str, ...]


@dataclass(frozen=True)
class AdvancedManifest:
    version: int
    track: str
    source: str
    domains: tuple[AdvancedDomain, ...]
    items: tuple[AdvancedItem, ...]
```

Use `json.loads` and explicit field/type checks; never pass raw dictionaries to templates.

- [ ] **Step 4: Add route and neighbor helpers**

```python
def items_by_id(manifest: AdvancedManifest) -> dict[str, AdvancedItem]:
    return {item.id: item for item in manifest.items}


def chapter_pages(
    manifest: AdvancedManifest,
    chapter_id: str,
) -> tuple[AdvancedItem, ...]:
    chapter = items_by_id(manifest)[chapter_id]
    sections = sorted(
        (item for item in manifest.items if item.parent == chapter_id),
        key=lambda item: (item.section_order or 0, item.slug),
    )
    return (chapter, *sections)


def page_neighbors(
    manifest: AdvancedManifest,
    item_id: str,
) -> tuple[AdvancedItem | None, AdvancedItem | None]:
    guide = tuple(
        item for item in manifest.items if item.kind == "guide"
    )
    learning_path = tuple(
        item for domain in sorted(manifest.domains, key=lambda value: value.order)
        if domain.chapter_ids
        for chapter_id in domain.chapter_ids
        for item in chapter_pages(manifest, chapter_id)
    )
    appendices = tuple(sorted(
        (item for item in manifest.items if item.kind == "appendix"),
        key=lambda item: (item.order, item.slug),
    ))
    ordered = (*guide, *learning_path, *appendices)
    index = next(i for i, item in enumerate(ordered) if item.id == item_id)
    return (
        ordered[index - 1] if index > 0 else None,
        ordered[index + 1] if index + 1 < len(ordered) else None,
    )
```

The guide is first, the main learning path follows, and appendices are last.

- [ ] **Step 5: Run tests and commit**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_site.AdvancedManifestTests -v
git add tools/advanced_content.py tests/test_advanced_site.py
git commit -m "build: add advanced content model"
```

### Task 5: Render advanced Markdown pages

**Files:**
- Create: `templates/advanced.html`
- Create: `assets/advanced.css`
- Modify: `tools/advanced_content.py`
- Modify: `tools/build_pages.py`
- Modify: `tests/test_advanced_site.py`

- [ ] **Step 1: Write failing route generation tests**

```python
class AdvancedPageBuildTests(unittest.TestCase):
    def test_build_writes_chapter_section_and_appendix_routes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output)
            self.assertTrue((output / "advanced/chapter-27/index.html").is_file())
            self.assertTrue(
                (output / "advanced/chapter-27/context-budget/index.html").is_file()
            )
            self.assertTrue((output / "advanced/chapter-31/index.html").is_file())
            self.assertTrue((output / "advanced/appendix-b/index.html").is_file())

    def test_advanced_page_contains_only_selected_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output)
            page = (
                output / "advanced/chapter-27/context-problem/index.html"
            ).read_text(encoding="utf-8")
            self.assertIn("上下文工程解决什么问题", page)
            self.assertNotIn("裁判的三大系统性偏差", page)
```

- [ ] **Step 2: Run and confirm red**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_site.AdvancedPageBuildTests -v
```

- [ ] **Step 3: Render advanced Markdown**

```python
def render_advanced_markdown(path: Path) -> str:
    source = path.read_text(encoding="utf-8")
    return markdown.markdown(
        source,
        extensions=[
            "fenced_code",
            "tables",
            "attr_list",
            "md_in_html",
            "toc",
        ],
    )
```

Post-process internal links beginning `/advanced/` into page-relative links using:

```python
def relative_site_href(current_route: str, target_route: str) -> str:
    current_depth = len(PurePosixPath(current_route).parts)
    prefix = "../" * current_depth
    return prefix + target_route.strip("/") + "/"
```

- [ ] **Step 4: Create the reading template**

`templates/advanced.html` contains:

```html
<body class="advanced-page" data-page-id="{{PAGE_ID}}">
  <header class="advanced-topbar">{{TOPBAR}}</header>
  <div class="advanced-reading-shell">
    <aside class="advanced-book-nav">{{BOOK_NAV}}</aside>
    <main id="main-content" class="advanced-main">
      {{BREADCRUMB}}
      <header class="advanced-page-header">
        <span>{{PAGE_NUMBER}}</span>
        <h1>{{PAGE_TITLE}}</h1>
        <p>{{PAGE_DESCRIPTION}}</p>
      </header>
      <article class="advanced-prose">{{PAGE_CONTENT}}</article>
      {{PAGE_FOOTER}}
    </main>
    <aside class="advanced-page-toc">{{PAGE_TOC}}</aside>
  </div>
  <script>window.ADVANCED_PAGE = {{PAGE_CONTEXT}};</script>
  <script src="{{ASSET_PREFIX}}assets/advanced.js"></script>
</body>
```

Every placeholder is required exactly once. Use `escape()` for text and JSON-escape `</`.

- [ ] **Step 5: Add the advanced reading styles**

`assets/advanced.css` defines:

```css
.advanced-reading-shell {
  display: grid;
  grid-template-columns: minmax(210px, 260px) minmax(0, 760px) minmax(190px, 240px);
  justify-content: center;
}
.advanced-main { min-width: 0; padding: 3rem 2rem 5rem; }
.advanced-prose { font-family: var(--font-body); line-height: 1.85; }
.advanced-prose pre,
.advanced-prose .table-wrap { max-width: 100%; overflow-x: auto; }
@media (max-width: 980px) {
  .advanced-reading-shell { grid-template-columns: minmax(0, 1fr); }
  .advanced-book-nav,
  .advanced-page-toc { position: fixed; transform: translateX(-110%); }
}
```

Do not place cards inside cards. Keep page sections unframed; use cards only for repeated chapter items and dialogs.

- [ ] **Step 6: Integrate with `build_site()`**

Add:

```python
advanced_manifest = load_advanced_manifest(ADVANCED_MANIFEST_PATH)
for item in advanced_manifest.items:
    html = render_advanced_page(
        root=ROOT,
        manifest=advanced_manifest,
        item=item,
        template=ADVANCED_TEMPLATE_PATH.read_text(encoding="utf-8"),
    )
    target = output_dir / item.route / "index.html"
    atomic_write_text(target, html)
    outputs[item.route] = target
```

All asset and navigation URLs use route-depth-aware relative paths.

- [ ] **Step 7: Run tests and commit**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_site.AdvancedPageBuildTests -v
PATH="$PWD/.venv/bin:$PATH" npm run pages
git add templates/advanced.html assets/advanced.css tools/advanced_content.py \
  tools/build_pages.py tests/test_advanced_site.py
git commit -m "feat: publish advanced reading pages"
```

### Task 6: Add advanced reading progress and mobile drawers

**Files:**
- Create: `assets/advanced.js`
- Modify: `templates/advanced.html`
- Modify: `assets/advanced.css`
- Modify: `tests/test_advanced_site.py`

- [ ] **Step 1: Write failing state-contract tests**

```python
class AdvancedClientContractTests(unittest.TestCase):
    def test_advanced_state_is_separate_from_concise_state(self) -> None:
        script = (ROOT / "assets/advanced.js").read_text(encoding="utf-8")
        self.assertIn('"ah-advanced-learning-state"', script)
        self.assertIn('"ah-advanced-last-page"', script)
        self.assertNotIn('"ah-read-chapters"', script)
        self.assertIn("completedSections", script)
        self.assertIn("completedChapters", script)
```

- [ ] **Step 2: Run and confirm red**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_site.AdvancedClientContractTests -v
```

- [ ] **Step 3: Implement normalized advanced state**

```javascript
const STATE_KEY = "ah-advanced-learning-state";
const LAST_PAGE_KEY = "ah-advanced-last-page";

function emptyState() {
  return {
    completedSections: [],
    completedChapters: [],
    recent: [],
    lastPage: "",
    updatedAt: 0
  };
}

function normalizeState(value, validIds) {
  const state = value && typeof value === "object" ? value : {};
  const allowed = new Set(validIds);
  return {
    completedSections: [...new Set(
      (state.completedSections || []).filter(id => allowed.has(id))
    )],
    completedChapters: [...new Set(
      (state.completedChapters || []).filter(id => allowed.has(id))
    )],
    recent: (state.recent || [])
      .filter(item => item && allowed.has(item.id))
      .slice(0, 10),
    lastPage: allowed.has(state.lastPage) ? state.lastPage : "",
    updatedAt: Number(state.updatedAt) || 0
  };
}
```

- [ ] **Step 4: Derive chapter completion**

When a section is toggled:

1. update `completedSections`;
2. look up every section ID in the current chapter;
3. add the chapter ID only when all sections are complete;
4. write both state and `ah-advanced-last-page`;
5. dispatch `advanced-learning-state-change`.

- [ ] **Step 5: Implement drawers and reading position**

Use one drawer controller for the book and page TOC. Opening one closes the other. Save the current page and scroll ratio with a requestAnimationFrame-throttled scroll listener.

- [ ] **Step 6: Run tests and commit**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_site.AdvancedClientContractTests -v
node --check assets/advanced.js
git add assets/advanced.js assets/advanced.css templates/advanced.html \
  tests/test_advanced_site.py
git commit -m "feat: track advanced reading progress"
```

## Phase 3: Graph of Graphs

### Task 7: Build a validated hierarchical graph model

**Files:**
- Create: `tools/knowledge_graph.py`
- Create: `content/advanced/relations.json`
- Modify: `tools/handbook_build.py`
- Modify: `tests/test_advanced_site.py`

- [ ] **Step 1: Write failing graph tests**

```python
class KnowledgeGraphTests(unittest.TestCase):
    def test_advanced_graph_has_one_cluster_per_chapter(self) -> None:
        manifest = load_advanced_manifest(
            ROOT / "content/advanced/manifest.json"
        )
        graph = build_advanced_graph(manifest)
        clusters = [node for node in graph.nodes if node.kind == "chapter"]
        sections = [node for node in graph.nodes if node.kind == "section"]
        self.assertEqual(len(clusters), 31)
        self.assertEqual(len(sections), 220)
        for chapter in clusters:
            expected = len(chapter_pages(manifest, chapter.id)) - 1
            actual = sum(1 for node in sections if node.parent == chapter.id)
            self.assertEqual(actual, expected, chapter.id)

    def test_every_chapter_cluster_is_connected_to_the_global_graph(self) -> None:
        manifest = load_advanced_manifest(
            ROOT / "content/advanced/manifest.json"
        )
        graph = build_advanced_graph(manifest)
        reachable = traverse(graph, start="advanced-ch01")
        chapter_ids = {node.id for node in graph.nodes if node.kind == "chapter"}
        self.assertTrue(chapter_ids <= reachable)

    def test_invalid_relation_target_fails(self) -> None:
        manifest = load_advanced_manifest(
            ROOT / "content/advanced/manifest.json"
        )
        graph = build_advanced_graph(manifest)
        with self.assertRaisesRegex(BuildError, "unknown relation target"):
            validate_relations(graph, [{"from": "advanced-ch01", "to": "missing"}])
```

- [ ] **Step 2: Run and confirm red**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_site.KnowledgeGraphTests -v
```

- [ ] **Step 3: Define graph types**

```python
@dataclass(frozen=True)
class GraphNode:
    id: str
    track: Literal["concise", "advanced"]
    kind: Literal["domain", "chapter", "section", "appendix"]
    title: str
    route: str
    parent: str | None
    order: int


@dataclass(frozen=True)
class GraphEdge:
    source: str
    target: str
    type: Literal[
        "sequence", "prerequisite", "deep-dive",
        "related", "practice", "interview"
    ]


@dataclass(frozen=True)
class KnowledgeGraph:
    nodes: tuple[GraphNode, ...]
    edges: tuple[GraphEdge, ...]

    @property
    def node_ids(self) -> frozenset[str]:
        return frozenset(node.id for node in self.nodes)


@dataclass(frozen=True)
class CombinedKnowledgeGraph:
    concise: KnowledgeGraph
    advanced: KnowledgeGraph
    cross_edges: tuple[GraphEdge, ...]

    @property
    def node_ids(self) -> frozenset[str]:
        return self.concise.node_ids | self.advanced.node_ids


def traverse(graph: KnowledgeGraph, start: str) -> set[str]:
    adjacency: dict[str, set[str]] = defaultdict(set)
    for edge in graph.edges:
        adjacency[edge.source].add(edge.target)
        adjacency[edge.target].add(edge.source)
    visited: set[str] = set()
    pending = [start]
    while pending:
        node = pending.pop()
        if node in visited:
            continue
        visited.add(node)
        pending.extend(adjacency[node] - visited)
    return visited
```

- [ ] **Step 4: Generate internal and main-path edges**

For each chapter:

- add one chapter node;
- add section nodes;
- connect chapter landing to first section;
- connect sections by `sectionOrder`.

Connect chapter nodes in the required advanced order:

```python
ADVANCED_MAIN_PATH = (
    1, 2, 3,
    4, 5, 6, 7,
    8, 9, 10, 11,
    12, 13, 14, 15,
    16, 17, 18,
    19, 20,
    26, 27, 28, 29, 30,
    21, 22, 23, 24, 25, 31,
)
```

- [ ] **Step 5: Add curated relations**

`content/advanced/relations.json` starts with:

```json
[
  {"from": "advanced-ch04", "to": "advanced-ch27", "type": "prerequisite"},
  {"from": "advanced-ch05", "to": "advanced-ch27", "type": "prerequisite"},
  {"from": "advanced-ch16", "to": "advanced-ch28", "type": "prerequisite"},
  {"from": "advanced-ch18", "to": "advanced-ch30", "type": "related"},
  {"from": "advanced-ch11", "to": "advanced-ch20", "type": "practice"},
  {"from": "advanced-ch29", "to": "advanced-ch24", "type": "interview"},
  {"from": "advanced-ch26", "to": "advanced-ch19", "type": "practice"}
]
```

Add the concise-to-advanced `deep-dive` mappings from the design document.

- [ ] **Step 6: Build concise chapter subgraphs from `h3` headings**

Expose:

```python
def extract_heading_nodes(item_id: str, rendered_html: str) -> tuple[GraphNode, ...]:
    parser = HeadingParser()
    parser.feed(rendered_html)
    return tuple(
        GraphNode(
            id=heading.id,
            track="concise",
            kind="section",
            title=heading.text,
            route=item_id,
            parent=item_id,
            order=index,
        )
        for index, heading in enumerate(parser.headings, start=1)
    )
```

This makes every concise chapter a real subgraph rather than a single point.
Run the same extraction for manifest items whose kind is `lab`. If a concise
chapter or Lab has no `h3`, add one synthetic section node with ID
`{item_id}-overview`, the item title, and order `1`; no concise cluster may be
empty.

Expose the combined builder used by later tasks:

```python
def build_combined_graph(
    root: Path,
    concise_manifest: dict[str, Any],
    advanced_manifest: AdvancedManifest,
    relations_path: Path,
) -> CombinedKnowledgeGraph:
    concise = build_concise_graph(root, concise_manifest)
    advanced = build_advanced_graph(advanced_manifest)
    relations = load_relations(relations_path)
    internal, cross = partition_relations(relations, concise, advanced)
    return CombinedKnowledgeGraph(
        concise=with_relations(concise, internal["concise"]),
        advanced=with_relations(advanced, internal["advanced"]),
        cross_edges=tuple(cross),
    )
```

- [ ] **Step 7: Run tests and commit**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_site.KnowledgeGraphTests -v
git add tools/knowledge_graph.py tools/handbook_build.py \
  content/advanced/relations.json tests/test_advanced_site.py
git commit -m "feat: model hierarchical handbook graph"
```

### Task 8: Replace the star map with the dual-track graph-of-graphs

**Files:**
- Modify: `templates/learning-map.html`
- Modify: `assets/learning-map.css`
- Modify: `assets/learning-map.js`
- Modify: `tools/build_pages.py`
- Modify: `tests/test_advanced_site.py`

- [ ] **Step 1: Write failing homepage graph tests**

```python
def read_json_script(path: Path, element_id: str) -> dict[str, Any]:
    html = path.read_text(encoding="utf-8")
    match = re.search(
        rf'<script id="{re.escape(element_id)}" type="application/json">'
        r"(.*?)</script>",
        html,
        re.DOTALL,
    )
    if match is None:
        raise AssertionError(f"missing JSON script: {element_id}")
    return json.loads(match.group(1))


class DualTrackGraphPageTests(unittest.TestCase):
    def test_homepage_contains_both_track_graphs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output)
            data = read_json_script(output / "index.html", "starmapData")
            self.assertEqual(set(data["tracks"]), {"concise", "advanced"})
            self.assertEqual(
                len([n for n in data["tracks"]["advanced"]["nodes"]
                     if n["kind"] == "chapter"]),
                31,
            )
            self.assertEqual(
                len([n for n in data["tracks"]["advanced"]["nodes"]
                     if n["kind"] == "section"]),
                220,
            )

    def test_homepage_has_track_switch_and_subgraph_panel(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output)
            html = (output / "index.html").read_text(encoding="utf-8")
            self.assertIn('id="trackSwitcher"', html)
            self.assertIn('id="globalKnowledgeGraph"', html)
            self.assertIn('id="chapterSubgraph"', html)
            self.assertIn('id="chapterSectionList"', html)
```

- [ ] **Step 2: Run and confirm red**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_site.DualTrackGraphPageTests -v
```

- [ ] **Step 3: Extend the homepage template**

Add:

```html
<div id="trackSwitcher" class="track-switcher" role="group" aria-label="学习路线">
  <button type="button" data-track="concise">精炼版 · 28 星</button>
  <button type="button" data-track="advanced">进阶完整版 · 251 页</button>
</div>
<section class="knowledge-workspace">
  <svg id="globalKnowledgeGraph"
       role="img"
       aria-label="完整 Agent 知识图谱"></svg>
  <aside id="chapterGraphPanel" aria-live="polite">
    <svg id="chapterSubgraph" role="img"></svg>
    <nav id="chapterSectionList"></nav>
  </aside>
</section>
```

No-JavaScript fallback renders both track directories as normal links.

- [ ] **Step 4: Generate both graph payloads**

`build_pages.py` writes:

```json
{
  "defaultTrack": "concise",
  "tracks": {
    "concise": {"domains": [], "nodes": [], "edges": []},
    "advanced": {"domains": [], "nodes": [], "edges": []}
  }
}
```

The homepage JSON contains metadata and relationships only, never page bodies.

- [ ] **Step 5: Implement deterministic cluster layout**

In `assets/learning-map.js`:

```javascript
function layoutChapterClusters(graph, width, height) {
  const chapters = graph.nodes.filter(node => node.kind === "chapter");
  const columns = 7;
  return new Map(chapters.map((chapter, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const serpentine = row % 2 ? columns - 1 - column : column;
    return [
      chapter.id,
      {
        x: 72 + serpentine * ((width - 144) / (columns - 1)),
        y: 72 + row * ((height - 144) / Math.max(1, Math.ceil(chapters.length / columns) - 1))
      }
    ];
  }));
}
```

For each chapter center, lay out its section nodes radially with alternating radii. Draw:

1. section `sequence` edges;
2. chapter main-path edges;
3. curated relation edges.

- [ ] **Step 6: Implement focus and track switching**

Track switching:

- stores `ah-learning-track`;
- reads the matching progress key;
- clears and redraws the SVG without reloading;
- updates legend, counts, focused chapter, panel, and fallback state.

Clicking a chapter:

- adds `.is-muted` to other clusters;
- shows the chapter subgraph and section list;
- does not navigate until the user clicks a section or “enter chapter”.

- [ ] **Step 7: Implement zoom controls**

Maintain `{scale, x, y}` with limits `0.65 <= scale <= 2.4`. Apply one SVG viewport transform to the graph layer. Reset restores `{scale: 1, x: 0, y: 0}`. Respect `prefers-reduced-motion`.

- [ ] **Step 8: Run tests and commit**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_site.DualTrackGraphPageTests -v
node --check assets/learning-map.js
PATH="$PWD/.venv/bin:$PATH" npm run pages
git add templates/learning-map.html assets/learning-map.css \
  assets/learning-map.js tools/build_pages.py tests/test_advanced_site.py
git commit -m "feat: render dual-track graph of graphs"
```

### Task 9: Add mobile hierarchical navigation

**Files:**
- Modify: `assets/learning-map.css`
- Modify: `assets/learning-map.js`
- Modify: `tests/test_advanced_site.py`

- [ ] **Step 1: Write failing mobile contract tests**

```python
def test_mobile_graph_uses_domain_chapter_and_section_levels() -> None:
    script = (ROOT / "assets/learning-map.js").read_text(encoding="utf-8")
    self.assertIn("renderMobileDomains", script)
    self.assertIn("renderMobileChapterGraph", script)
    css = (ROOT / "assets/learning-map.css").read_text(encoding="utf-8")
    self.assertIn("@media (max-width: 768px)", css)
    self.assertIn("min-height: 44px", css)
```

- [ ] **Step 2: Implement mobile domain accordions**

At `max-width: 768px`:

- hide the global SVG;
- show one `<details>` per domain;
- render each chapter as a row with a mini section-node sparkline;
- expand the current domain;
- clicking a chapter opens the chapter panel below the row;
- section links remain at least 44px tall.

- [ ] **Step 3: Run tests and commit**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_site.DualTrackGraphPageTests -v
git add assets/learning-map.css assets/learning-map.js tests/test_advanced_site.py
git commit -m "feat: add mobile hierarchical graph navigation"
```

## Phase 4: Unified Search and Cross-Track Relations

### Task 10: Generate a lazy unified search index

**Files:**
- Create: `tools/search_index.py`
- Create: `assets/unified-search.js`
- Modify: `templates/learning-map.html`
- Modify: `templates/advanced.html`
- Modify: `templates/handbook.html`
- Modify: `tools/build_pages.py`
- Modify: `tests/test_advanced_site.py`

- [ ] **Step 1: Write failing search-index tests**

```python
class UnifiedSearchTests(unittest.TestCase):
    def test_index_contains_both_tracks(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output)
            index = json.loads((output / "search-index.json").read_text())
            tracks = {document["track"] for document in index["documents"]}
            self.assertEqual(tracks, {"concise", "advanced"})
            self.assertTrue(any(d["route"] == "ch4" for d in index["documents"]))
            self.assertTrue(any(
                d["route"] == "advanced/chapter-27/context-budget"
                for d in index["documents"]
            ))
```

- [ ] **Step 2: Implement text extraction**

```python
@dataclass(frozen=True)
class SearchDocument:
    id: str
    track: Literal["concise", "advanced"]
    kind: str
    title: str
    description: str
    route: str
    chapter: str
    domain: str
    tags: tuple[str, ...]
    text: str


def normalize_search_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().lower()
```

Strip Markdown syntax and HTML tags with parsers, not raw tag-removal regex. Cap each body at 16,000 normalized characters. Write compact UTF-8 JSON only after all routes are known.

Set `tags` deterministically:

- add `"code"` when the Markdown contains a fenced code block;
- add `"interview"` when the domain is `advanced-interview` or the concise item is an interview chapter;
- add the page kind (`chapter`, `section`, `appendix`, or `lab`).

The browser filters use these tags rather than guessing from titles.

- [ ] **Step 3: Add search dialog markup**

Each template contains one dialog:

```html
<dialog id="unifiedSearch" class="unified-search">
  <form method="dialog">
    <button aria-label="关闭搜索">×</button>
  </form>
  <input type="search" placeholder="搜索概念、框架、代码或面试题">
  <div role="group" aria-label="搜索范围">
    <button data-filter="all">全部</button>
    <button data-filter="concise">精炼版</button>
    <button data-filter="advanced">进阶完整版</button>
    <button data-filter="code">代码示例</button>
    <button data-filter="interview">面试题</button>
  </div>
  <p aria-live="polite" data-search-status></p>
  <ol data-search-results></ol>
</dialog>
```

- [ ] **Step 4: Implement lazy browser search**

`assets/unified-search.js` fetches `search-index.json` only when the dialog first opens. Resolve the index URL from `data-site-root` on `<body>`.

Ranking:

```javascript
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
```

Render at most 20 results and escape text through DOM `textContent`.

- [ ] **Step 5: Run tests and commit**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_site.UnifiedSearchTests -v
node --check assets/unified-search.js
git add tools/search_index.py assets/unified-search.js \
  templates/learning-map.html templates/advanced.html templates/handbook.html \
  tools/build_pages.py tests/test_advanced_site.py
git commit -m "feat: add unified handbook search"
```

### Task 11: Surface cross-track deep dives without sharing progress

**Files:**
- Create: `content/track-mapping.json`
- Modify: `tools/knowledge_graph.py`
- Modify: `tools/build_pages.py`
- Modify: `templates/handbook.html`
- Modify: `templates/advanced.html`
- Modify: `tests/test_advanced_site.py`

- [ ] **Step 1: Add the explicit mapping file**

Use the complete mapping from the design document:

```json
{
  "ch1": ["advanced-ch01", "advanced-ch03"],
  "ch2": ["advanced-ch02"],
  "ch3": ["advanced-ch04", "advanced-ch07", "advanced-ch10", "advanced-ch11"],
  "ch4": ["advanced-ch27"],
  "ch5": ["advanced-ch05"],
  "ch6": ["advanced-ch09"],
  "ch7": ["advanced-ch12", "advanced-ch15"],
  "ch8": ["advanced-ch13"],
  "ch9": ["advanced-ch14"],
  "ch10": ["advanced-ch19", "advanced-ch26"],
  "ch11": ["advanced-ch16", "advanced-ch17", "advanced-ch28"],
  "ch12": ["advanced-ch18", "advanced-ch20"],
  "ch13": ["advanced-ch21", "advanced-ch22", "advanced-ch23", "advanced-ch24", "advanced-ch25", "advanced-ch31"],
  "ch14": ["advanced-ch25"],
  "ch15": ["advanced-guide", "advanced-appendix-a", "advanced-appendix-b", "advanced-appendix-c", "advanced-appendix-d"],
  "ch19": ["advanced-ch29"],
  "ch20": ["advanced-ch18", "advanced-ch30"],
  "ch22": ["advanced-ch04"]
}
```

Unmapped concise chapters remain valid and show no deep-dive card.

- [ ] **Step 2: Implement strict mapping loading**

```python
def load_track_mapping(path: Path) -> dict[str, tuple[str, ...]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise BuildError("track mapping must be an object")
    mapping: dict[str, tuple[str, ...]] = {}
    for concise_id, targets in raw.items():
        if not isinstance(concise_id, str) or not isinstance(targets, list):
            raise BuildError(f"invalid track mapping entry: {concise_id}")
        if not all(isinstance(target, str) for target in targets):
            raise BuildError(f"invalid track targets: {concise_id}")
        mapping[concise_id] = tuple(targets)
    return mapping
```

- [ ] **Step 3: Write failing mapping tests**

```python
def test_track_mapping_targets_exist_and_does_not_share_progress() -> None:
    mapping = load_track_mapping(ROOT / "content/track-mapping.json")
    graph = build_combined_graph(
        root=ROOT,
        concise_manifest=load_manifest(ROOT / "content/book.json"),
        advanced_manifest=load_advanced_manifest(
            ROOT / "content/advanced/manifest.json"
        ),
        relations_path=ROOT / "content/advanced/relations.json",
    )
    self.assertTrue(all(target in graph.node_ids for targets in mapping.values()
                        for target in targets))
    concise = (ROOT / "assets/learner-guide.js").read_text(encoding="utf-8")
    advanced = (ROOT / "assets/advanced.js").read_text(encoding="utf-8")
    self.assertNotIn("ah-advanced-learning-state", concise)
    self.assertNotIn("ah-read-chapters", advanced)
```

- [ ] **Step 4: Render corresponding-reading cards**

Concise pages show:

```html
<aside class="deep-dive-links">
  <h2>进阶完整版对应阅读</h2>
  <a href="../advanced/chapter-27/">第 27 章 · 上下文工程</a>
</aside>
```

Advanced pages show the reverse “精炼版速览” links. These are navigation hints only and never mutate the other track’s state.

- [ ] **Step 5: Add graph `deep-dive` edges**

Convert each mapping pair into a `GraphEdge(type="deep-dive")`. Render these edges only when the UI enables “跨路线关联”, so the default graph remains readable.

- [ ] **Step 6: Run tests and commit**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_advanced_site -v
git add content/track-mapping.json tools/knowledge_graph.py tools/build_pages.py \
  templates/handbook.html templates/advanced.html tests/test_advanced_site.py
git commit -m "feat: link concise and advanced tracks"
```

## Phase 5: Verification and Release

### Task 12: Extend source and site verification

**Files:**
- Modify: `tools/verify_handbook.py`
- Modify: `tests/test_advanced_site.py`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Write failing advanced verifier tests**

```python
def copy_advanced_fixture(target: Path) -> Path:
    content = target / "content"
    content.mkdir(parents=True)
    shutil.copytree(
        ROOT / "content/advanced",
        content / "advanced",
    )
    shutil.copy2(
        ROOT / "content/track-mapping.json",
        content / "track-mapping.json",
    )
    return target


class AdvancedVerifyTests(unittest.TestCase):
    def test_real_advanced_source_is_clean(self) -> None:
        self.assertEqual(verify_advanced_source(ROOT), [])

    def test_verifier_rejects_residual_author_markers(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = copy_advanced_fixture(Path(tmp))
            page = next((root / "content/advanced/pages").rglob("*.md"))
            page.write_text("[$TRAE_REF](https://example.com)", encoding="utf-8")
            self.assertTrue(any("TRAE_REF" in error
                                for error in verify_advanced_source(root)))
```

- [ ] **Step 2: Implement advanced source verification**

Validate:

- exact item counts;
- item content files exist;
- unique IDs, slugs, routes;
- every section parent exists;
- domain chapter IDs exist;
- relation endpoints and types are valid;
- no `TRAE_REF` or visible image-generation headings;
- no imported Astro, Pagefind, cache, log, PID, or egg-info files.

- [ ] **Step 3: Extend site verification**

Expected routes are the union of concise `PageSpec.route` and all advanced item routes. Validate `search-index.json` routes and sitemap entries against the same set.

- [ ] **Step 4: Include new tests in `npm test`**

```json
"test": "python3 -m unittest tests.test_build_system tests.test_pages_site tests.test_advanced_import tests.test_advanced_site -v && node --test tests/test_export_pdf.js"
```

- [ ] **Step 5: Update README**

Document:

- source archive is not committed;
- normalized advanced content is committed;
- regeneration command;
- `/advanced/` routes;
- dual-track progress keys;
- current full HTML/PDF remain concise-only;
- unified search index is lazy-loaded.

- [ ] **Step 6: Run full verification**

```bash
PATH="$PWD/.venv/bin:$PATH" npm test
PATH="$PWD/.venv/bin:$PATH" npm run build
SITE_URL="https://liyurun.github.io/agent_learn/" \
  PATH="$PWD/.venv/bin:$PATH" npm run pages
PATH="$PWD/.venv/bin:$PATH" npm run verify
```

Expected: all commands pass, `dist/` contains 34 existing pages plus 256 advanced pages.

- [ ] **Step 7: Commit**

```bash
git add tools/verify_handbook.py tests/test_advanced_site.py \
  package.json README.md
git commit -m "test: verify dual-track handbook"
```

### Task 13: Browser, performance, and PDF acceptance

**Files:**
- Modify only for defects found: `templates/*.html`
- Modify only for defects found: `assets/*.css`
- Modify only for defects found: `assets/*.js`
- Modify only for defects found: `tools/*.py`
- Modify only for defects found: `tests/*.py`

- [ ] **Step 1: Build and start local preview**

```bash
PATH="$PWD/.venv/bin:$PATH" npm test
PATH="$PWD/.venv/bin:$PATH" npm run build
PATH="$PWD/.venv/bin:$PATH" npm run pages
PATH="$PWD/.venv/bin:$PATH" npm run verify
python3 -m http.server 4173 --directory dist
```

- [ ] **Step 2: Desktop graph-of-graphs checks**

At `1440x1000`, verify:

- the route switch changes between concise and advanced without reload;
- advanced view has 31 chapter clusters and 220 section nodes;
- every chapter cluster is connected to the main path;
- clicking chapter 27 updates the chapter subgraph to 10 sections;
- clicking `context-budget` opens `/advanced/chapter-27/context-budget/`;
- zoom controls preserve labels and never resize the surrounding layout;
- enabling cross-track relations shows `deep-dive` edges;
- console and network contain no errors.

Capture screenshots of both tracks and the focused chapter 27 state.

- [ ] **Step 3: Advanced reading checks**

Verify:

- direct refresh of `/advanced/chapter-27/context-budget/`;
- book navigation, page TOC, previous/next links;
- completion updates only `ah-advanced-learning-state`;
- concise `ah-read-chapters` remains unchanged;
- reverse “精炼版速览” link reaches `/ch4/`;
- code, tables, citations, and long Chinese text do not overflow.

- [ ] **Step 4: Mobile checks**

At an iPhone 14 viewport:

- global SVG is replaced by domain accordions;
- each chapter row contains a mini subgraph;
- one chapter expands to section links;
- touch targets are at least 44px;
- reading drawers are mutually exclusive;
- no page-level horizontal overflow.

- [ ] **Step 5: Search checks**

Open search with `Cmd/Ctrl+K`, search `上下文预算`, and verify:

- concise and advanced results are labeled;
- filters change the result set;
- result navigation opens the correct route;
- the search index is fetched only after opening the dialog.

- [ ] **Step 6: Performance checks**

Assert:

```text
Homepage HTML does not contain advanced page bodies.
Homepage graph JSON is below 500 KB.
search-index.json is fetched lazily.
No advanced content page loads another page body.
```

Record transfer sizes for `/`, `/advanced/chapter-27/`, and one section page.

- [ ] **Step 7: PDF regression**

Use a Chrome for Testing version compatible with `puppeteer-core 24.16`:

```bash
CHROME_PATH=/absolute/path/to/chrome-headless-shell \
  PATH="$PWD/.venv/bin:$PATH" npm run pdf
```

Expected: the existing concise full-book PDF still exceeds 250 pages. Do not add all advanced pages to this PDF in this scope.

- [ ] **Step 8: Commit browser-found fixes**

If files changed:

```bash
git add templates assets tools tests
git commit -m "fix: polish dual-track handbook experience"
```

Do not create an empty commit.

### Task 14: Publish and verify GitHub Pages

**Files:**
- No planned source changes

- [ ] **Step 1: Final repository audit**

```bash
git status --short
git diff --check main...HEAD
git log --oneline main..HEAD
```

Expected: clean worktree and intentional task commits only.

- [ ] **Step 2: Fast-forward main and push**

```bash
git switch main
git merge --ff-only feat/dual-track-handbook-fusion
git push origin main
```

- [ ] **Step 3: Wait for the latest Pages workflow**

Confirm the workflow for the pushed SHA finishes with `success`.

- [ ] **Step 4: Verify production**

```bash
curl -fsSL 'https://liyurun.github.io/agent_learn/' | \
  grep 'globalKnowledgeGraph'
curl -fsSL 'https://liyurun.github.io/agent_learn/advanced/chapter-27/' | \
  grep '上下文工程'
curl -fsSL 'https://liyurun.github.io/agent_learn/search-index.json' | \
  grep 'advanced/chapter-27/context-budget'
```

Expected: all commands exit zero.

## Final Acceptance

- Current concise URLs and content remain available.
- The route switch exposes two separately tracked learning paths.
- Advanced content contains 31 chapter pages, 220 section pages, 4 appendices, and one guide.
- Every chapter is a connected subgraph; every chapter subgraph connects into the global graph.
- The homepage contains graph metadata only, not advanced article bodies.
- Unified search covers both tracks and labels result origin.
- Imported learner-facing Markdown contains no author-only image prompts or `TRAE_REF`.
- Mobile navigation remains readable and does not shrink the full graph.
- Existing complete HTML and PDF remain valid.
- Unit, site, browser, performance, and deployment verification all pass.

## Self-Review

- Spec coverage: Tasks 1–3 cover import and cleaning; Tasks 4–6 cover advanced routes and progress; Tasks 7–9 cover the graph-of-graphs and mobile; Tasks 10–11 cover search and cross-track relations; Tasks 12–14 cover verification, regression, and release.
- Placeholder scan: no deferred implementation marker, unspecified error handling step, or generic “write tests” instruction remains.
- Type consistency: `AdvancedItem`, `AdvancedManifest`, `GraphNode`, `GraphEdge`, `KnowledgeGraph`, `build_site`, and the three progress keys use one spelling throughout.
- Scope: the plan does not import Astro, share progress between tracks, add authentication, add cloud sync, or expand the existing concise PDF.
