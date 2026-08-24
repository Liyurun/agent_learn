# Learning Starmap Multipage Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a distinctive knowledge-starmap homepage and one static route per handbook section so readers only load the content they open, while preserving the complete HTML and PDF build.

**Architecture:** Keep `tools/build.py` as the full-book/PDF source and add reusable route, page-context, and link-rewrite primitives to `tools/handbook_build.py`. Rework `tools/build_pages.py` into an atomic static-site generator that renders a dedicated star-map template for `/` and parameterized handbook pages for all content routes. Shared client scripts consume generated page metadata so progress, previous/next links, old hash bookmarks, and dynamic cross-page links remain correct.

**Tech Stack:** Python 3.11+, `html.parser`, Python Markdown, HTML/CSS, vanilla JavaScript, SVG, `localStorage`, Node test runner, Puppeteer/Chromium, GitHub Pages.

---

## File Structure

**Create**

- `templates/learning-map.html`: semantic homepage shell and no-JavaScript fallback.
- `assets/learning-map.css`: desktop star map and mobile constellation-track presentation.
- `assets/learning-map.js`: SVG constellation rendering, focus behavior, progress, legacy hash redirects, and mobile expansion.
- `tests/test_pages_site.py`: route, page generation, rewriting, sitemap, and site verification tests.

**Modify**

- `tools/handbook_build.py`: page specifications, route index, URL resolution, anchor ownership, and page context.
- `tools/build.py`: parameterized document rendering while retaining the existing full-book output.
- `tools/build_pages.py`: atomic generation of the complete multipage `dist/` tree.
- `templates/handbook.html`: page metadata, asset-prefix, cover, body-class, home-link, and page-context placeholders.
- `assets/handbook-interactions.js`: resolve data-driven internal links through the generated route map.
- `assets/learner-guide.js`: use global chapter order for numbering and cross-page previous/next navigation.
- `tools/verify_handbook.py`: verify every generated page, cross-page target, resource, and expected route.
- `tests/test_build_system.py`: preserve full-book behavior and test parameterized navigation.
- `.github/workflows/deploy-pages.yml`: provide the canonical site URL and run site verification.
- `README.md`: document routes, local preview, and the retained full-book/PDF workflow.
- `.gitignore`: exclude `.superpowers/` visual-companion artifacts.

## Route Contract

Use these exact route owners:

```python
SPECIAL_PAGES = (
    PageSpec("", "学习星图", ()),
    PageSpec("guide", "学习导读", ("learningModes", "moduleAtlas", "intro")),
    PageSpec("quiz", "模块复盘", ("moduleQuizHub",)),
    PageSpec("insights", "大牛观点", ("insights",)),
    PageSpec("labs", "实战工坊", ("labs-intro",)),
    PageSpec("resources", "参考资源", ("references", "footer-note")),
)
```

Every manifest item with `kind == "chapter"` or `kind == "lab"` owns `/<id>/`. Part divider anchors are aliases to the first chapter/Lab in that part:

```python
PART_ROUTE_ALIASES = {
    "part1": "ch1",
    "part2": "ch4",
    "part3": "ch8",
    "part4": "ch13",
    "part5": "ch16",
    "part6": "labs",
}
```

All generated content routes are exactly one directory below `dist/`.

### Task 1: Add the route and anchor model

**Files:**
- Modify: `tools/handbook_build.py:13-17, 187-274`
- Create: `tests/test_pages_site.py`

- [ ] **Step 1: Write failing route-model tests**

Add tests that load the real manifest and assert:

