#!/usr/bin/env python3
"""Shared primitives for splitting, building, and verifying the handbook."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Callable
from urllib.parse import unquote


GENERATED_COMMENT = "<!-- GENERATED FILE: 请修改 content/、templates/ 或 assets/，不要直接编辑本文件。 -->"
CONTENT_PLACEHOLDER = "{{BOOK_CONTENT}}"
TOC_PLACEHOLDER = "{{BOOK_TOC}}"
NAV_PLACEHOLDER = "{{BOOK_NAV}}"
REQUIRED_FIELDS = ("path", "id", "kind", "title", "toc")
PART_ROUTE_ALIASES = {
    "part1": "ch1",
    "part2": "ch4",
    "part3": "ch8",
    "part4": "ch13",
    "part5": "ch16",
    "part6": "labs",
}


class BuildError(ValueError):
    """A user-facing build configuration error."""


@dataclass(frozen=True)
class PageSpec:
    route: str
    title: str
    item_ids: tuple[str, ...]


SPECIAL_PAGES = (
    PageSpec("", "学习星图", ()),
    PageSpec("guide", "学习导读", ("learningModes", "moduleAtlas", "intro")),
    PageSpec("quiz", "模块复盘", ("moduleQuizHub",)),
    PageSpec("insights", "大牛观点", ("insights",)),
    PageSpec("labs", "实战工坊", ("labs-intro",)),
    PageSpec("resources", "参考资源", ("references", "footer-note")),
)


def load_manifest(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise BuildError(f"清单不存在: {path}") from exc
    except json.JSONDecodeError as exc:
        raise BuildError(f"清单 JSON 无法解析: {path}:{exc.lineno}:{exc.colno}: {exc.msg}") from exc
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        raise BuildError("清单根对象必须包含 items 数组")
    seen_paths: set[str] = set()
    seen_ids: set[str] = set()
    for index, item in enumerate(data["items"]):
        if not isinstance(item, dict):
            raise BuildError(f"items[{index}] 必须是对象")
        missing = [field for field in REQUIRED_FIELDS if field not in item]
        if missing:
            raise BuildError(f"items[{index}] 缺少字段: {', '.join(missing)}")
        if not isinstance(item["toc"], bool):
            raise BuildError(f"items[{index}].toc 必须是布尔值")
        if item["path"] in seen_paths:
            raise BuildError(f"重复内容路径: {item['path']}")
        if item["id"] in seen_ids:
            raise BuildError(f"重复内容 id: {item['id']}")
        seen_paths.add(item["path"])
        seen_ids.add(item["id"])
    return data


def build_page_specs(manifest: dict[str, Any]) -> list[PageSpec]:
    items = manifest["items"]
    item_ids = {item["id"] for item in items}
    for spec in SPECIAL_PAGES:
        missing = set(spec.item_ids) - item_ids
        if missing:
            raise BuildError(
                f"页面 {spec.route or '/'} 缺少内容项: {', '.join(sorted(missing))}"
            )

    specs = list(SPECIAL_PAGES)
    specs.extend(
        PageSpec(item["id"], item["title"], (item["id"],))
        for item in items
        if item["kind"] in {"chapter", "lab"}
    )
    routes = [spec.route for spec in specs]
    duplicates = sorted({route for route in routes if routes.count(route) > 1})
    if duplicates:
        raise BuildError(f"重复页面路由: {', '.join(duplicates)}")
    return specs


class _NativeBlockParser(HTMLParser):
    """Recognize files made entirely of native block HTML.

    Migrated chunks can contain several sibling blocks and can close/open the
    surrounding ``.page`` div across file boundaries, so strictness here means
    "no Markdown text outside an HTML block", not "balanced as a standalone
    document".
    """

    ROOT_TAGS = {"section", "div", "footer"}
    VOID_TAGS = {
        "area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.stack: list[str] = []
        self.saw_root = False
        self.invalid = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if any(key.lower() == "markdown" for key, _ in attrs):
            self.invalid = True
        if not self.stack:
            if tag not in self.ROOT_TAGS:
                self.invalid = True
            else:
                self.saw_root = True
        if tag not in self.VOID_TAGS:
            self.stack.append(tag)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if not self.stack and tag.lower() not in self.ROOT_TAGS:
            self.invalid = True
        else:
            self.saw_root = True

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self.stack:
            if self.stack[-1] != tag:
                self.invalid = True
                return
            self.stack.pop()
        elif not self.saw_root or tag not in {"div", "footer"}:
            self.invalid = True

    def handle_data(self, data: str) -> None:
        if not self.stack and data.strip():
            self.invalid = True

    def handle_entityref(self, name: str) -> None:
        if not self.stack:
            self.invalid = True

    def handle_charref(self, name: str) -> None:
        if not self.stack:
            self.invalid = True

    def handle_decl(self, decl: str) -> None:
        self.invalid = True

    def handle_pi(self, data: str) -> None:
        self.invalid = True


def is_raw_section(text: str) -> bool:
    parser = _NativeBlockParser()
    try:
        parser.feed(text)
        parser.close()
    except Exception:
        return False
    return parser.saw_root and not parser.invalid


_H3_OPEN_RE = re.compile(r"<h3\b(?P<attrs>[^>]*)>", re.IGNORECASE)
_ID_ATTR_RE = re.compile(r"\bid\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s>]+)", re.IGNORECASE)


def inject_heading_ids(html: str, section_id: str) -> str:
    """Give every h3 a deterministic ID while preserving authored IDs."""
    ordinal = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal ordinal
        ordinal += 1
        attrs = match.group("attrs")
        if _ID_ATTR_RE.search(attrs):
            return match.group(0)
        heading_id = f"{section_id}-section-{ordinal:02d}"
        return f'<h3 id="{escape(heading_id, quote=True)}"{attrs}>'

    return _H3_OPEN_RE.sub(replace, html)


def render_content_file(path: Path, item: dict[str, Any]) -> str:
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise BuildError(f"内容文件不存在: {path}") from exc
    if is_raw_section(text):
        rendered = text
    else:
        try:
            import markdown
        except ImportError as exc:
            raise BuildError("缺少 Markdown 依赖；请运行 python3 -m pip install -r requirements.txt") from exc
        try:
            body = markdown.markdown(
                text,
                extensions=["fenced_code", "tables", "attr_list", "md_in_html"],
            )
        except Exception as exc:
            raise BuildError(f"Markdown 渲染失败: {path}: {exc}") from exc
        rendered = (
            f'<section class="chapter" id="{item["id"]}">\n'
            f'  <h2 class="chap-title">{item["title"]}</h2>\n'
            f"{body}\n"
            "</section>\n"
        )
    if item.get("kind") in {"chapter", "lab"}:
        return inject_heading_ids(rendered, item["id"])
    return rendered


_PAGE_BOUNDARY_RE = re.compile(
    r"^[ \t]*</div>[ \t]*<!--\s*/page\s*-->[ \t]*(?:\r?\n)*\Z",
    re.IGNORECASE | re.MULTILINE,
)


def normalize_standalone_fragment(html: str) -> str:
    """Remove the legacy cross-file page close from an isolated content item."""
    return _PAGE_BOUNDARY_RE.sub("", html)


def render_manifest_items(root: Path, manifest: dict[str, Any]) -> dict[str, str]:
    return {
        item["id"]: render_content_file(root / "content" / item["path"], item)
        for item in manifest["items"]
    }


def replace_single_placeholder(template: str, placeholder: str, value: str) -> str:
    count = template.count(placeholder)
    if count != 1:
        raise BuildError(f"模板必须恰好包含一个 {placeholder}，实际为 {count}")
    return template.replace(placeholder, value)


def render_toc(manifest: dict[str, Any]) -> str:
    groups: list[tuple[str, list[dict[str, Any]]]] = []
    group_lookup: dict[str, list[dict[str, Any]]] = {}
    for item in manifest["items"]:
        if not item["toc"]:
            continue
        group = item.get("toc_group", "目录")
        if group not in group_lookup:
            group_lookup[group] = []
            groups.append((group, group_lookup[group]))
        group_lookup[group].append(item)
    lines = ['      <div class="toc">', "        <h2>目录</h2>", '        <div class="toc-cols">']
    for label, items in groups:
        lines.extend([
            '          <div class="toc-group">',
            f'            <div class="toc-part">{label}</div>',
            "            <ol>",
        ])
        for item in items:
            number = item.get("number", "")
            lines.append(
                f'              <li><a href="#{item["id"]}"><span class="n">{number}</span>{item["title"]}</a></li>'
            )
        lines.extend(["            </ol>", "          </div>"])
    lines.extend(["        </div>", "      </div>"])
    return "\n".join(lines)


def render_top_navigation(
    manifest: dict[str, Any],
    href_for: Callable[[str], str] | None = None,
    home_href: str = "#",
) -> str:
    """Render desktop and mobile book navigation from the manifest."""
    link_for = href_for or (lambda target: target)
    groups: list[tuple[str, list[dict[str, Any]]]] = []
    lookup: dict[str, list[dict[str, Any]]] = {}
    for item in manifest["items"]:
        if not item["toc"]:
            continue
        group = item.get("toc_group", "目录")
        if group not in lookup:
            lookup[group] = []
            groups.append((group, lookup[group]))
        lookup[group].append(item)

    parts = [item for item in manifest["items"] if item.get("kind") == "part"]
    if len(groups) != 6 or len(parts) < 6:
        raise BuildError(f"顶部导航要求六个分篇，实际目录分组 {len(groups)}、分篇入口 {len(parts)}")

    labels = ("原理", "技术", "实践", "面试", "进阶", "实战")
    lines = ['      <nav class="book-nav" aria-label="全书导航">']
    mobile_groups: list[str] = []
    for index, ((group, items), part, label) in enumerate(zip(groups, parts, labels), start=1):
        menu_id = f"nav-menu-part{index}"
        part_href = escape(link_for("#" + str(part["id"])), quote=True)
        lines.extend([
            f'        <div class="nav-group" data-part-id="{escape(part["id"], quote=True)}">',
            (
                f'          <a class="nav-trigger" href="{part_href}" '
                f'aria-haspopup="true" aria-controls="{menu_id}" aria-expanded="false">{label}</a>'
            ),
            f'          <div class="nav-dropdown" id="{menu_id}" role="menu" aria-label="{escape(group, quote=True)}">',
        ])
        mobile_groups.extend([
            f'        <section class="mobile-nav-group" data-part-id="{escape(part["id"], quote=True)}">',
            (
                f'          <button class="mobile-part-trigger" type="button" aria-expanded="false" '
                f'aria-controls="mobile-part-{index}">{label}</button>'
            ),
            f'          <div class="mobile-part-links" id="mobile-part-{index}" hidden>',
        ])
        for item in items:
            item_id = escape(item["id"], quote=True)
            number = escape(str(item.get("number", "")))
            title = escape(str(item["title"]))
            link = f'<span class="nav-number">{number}</span><span>{title}</span>'
            href = escape(link_for(f"#{item_id}"), quote=True)
            lines.append(f'            <a href="{href}" role="menuitem" data-chapter-id="{item_id}">{link}</a>')
            mobile_groups.append(f'            <a href="{href}" data-chapter-id="{item_id}">{link}</a>')
        lines.extend(["          </div>", "        </div>"])
        mobile_groups.extend(["          </div>", "        </section>"])
    resource_target = "#references" if href_for else "#resources"
    resource_href = escape(link_for(resource_target), quote=True)
    lines.extend([
        f'        <a class="nav-resource" href="{resource_href}">资源</a>',
        "      </nav>",
        (
            '      <button class="icon-btn mobile-book-toggle" id="mobileBookToggle" type="button" '
            'aria-haspopup="true" aria-controls="mobileBookNav" aria-expanded="false">目录</button>'
        ),
        '      <div class="mobile-book-nav" id="mobileBookNav" aria-label="移动端全书目录" hidden>',
        *mobile_groups,
        f'        <a class="mobile-resource" href="{resource_href}">资源</a>',
        "      </div>",
    ])
    return "\n".join(lines)


class _IdParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for key, value in attrs:
            if key == "id" and value:
                self.ids.append(value)


def extract_anchor_ids(html: str) -> list[str]:
    parser = _IdParser()
    parser.feed(html)
    return parser.ids


def build_anchor_route_index(
    manifest: dict[str, Any],
    rendered_items: dict[str, str],
) -> dict[str, str]:
    index: dict[str, str] = {}
    for spec in build_page_specs(manifest):
        for item_id in spec.item_ids:
            try:
                html = rendered_items[item_id]
            except KeyError as exc:
                raise BuildError(f"缺少已渲染内容项: {item_id}") from exc
            for anchor in extract_anchor_ids(normalize_standalone_fragment(html)):
                previous = index.get(anchor)
                if previous is not None and previous != spec.route:
                    raise BuildError(
                        f"锚点 {anchor} 同时属于页面 {previous} 和 {spec.route}"
                    )
                index[anchor] = spec.route

    routes = {spec.route for spec in build_page_specs(manifest)}
    for anchor, route in PART_ROUTE_ALIASES.items():
        if route not in routes:
            raise BuildError(f"分篇锚点 {anchor} 指向不存在路由: {route}")
        index[anchor] = route
    return index


def resolve_site_href(
    href: str,
    current_route: str,
    anchor_routes: dict[str, str],
) -> str:
    if not href.startswith("#") or href == "#":
        return href
    target = unquote(href[1:])
    try:
        target_route = anchor_routes[target]
    except KeyError as exc:
        raise BuildError(f"内部链接目标不存在: #{target}") from exc

    if target in PART_ROUTE_ALIASES:
        if target_route == current_route:
            return "./"
        return f"./{target_route}/" if not current_route else f"../{target_route}/"
    if target_route == current_route:
        return f"#{target}"
    if not current_route:
        return f"./{target_route}/#{target}"
    if not target_route:
        return f"../#{target}"
    return f"../{target_route}/#{target}"


class _InternalLinkRewriter(HTMLParser):
    def __init__(
        self,
        current_route: str,
        anchor_routes: dict[str, str],
    ) -> None:
        super().__init__(convert_charrefs=False)
        self.current_route = current_route
        self.anchor_routes = anchor_routes
        self.parts: list[str] = []

    @staticmethod
    def _render_attrs(attrs: list[tuple[str, str | None]]) -> str:
        rendered = []
        for key, value in attrs:
            if value is None:
                rendered.append(key)
            else:
                rendered.append(f'{key}="{escape(value, quote=True)}"')
        return (" " + " ".join(rendered)) if rendered else ""

    def _rewrite_attrs(
        self,
        attrs: list[tuple[str, str | None]],
    ) -> list[tuple[str, str | None]]:
        return [
            (
                key,
                resolve_site_href(value, self.current_route, self.anchor_routes)
                if key.lower() == "href" and value
                else value,
            )
            for key, value in attrs
        ]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.parts.append(f"<{tag}{self._render_attrs(self._rewrite_attrs(attrs))}>")

    def handle_startendtag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        self.parts.append(f"<{tag}{self._render_attrs(self._rewrite_attrs(attrs))}/>")

    def handle_endtag(self, tag: str) -> None:
        self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def handle_entityref(self, name: str) -> None:
        self.parts.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self.parts.append(f"&#{name};")

    def handle_comment(self, data: str) -> None:
        self.parts.append(f"<!--{data}-->")

    def handle_decl(self, decl: str) -> None:
        self.parts.append(f"<!{decl}>")

    def handle_pi(self, data: str) -> None:
        self.parts.append(f"<?{data}>")


def rewrite_internal_links(
    html: str,
    current_route: str,
    anchor_routes: dict[str, str],
) -> str:
    parser = _InternalLinkRewriter(current_route, anchor_routes)
    try:
        parser.feed(html)
        parser.close()
    except BuildError:
        raise
    except Exception as exc:
        raise BuildError(f"页面链接改写失败: {current_route or '/'}: {exc}") from exc
    return "".join(parser.parts)


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


def normalize_for_compare(html: str) -> str:
    html = html.replace(GENERATED_COMMENT, "")
    html = re.sub(r"[ \t]+(?=\r?\n)", "", html)
    html = re.sub(r">\s+<", "><", html)
    return html.strip()