```python
from tools.handbook_build import (
    build_anchor_route_index,
    build_page_specs,
    normalize_standalone_fragment,
    resolve_site_href,
)


def test_page_specs_cover_all_public_content():
    manifest = load_manifest(ROOT / "content" / "book.json")
    specs = build_page_specs(manifest)
    routes = {spec.route for spec in specs}
    assert {"", "guide", "quiz", "insights", "labs", "resources"} <= routes
    assert {f"ch{i}" for i in range(1, 25)} <= routes
    assert {f"lab{i}" for i in range(1, 5)} <= routes
    assert len(routes) == len(specs)


def test_anchor_route_index_maps_part_aliases_and_citations():
    manifest = load_manifest(ROOT / "content" / "book.json")
    rendered = render_manifest_items(ROOT, manifest)
    index = build_anchor_route_index(manifest, rendered)
    assert index["part1"] == "ch1"
    assert index["part6"] == "labs"
    assert index["cite-1"] == "resources"


def test_resolve_site_href_keeps_local_fragment_and_rewrites_remote_fragment():
    index = {"ch7": "ch7", "ch7-section-01": "ch7", "cite-1": "resources"}
    assert resolve_site_href("#ch7-section-01", "ch7", index) == "#ch7-section-01"
    assert resolve_site_href("#cite-1", "ch7", index) == "../resources/#cite-1"
    assert resolve_site_href("https://example.com", "ch7", index) == "https://example.com"


def test_standalone_fragment_removes_only_migration_page_boundary():
    source = (
        '<section id="ch3"><div>正文</div></section>\n'
        '</div><!-- /page -->\n'
    )
    assert normalize_standalone_fragment(source) == (
        '<section id="ch3"><div>正文</div></section>\n'
    )
    assert normalize_standalone_fragment(
        '<section id="ch2"><div>正文</div></section>\n'
    ) == '<section id="ch2"><div>正文</div></section>\n'
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_pages_site.PageModelTests -v
```

Expected: import errors for the three new functions.

- [ ] **Step 3: Add focused page model types and functions**

Add the following public model and signatures to `tools/handbook_build.py`:

```python
from dataclasses import dataclass
from urllib.parse import urlsplit


@dataclass(frozen=True)
class PageSpec:
    route: str
    title: str
    item_ids: tuple[str, ...]


def build_page_specs(manifest: dict[str, Any]) -> list[PageSpec]:
    """Return unique public pages in deterministic output order."""


def render_manifest_items(
    root: Path,
    manifest: dict[str, Any],
) -> dict[str, str]:
    """Render every manifest item once, keyed by item id."""


def build_anchor_route_index(
    manifest: dict[str, Any],
    rendered_items: dict[str, str],
) -> dict[str, str]:
    """Map every emitted anchor, plus part aliases, to one public route."""


def resolve_site_href(
    href: str,
    current_route: str,
    anchor_routes: dict[str, str],
) -> str:
    """Resolve an internal fragment to a page-relative URL; preserve external URLs."""


def normalize_standalone_fragment(html: str) -> str:
    """Remove the one legacy page-boundary close emitted by migrated chunks."""
```

Raise `BuildError` for duplicate routes, duplicate anchor ownership, missing special-page items, or an unresolved `#fragment`.

- [ ] **Step 4: Run the route tests**

Run the command from Step 2.

Expected: all `PageModelTests` pass.

- [ ] **Step 5: Commit the route model**

```bash
git add tools/handbook_build.py tests/test_pages_site.py
git commit -m "build: add handbook page route model"
```

### Task 2: Make the handbook document renderer page-aware

**Files:**
- Modify: `templates/handbook.html:1-32, 962-1030`
- Modify: `tools/build.py:25-75`
- Modify: `tools/handbook_build.py:180-274`
- Modify: `tests/test_build_system.py`
- Modify: `tests/test_pages_site.py`

- [ ] **Step 1: Write failing template and navigation tests**

Test that the template contains each placeholder exactly once:

```python
for placeholder in (
    "{{PAGE_TITLE}}",
    "{{PAGE_DESCRIPTION}}",
    "{{ASSET_PREFIX}}",
    "{{BODY_CLASS}}",
    "{{BOOK_COVER}}",
    "{{BOOK_PAGE_CONTEXT}}",
):
    self.assertEqual(template.count(placeholder), 1)
```

Add a navigation test using a route resolver:

```python
navigation = render_top_navigation(
    manifest,
    href_for=lambda target: f"../{target.strip('#')}/",
    home_href="../",
)
self.assertIn('href="../ch7/"', navigation)
self.assertIn('href="../resources/"', navigation)
```

- [ ] **Step 2: Run tests and confirm the new assertions fail**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_build_system.BuildCoreTests \
  tests.test_pages_site.TemplateTests -v
```

Expected: missing placeholders and unsupported `render_top_navigation` arguments.

- [ ] **Step 3: Parameterize the template without changing full-book behavior**

Replace literal values in `templates/handbook.html`:

```html
<title>{{PAGE_TITLE}}</title>
<meta name="description" content="{{PAGE_DESCRIPTION}}">
<body class="{{BODY_CLASS}}">
<a class="brand" href="{{HOME_HREF}}">Agent 宝典 <span>/ 2026</span></a>
{{BOOK_COVER}}
<script>window.HANDBOOK_PAGE = {{BOOK_PAGE_CONTEXT}};</script>
<script src="{{ASSET_PREFIX}}/_shared/js/mermaid.min.js"></script>
<script src="{{ASSET_PREFIX}}/assets/handbook-interactions.js"></script>
```

Move the existing cover markup unchanged into a `FULL_BOOK_COVER` constant in `tools/build.py`. Add:

```python
def render_document(
    *,
    template: str,
    manifest: dict[str, Any],
    content: str,
    title: str,
    description: str,
    body_class: str,
    asset_prefix: str,
    home_href: str,
    cover_html: str,
    page_context: dict[str, Any],
    href_for: Callable[[str], str] | None = None,
) -> str:
    html = replace_single_placeholder(
        template, NAV_PLACEHOLDER,
        render_top_navigation(manifest, href_for=href_for, home_href=home_href),
    )
    replacements = {
        "{{PAGE_TITLE}}": escape(title),
        "{{PAGE_DESCRIPTION}}": escape(description, quote=True),
        "{{ASSET_PREFIX}}": asset_prefix,
        "{{BODY_CLASS}}": escape(body_class, quote=True),
        "{{HOME_HREF}}": home_href,
        "{{BOOK_COVER}}": cover_html,
        "{{BOOK_PAGE_CONTEXT}}": json.dumps(
            page_context, ensure_ascii=False, separators=(",", ":")
        ).replace("</", "<\\/"),
        CONTENT_PLACEHOLDER: content,
    }
    for placeholder, value in replacements.items():
        html = replace_single_placeholder(html, placeholder, value)
    return html if html.startswith(GENERATED_COMMENT) else GENERATED_COMMENT + "\n" + html
```

`build()` calls `render_document` with the original title, cover, `"full-book"`, `"."`, `"#"`, and anchor navigation. Its generated content and anchor order must remain unchanged.

- [ ] **Step 4: Add site-mode navigation links**

Change `render_top_navigation` to:

```python
def render_top_navigation(
    manifest: dict[str, Any],
    href_for: Callable[[str], str] | None = None,
    home_href: str = "#",
) -> str:
    link_for = href_for or (lambda target: target)
```

Use `link_for(f"#{item_id}")` for menu links and `link_for("#resources")` for resources. Keep the existing default output byte-compatible with the full-book build.

- [ ] **Step 5: Run the full-book regression**

```bash
PATH="$PWD/.venv/bin:$PATH" npm test
PATH="$PWD/.venv/bin:$PATH" npm run build
PATH="$PWD/.venv/bin:$PATH" npm run verify
```

Expected: all tests pass and the complete HTML still verifies.

- [ ] **Step 6: Commit page-aware rendering**

```bash
git add templates/handbook.html tools/build.py tools/handbook_build.py \
  tests/test_build_system.py tests/test_pages_site.py
git commit -m "refactor: support page-aware handbook rendering"
```

### Task 3: Generate isolated content pages

**Files:**
- Modify: `tools/build_pages.py:1-50`
- Modify: `tests/test_pages_site.py`

- [ ] **Step 1: Write a failing multipage build test**

Use a temporary output directory and assert:

```python
class PageBuildTests(unittest.TestCase):
    def test_build_site_writes_isolated_routes(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(
                output_dir=output,
                site_url="https://example.test/book/",
            )
            self.assertTrue((output / "index.html").is_file())
            self.assertTrue((output / "ch1" / "index.html").is_file())
            self.assertTrue((output / "lab4" / "index.html").is_file())
            self.assertTrue((output / "resources" / "index.html").is_file())

            chapter = (output / "ch7" / "index.html").read_text(encoding="utf-8")
            self.assertIn('id="ch7"', chapter)
            self.assertNotIn('id="ch8"', chapter)
            self.assertIn("../assets/handbook-interactions.js", chapter)
```

Use `tempfile.TemporaryDirectory()` rather than pytest fixtures because the repository uses `unittest`.

- [ ] **Step 2: Run the focused test and confirm it fails**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_pages_site.PageBuildTests.test_build_site_writes_isolated_routes -v
```

Expected: `build_site` is not defined.

- [ ] **Step 3: Implement page assembly**

Expose:

```python
def build_site(
    output_dir: Path = DIST_PATH,
    site_url: str | None = None,
) -> dict[str, Path]:
    manifest = load_manifest(MANIFEST_PATH)
    rendered = render_manifest_items(ROOT, manifest)
    specs = build_page_specs(manifest)
    anchor_routes = build_anchor_route_index(manifest, rendered)
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    outputs: dict[str, Path] = {}

    write_learning_map(
        output_dir / "index.html",
        manifest=manifest,
        specs=specs,
        anchor_routes=anchor_routes,
        site_url=site_url,
    )
    outputs[""] = output_dir / "index.html"

    for spec in specs:
        if not spec.route:
            continue
        content = render_page_content(spec, manifest, rendered, anchor_routes)
        context = build_page_context(spec, manifest, anchor_routes)
        html = render_document(
            template=template,
            manifest=manifest,
            content=content,
            title=f"{spec.title} · Agent 学习与面试宝典",
            description=f"Agent 学习与面试宝典：{spec.title}",
            body_class="content-page",
            asset_prefix="..",
            home_href="../",
            cover_html="",
            page_context=context,
            href_for=lambda href, route=spec.route: resolve_site_href(
                href, route, anchor_routes
            ),
        )
        target = output_dir / spec.route / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html, encoding="utf-8", newline="")
        outputs[spec.route] = target

    return outputs
```

For each `PageSpec`:

1. concatenate only `spec.item_ids`;
2. run `normalize_standalone_fragment()` on each selected item;
3. replace `{{BOOK_TOC}}` when present;
4. rewrite static internal `href="#..."` values with an `HTMLParser`-based transformer;
5. inject `window.HANDBOOK_PAGE`;
6. write `<output_dir>/<route>/index.html`.

Do not use regex to rewrite HTML attributes. Keep temporary-directory and `os.replace` publication semantics from the current `main()`.
`normalize_standalone_fragment()` may remove only the exact trailing migration marker
`</div><!-- /page -->`; it must not attempt general HTML repair or mutate the source
files. Add generated-page assertions that `ch3`, `ch7`, `ch12`, `ch15`, `ch24`,
`lab4`, and `insights` have balanced `<div>` tags.

- [ ] **Step 4: Build page context deterministically**

Add:

```python
def build_page_context(
    spec: PageSpec,
    manifest: dict[str, Any],
    anchor_routes: dict[str, str],
) -> dict[str, Any]:
    items = [
        item for item in manifest["items"]
        if item["kind"] in {"chapter", "lab"}
    ]
    entries = [
        {
            "id": item["id"],
            "title": item["title"],
            "number": str(item.get("number", "")),
            "group": item.get("toc_group", ""),
            "route": item["id"],
            "href": f"../{item['id']}/",
        }
        for item in items
    ]
    current_id = spec.item_ids[0] if len(spec.item_ids) == 1 else None
    current_index = next(
        (index for index, item in enumerate(items) if item["id"] == current_id),
        None,
    )

    def adjacent(offset: int) -> dict[str, str] | None:
        if current_index is None:
            return None
        target_index = current_index + offset
        if target_index < 0 or target_index >= len(entries):
            return None
        return entries[target_index]

    return {
        "id": current_id or spec.route or "home",
        "title": spec.title,
        "route": spec.route,
        "entries": entries,
        "previous": adjacent(-1),
        "next": adjacent(1),
        "anchorRoutes": anchor_routes,
    }
```

`entries` includes all chapter/Lab IDs, titles, numbers, groups, and routes in manifest order. `previous` and `next` only traverse chapters and Labs.

- [ ] **Step 5: Run isolated-page tests and the real build**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest tests.test_pages_site.PageBuildTests -v
PATH="$PWD/.venv/bin:$PATH" npm run pages
test -f dist/ch24/index.html
test -f dist/lab4/index.html
```

Expected: tests pass and all expected files exist.

- [ ] **Step 6: Commit multipage generation**

```bash
git add tools/build_pages.py tools/handbook_build.py tests/test_pages_site.py
git commit -m "feat: generate isolated handbook pages"
```

### Task 4: Build the knowledge-starmap homepage

**Files:**
- Create: `templates/learning-map.html`
- Create: `assets/learning-map.css`
- Create: `assets/learning-map.js`
- Modify: `tools/build_pages.py`
- Modify: `tests/test_pages_site.py`

- [ ] **Step 1: Write failing homepage structure tests**

Assert the generated homepage contains:

```python
home = (output / "index.html").read_text(encoding="utf-8")
self.assertIn('id="learningStarmap"', home)
self.assertIn('id="constellationTrack"', home)
self.assertIn('class="constellation-fallback"', home)
self.assertIn("./assets/learning-map.css", home)
self.assertIn("./assets/learning-map.js", home)
self.assertNotIn('id="ch1"', home)
self.assertNotIn("八周", home)
self.assertNotIn("今日任务", home)
```

Parse the injected JSON and assert six ordered groups and 28 routable entries.

- [ ] **Step 2: Run the homepage test and confirm it fails**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_pages_site.StarmapTests -v
```

Expected: missing template/assets or missing star-map markup.

- [ ] **Step 3: Add the semantic homepage template**

`templates/learning-map.html` must contain:

```html
<main id="learningStarmap">
  <header class="starmap-hero">
    <p class="starmap-eyebrow">Agent learning · star map</p>
    <h1>点亮属于你的 Agent 认知星座</h1>
    <p>从原理到实战，28 颗星连成六个星座。</p>
  </header>
  <section class="starmap-desktop" aria-label="六篇学习星图">
    <svg id="constellationCanvas" role="img" aria-label="Agent 学习知识星图"></svg>
    <aside id="constellationTrack" aria-live="polite"></aside>
  </section>
  <nav class="constellation-mobile" aria-label="移动端学习路径"></nav>
  <nav class="constellation-fallback" aria-label="全部章节">{{STAR_MAP_FALLBACK}}</nav>
</main>
<script id="starmapData" type="application/json">{{STAR_MAP_DATA}}</script>
```

The fallback contains normal server-rendered links and remains visible until JavaScript adds `.starmap-enhanced` to `<html>`.

- [ ] **Step 4: Implement the approved desktop visual**

In `assets/learning-map.css` implement:

- near-black sky surface with six distinct accent colors;
- book-like serif headline and compact sans/mono metadata;
- six constellation groups, right-side star-track panel, legend, and progress;
- filled/double-ring/hollow states so status does not rely on color;
- focused constellation styling without layout shifts;
- `@media (prefers-reduced-motion: reduce)` disabling pulse and transitions.

Keep cards at `8px` radius or less and use no decorative orb elements.

- [ ] **Step 5: Implement data-driven star-map behavior**

In `assets/learning-map.js`:

```javascript
const data = JSON.parse(document.getElementById("starmapData").textContent);
const read = readJson("ah-read-chapters", {});
const current = validEntry(localStorage.getItem("ah-last-chapter")) || "ch1";

renderDesktopConstellations(data.groups, read, current);
renderMobileConstellations(data.groups, read, current);
renderTrack(groupFor(current), read, current);
redirectLegacyHash(data.anchorRoutes);
document.documentElement.classList.add("starmap-enhanced");
```

Use deterministic coordinates stored as normalized points per six group shapes. Render each chapter as an SVG `<a href="./ch7/">` containing a visible star and a transparent focus target. Use event delegation for hover/focus and track updates.

- [ ] **Step 6: Implement the mobile constellation track**

For viewports at or below `768px`:

- hide the desktop SVG and track;
- show six `<details>` sections;
- open the current group by default;
- render every chapter as a minimum `44px` link row;
- show chapter number, title, and textual state.

- [ ] **Step 7: Run tests and build**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest tests.test_pages_site.StarmapTests -v
PATH="$PWD/.venv/bin:$PATH" npm run pages
```

Expected: tests pass and `dist/index.html` contains no chapter body.

- [ ] **Step 8: Commit the homepage**

```bash
git add templates/learning-map.html assets/learning-map.css \
  assets/learning-map.js tools/build_pages.py tests/test_pages_site.py
git commit -m "feat: add learning starmap homepage"
```

### Task 5: Preserve cross-page interactions and reading progress

**Files:**
- Modify: `assets/handbook-interactions.js:1-40, 113-190, 292-477, 714-735`
- Modify: `assets/learner-guide.js:376-472`
- Modify: `templates/handbook.html`
- Modify: `tests/test_pages_site.py`
- Modify: `tests/test_build_system.py`

- [ ] **Step 1: Write failing client-contract tests**

Static tests must assert:

```python
self.assertIn("window.HANDBOOK_PAGE", interactions)
self.assertIn("resolveInternalHref", interactions)
self.assertIn("'ah-last-chapter'", learner_guide)
self.assertIn("page.previous", learner_guide)
self.assertIn("page.next", learner_guide)
```

Add a generated-page test asserting `/ch7/` includes previous `/ch6/`, next `/ch8/`, and the global entry index `7 / 28`.

- [ ] **Step 2: Run tests and confirm they fail**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_pages_site.ClientContractTests \
  tests.test_build_system.ThemeMenuTests -v
```

- [ ] **Step 3: Add one dynamic-link resolver**

At the top of `assets/handbook-interactions.js`:

```javascript
function resolveInternalHref(href) {
  if (!href || href.charAt(0) !== "#") return href;
  var page = window.HANDBOOK_PAGE || {};
  var target = href.slice(1);
  var route = page.anchorRoutes && page.anchorRoutes[target];
  if (!route || route === page.route) return href;
  return "../" + route + "/#" + target;
}
```

Apply it at every dynamic internal-link emission for learning modes, module anchors, quizzes, patterns, diagnostics, insight links, and inline quizzes. External URLs remain untouched.

- [ ] **Step 4: Make learner guide use global page context**

When `window.HANDBOOK_PAGE.entries` exists:

- derive displayed chapter position from the global entries array;
- use `page.previous.href` and `page.next.href`;
- write the current ID to `localStorage["ah-last-chapter"]`;
- preserve `ah-read-chapters` behavior.

Keep the current DOM-derived path as the full-book fallback so PDF and `agent-learning-handbook.html` retain same-page anchors.

- [ ] **Step 5: Run unit and integration tests**

```bash
PATH="$PWD/.venv/bin:$PATH" npm test
PATH="$PWD/.venv/bin:$PATH" npm run pages
```

Expected: all tests pass; generated `/ch7/` contains cross-page links while full-book links remain fragments.

- [ ] **Step 6: Commit cross-page behavior**

```bash
git add assets/handbook-interactions.js assets/learner-guide.js \
  templates/handbook.html tests/test_pages_site.py tests/test_build_system.py
git commit -m "feat: preserve navigation across content pages"
```

### Task 6: Verify the complete static site and generate sitemap

**Files:**
- Modify: `tools/verify_handbook.py:18-158`
- Modify: `tools/build_pages.py`
- Modify: `tests/test_pages_site.py`
- Modify: `package.json`
- Modify: `.github/workflows/deploy-pages.yml`

- [ ] **Step 1: Write failing site-verification tests**

Cover:

```python
errors = verify_site(output)
self.assertEqual(errors, [])

(output / "ch7" / "index.html").write_text(
    '<a href="../missing/#x">broken</a>', encoding="utf-8"
)
self.assertTrue(any("目标页面不存在" in error for error in verify_site(output)))
```

Also assert missing expected routes, duplicate IDs within one page, absent target fragments, and missing `../assets/...` resources are reported.

- [ ] **Step 2: Run the tests and confirm failure**

```bash
PATH="$PWD/.venv/bin:$PATH" python3 -m unittest \
  tests.test_pages_site.SiteVerifyTests -v
```

- [ ] **Step 3: Implement page-relative verification**

Add:

```python
def verify_site(dist: Path, expected_routes: set[str] | None = None) -> list[str]:
    """Validate generated routes, page-local IDs, cross-page fragments and assets."""
```

For every `index.html`, resolve local URLs relative to `page_path.parent`; for fragment links, parse the target page and confirm the ID exists. Do not reuse the full-book requirement that every page contains every manifest anchor.

- [ ] **Step 4: Generate `sitemap.xml`**

`build_site()` reads `SITE_URL`, normalizes one trailing slash, and writes:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://liyurun.github.io/agent_learn/</loc></url>
  <url><loc>https://liyurun.github.io/agent_learn/ch1/</loc></url>
</urlset>
```

If `SITE_URL` is absent locally, use `http://localhost/` only for sitemap output; page links remain relative.

- [ ] **Step 5: Wire validation into commands and CI**

Keep `npm run verify` as the public command and make `final` verify:

1. source files;
2. complete root HTML;
3. `dist/` when it exists.

Set in `.github/workflows/deploy-pages.yml`:

```yaml
env:
  SITE_URL: https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/
```

- [ ] **Step 6: Run verification**

```bash
PATH="$PWD/.venv/bin:$PATH" npm test
PATH="$PWD/.venv/bin:$PATH" npm run build
PATH="$PWD/.venv/bin:$PATH" npm run pages
PATH="$PWD/.venv/bin:$PATH" npm run verify
```

Expected: all commands exit zero and the verifier reports both full-book and site success.

- [ ] **Step 7: Commit site verification**

```bash
git add tools/verify_handbook.py tools/build_pages.py tests/test_pages_site.py \
  package.json .github/workflows/deploy-pages.yml
git commit -m "test: verify generated multipage site"
```

### Task 7: Document the public site workflow

**Files:**
- Modify: `README.md:1-120`
- Modify: `.gitignore:1-12`

- [ ] **Step 1: Update documentation**

Document:

- `/` is the learning star map;
- content route examples `/ch7/`, `/lab2/`, and `/resources/`;
- `npm run build` produces the complete book for PDF;
- `npm run pages` produces the routed static site;
- local preview command:

```bash
python3 -m http.server 4173 --directory dist
```

- [ ] **Step 2: Ignore visual-companion artifacts**

Add:

```gitignore
.superpowers/
```

Do not remove or commit existing mockup files.

- [ ] **Step 3: Run documentation-sensitive tests**

```bash
PATH="$PWD/.venv/bin:$PATH" npm test
git diff --check
```

Expected: tests pass and no whitespace errors.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md .gitignore
git commit -m "docs: explain multipage learning site"
```

### Task 8: Browser verification and final regression

**Files:**
- Modify if defects are found: `templates/learning-map.html`
- Modify if defects are found: `assets/learning-map.css`
- Modify if defects are found: `assets/learning-map.js`
- Modify if defects are found: `templates/handbook.html`
- Modify if defects are found: `assets/handbook-interactions.js`
- Modify if defects are found: `assets/learner-guide.js`

- [ ] **Step 1: Build production assets**

```bash
PATH="$PWD/.venv/bin:$PATH" npm test
PATH="$PWD/.venv/bin:$PATH" npm run build
PATH="$PWD/.venv/bin:$PATH" npm run pages
PATH="$PWD/.venv/bin:$PATH" npm run verify
```

Expected: all commands succeed.

- [ ] **Step 2: Start a local server**

```bash
python3 -m http.server 4173 --directory dist
```

If port `4173` is occupied, use the next free port and record it.

- [ ] **Step 3: Verify desktop behavior with Playwright/agent-browser**

At `1440x1000` verify:

- homepage renders six visible constellations and 28 chapter/Lab links;
- hovering one constellation dims the others without moving layout;
- clicking a legend item updates the star-track panel;
- clicking chapter 7 navigates to `/ch7/`;
- `/ch7/` contains chapter 7 but not chapter 8;
- previous/next links navigate to `/ch6/` and `/ch8/`;
- `/resources/#cite-1` lands on the citation;
- no console errors or failed local resource requests.

Capture full-page screenshots of `/`, `/ch7/`, and `/resources/`.

- [ ] **Step 4: Verify mobile behavior**

At an iPhone 14 viewport verify:

- desktop SVG is hidden;
- six constellation sections are readable;
- the current constellation is expanded;
- links have at least a 44px hit area;
- no horizontal overflow or overlapping controls.

Capture homepage and chapter screenshots.

- [ ] **Step 5: Verify legacy links and PDF**

Open `/#ch7` and confirm redirect to `/ch7/`. Then run:

```bash
PATH="$PWD/.venv/bin:$PATH" npm run pdf
```

Expected: PDF still satisfies the configured minimum page count and is not overwritten on failure.

- [ ] **Step 6: Commit any browser-found fixes**

If browser verification changed code:

```bash
git add templates assets tools tests
git commit -m "fix: polish starmap responsive behavior"
```

If no files changed, do not create an empty commit.

- [ ] **Step 7: Final repository check**

```bash
git status --short
git log --oneline -8
```

Expected: no untracked build artifacts; only intentional commits are present.

## Final Acceptance

- The first viewport identifies the product and presents the six-constellation knowledge map.
- The homepage contains navigation metadata only, not all chapter bodies.
- Every chapter and Lab has a stable, directly loadable URL.
- Desktop and mobile use layouts appropriate to their available space.
- Existing reading preferences and completion state survive the migration.
- Full-book HTML and PDF generation continue to work.
- All unit, build, site verification, browser, and resource checks pass.

## Self-Review

- Spec coverage: route structure, star-map visual, mobile adaptation, progress, compatibility, SEO, error handling, and testing are assigned to Tasks 1-8.
- Placeholder scan: no `TBD`, `TODO`, deferred implementation, or unspecified test step remains.
- Type consistency: `PageSpec`, `build_page_specs`, `build_anchor_route_index`, `resolve_site_href`, `build_page_context`, `build_site`, and `verify_site` retain one spelling and signature throughout.
- Scope: the plan does not add authentication, cloud synchronization, weekly planning, daily tasks, search infrastructure, or split PDFs.
