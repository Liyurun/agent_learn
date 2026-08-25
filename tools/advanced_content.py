"""Advanced handbook manifest, route, and rendering helpers."""
from __future__ import annotations

import json
import posixpath
from dataclasses import dataclass
from html import escape
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from typing import Any, Literal
from urllib.parse import unquote, urlsplit

import markdown

try:
    from .handbook_build import BuildError, GENERATED_COMMENT
except ImportError:  # Direct script execution.
    from handbook_build import BuildError, GENERATED_COMMENT


ItemKind = Literal["chapter", "section", "appendix", "guide"]
VALID_ITEM_KINDS = {"chapter", "section", "appendix", "guide"}


@dataclass(frozen=True)
class AdvancedItem:
    id: str
    slug: str
    route: str
    kind: ItemKind
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


def _string(raw: dict[str, Any], key: str, context: str) -> str:
    value = raw.get(key)
    if not isinstance(value, str) or not value:
        raise BuildError(f"{context}: invalid string field: {key}")
    return value


def _integer(
    raw: dict[str, Any],
    key: str,
    context: str,
    *,
    optional: bool = False,
) -> int | None:
    value = raw.get(key)
    if optional and value is None:
        return None
    if not isinstance(value, int) or isinstance(value, bool):
        raise BuildError(f"{context}: invalid integer field: {key}")
    return value


def _optional_string(
    raw: dict[str, Any],
    key: str,
    context: str,
) -> str | None:
    value = raw.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or not value:
        raise BuildError(f"{context}: invalid optional string field: {key}")
    return value


def _safe_content_path(value: str, context: str) -> str:
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise BuildError(f"{context}: unsafe contentPath: {value}")
    return path.as_posix()


def _load_domain(raw: Any, index: int) -> AdvancedDomain:
    context = f"advanced domain #{index}"
    if not isinstance(raw, dict):
        raise BuildError(f"{context}: expected object")
    chapter_ids = raw.get("chapterIds")
    if (
        not isinstance(chapter_ids, list)
        or not all(isinstance(value, str) for value in chapter_ids)
    ):
        raise BuildError(f"{context}: invalid chapterIds")
    return AdvancedDomain(
        id=_string(raw, "id", context),
        title=_string(raw, "title", context),
        order=_integer(raw, "order", context) or 0,
        chapter_ids=tuple(chapter_ids),
    )


def _load_item(raw: Any, index: int) -> AdvancedItem:
    context = f"advanced item #{index}"
    if not isinstance(raw, dict):
        raise BuildError(f"{context}: expected object")
    kind = _string(raw, "kind", context)
    if kind not in VALID_ITEM_KINDS:
        raise BuildError(f"{context}: invalid kind: {kind}")
    return AdvancedItem(
        id=_string(raw, "id", context),
        slug=_string(raw, "slug", context),
        route=_string(raw, "route", context),
        kind=kind,  # type: ignore[arg-type]
        title=_string(raw, "title", context),
        description=_string(raw, "description", context),
        domain=_string(raw, "domain", context),
        order=_integer(raw, "order", context) or 0,
        source_path=_string(raw, "sourcePath", context),
        content_path=_safe_content_path(
            _string(raw, "contentPath", context),
            context,
        ),
        parent=_optional_string(raw, "parent", context),
        section_order=_integer(
            raw,
            "sectionOrder",
            context,
            optional=True,
        ),
    )


def load_advanced_manifest(path: Path) -> AdvancedManifest:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise BuildError(f"advanced manifest does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise BuildError(f"advanced manifest is invalid JSON: {exc}") from exc
    if not isinstance(raw, dict):
        raise BuildError("advanced manifest root must be an object")
    domains = raw.get("domains")
    items = raw.get("items")
    if not isinstance(domains, list) or not isinstance(items, list):
        raise BuildError("advanced manifest requires domains and items arrays")
    manifest = AdvancedManifest(
        version=_integer(raw, "version", "advanced manifest") or 0,
        track=_string(raw, "track", "advanced manifest"),
        source=_string(raw, "source", "advanced manifest"),
        domains=tuple(
            _load_domain(value, index)
            for index, value in enumerate(domains, start=1)
        ),
        items=tuple(
            _load_item(value, index)
            for index, value in enumerate(items, start=1)
        ),
    )
    validate_advanced_manifest(manifest)
    return manifest


def _duplicates(values: list[str]) -> list[str]:
    seen: set[str] = set()
    repeated: set[str] = set()
    for value in values:
        if value in seen:
            repeated.add(value)
        seen.add(value)
    return sorted(repeated)


def validate_advanced_manifest(manifest: AdvancedManifest) -> None:
    if manifest.version != 1:
        raise BuildError(f"unsupported advanced manifest version: {manifest.version}")
    if manifest.track != "advanced":
        raise BuildError(f"advanced manifest has invalid track: {manifest.track}")

    for label, values in (
        ("domain id", [domain.id for domain in manifest.domains]),
        ("item id", [item.id for item in manifest.items]),
        ("item slug", [item.slug for item in manifest.items]),
        ("item route", [item.route for item in manifest.items]),
    ):
        repeated = _duplicates(values)
        if repeated:
            raise BuildError(f"duplicate {label}: {', '.join(repeated)}")

    domains = {domain.id: domain for domain in manifest.domains}
    items = {item.id: item for item in manifest.items}
    chapters = {
        item.id: item for item in manifest.items if item.kind == "chapter"
    }
    for item in manifest.items:
        if item.domain not in domains:
            raise BuildError(f"{item.id}: missing domain: {item.domain}")
        if item.kind == "section":
            if item.parent not in chapters:
                raise BuildError(f"{item.id}: missing parent: {item.parent}")
            if item.section_order is None:
                raise BuildError(f"{item.id}: missing section order")
        elif item.parent is not None:
            raise BuildError(f"{item.id}: only sections may have a parent")
        if item.route == "advanced":
            if item.kind != "guide":
                raise BuildError("only the guide may use the advanced root route")
        elif not item.route.startswith("advanced/"):
            raise BuildError(f"{item.id}: invalid advanced route: {item.route}")

    for domain in manifest.domains:
        for chapter_id in domain.chapter_ids:
            if chapter_id not in chapters:
                raise BuildError(
                    f"{domain.id}: missing chapter reference: {chapter_id}"
                )
            if chapters[chapter_id].domain != domain.id:
                raise BuildError(
                    f"{domain.id}: chapter belongs to another domain: {chapter_id}"
                )

    referenced = {
        chapter_id
        for domain in manifest.domains
        for chapter_id in domain.chapter_ids
    }
    missing_references = sorted(set(chapters) - referenced)
    if missing_references:
        raise BuildError(
            "advanced chapters missing from domains: "
            + ", ".join(missing_references)
        )


def items_by_id(manifest: AdvancedManifest) -> dict[str, AdvancedItem]:
    return {item.id: item for item in manifest.items}


def chapter_pages(
    manifest: AdvancedManifest,
    chapter_id: str,
) -> tuple[AdvancedItem, ...]:
    try:
        chapter = items_by_id(manifest)[chapter_id]
    except KeyError as exc:
        raise BuildError(f"advanced chapter does not exist: {chapter_id}") from exc
    if chapter.kind != "chapter":
        raise BuildError(f"advanced item is not a chapter: {chapter_id}")
    sections = sorted(
        (item for item in manifest.items if item.parent == chapter_id),
        key=lambda item: (item.section_order or 0, item.slug),
    )
    return (chapter, *sections)


def ordered_pages(manifest: AdvancedManifest) -> tuple[AdvancedItem, ...]:
    guide = tuple(item for item in manifest.items if item.kind == "guide")
    learning_path = tuple(
        item
        for domain in sorted(manifest.domains, key=lambda value: value.order)
        if domain.chapter_ids
        for chapter_id in domain.chapter_ids
        for item in chapter_pages(manifest, chapter_id)
    )
    appendices = tuple(sorted(
        (item for item in manifest.items if item.kind == "appendix"),
        key=lambda item: (item.order, item.slug),
    ))
    ordered = (*guide, *learning_path, *appendices)
    if len(ordered) != len(manifest.items):
        raise BuildError(
            f"advanced page order covers {len(ordered)}/{len(manifest.items)} items"
        )
    return ordered


def page_neighbors(
    manifest: AdvancedManifest,
    item_id: str,
) -> tuple[AdvancedItem | None, AdvancedItem | None]:
    ordered = ordered_pages(manifest)
    try:
        index = next(
            index for index, item in enumerate(ordered) if item.id == item_id
        )
    except StopIteration as exc:
        raise BuildError(f"advanced item does not exist: {item_id}") from exc
    return (
        ordered[index - 1] if index > 0 else None,
        ordered[index + 1] if index + 1 < len(ordered) else None,
    )


def chapter_for_item(
    manifest: AdvancedManifest,
    item: AdvancedItem,
) -> AdvancedItem | None:
    if item.kind == "chapter":
        return item
    if item.parent:
        return items_by_id(manifest)[item.parent]
    return None


def asset_prefix_for_route(route: str) -> str:
    return "../" * len(PurePosixPath(route).parts)


def relative_route_href(
    current_route: str,
    target_route: str,
    fragment: str = "",
) -> str:
    relative = posixpath.relpath(target_route, start=current_route)
    href = "./" if relative == "." else relative.rstrip("/") + "/"
    return href + (f"#{fragment}" if fragment else "")


def resolve_advanced_href(href: str, current_route: str) -> str:
    parsed = urlsplit(href)
    if parsed.scheme or parsed.netloc or href.startswith(("#", "mailto:")):
        return href
    if not parsed.path.startswith("/advanced"):
        return href
    target_route = unquote(parsed.path).strip("/")
    return relative_route_href(current_route, target_route, parsed.fragment)


class _AdvancedLinkRewriter(HTMLParser):
    def __init__(self, current_route: str) -> None:
        super().__init__(convert_charrefs=False)
        self.current_route = current_route
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

    def _attrs(
        self,
        attrs: list[tuple[str, str | None]],
    ) -> list[tuple[str, str | None]]:
        return [
            (
                key,
                resolve_advanced_href(value, self.current_route)
                if key.lower() == "href" and value
                else value,
            )
            for key, value in attrs
        ]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.parts.append(f"<{tag}{self._render_attrs(self._attrs(attrs))}>")

    def handle_startendtag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        self.parts.append(f"<{tag}{self._render_attrs(self._attrs(attrs))}/>")

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


def rewrite_advanced_links(html: str, current_route: str) -> str:
    parser = _AdvancedLinkRewriter(current_route)
    try:
        parser.feed(html)
        parser.close()
    except Exception as exc:
        raise BuildError(
            f"advanced page link rewrite failed: {current_route}: {exc}"
        ) from exc
    return "".join(parser.parts)


def render_advanced_markdown(
    path: Path,
    current_route: str,
) -> tuple[str, str]:
    try:
        source = path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise BuildError(f"advanced content file does not exist: {path}") from exc
    renderer = markdown.Markdown(extensions=[
        "fenced_code",
        "tables",
        "attr_list",
        "md_in_html",
        "toc",
    ])
    html = rewrite_advanced_links(renderer.convert(source), current_route)
    return html, renderer.toc


def _replace_once(template: str, placeholder: str, value: str) -> str:
    count = template.count(placeholder)
    if count != 1:
        raise BuildError(
            f"advanced template placeholder {placeholder} "
            f"must occur once, found {count}"
        )
    return template.replace(placeholder, value)


def render_book_navigation(
    manifest: AdvancedManifest,
    current: AdvancedItem,
) -> str:
    lookup = items_by_id(manifest)
    current_chapter = chapter_for_item(manifest, current)
    lines = ['<nav class="advanced-book-tree" aria-label="进阶完整版目录">']
    for domain in sorted(manifest.domains, key=lambda value: value.order):
        if not domain.chapter_ids:
            continue
        domain_open = any(
            chapter_id == (current_chapter.id if current_chapter else "")
            for chapter_id in domain.chapter_ids
        )
        lines.append(
            f'<details class="advanced-domain"{" open" if domain_open else ""}>'
        )
        lines.append(
            f"<summary>{escape(domain.title)}"
            f"<span>{len(domain.chapter_ids)}</span></summary>"
        )
        lines.append('<div class="advanced-domain-pages">')
        for chapter_id in domain.chapter_ids:
            chapter = lookup[chapter_id]
            current_class = " is-current" if current_chapter == chapter else ""
            lines.append(
                f'<a class="advanced-chapter-link{current_class}" '
                f'href="{escape(relative_route_href(current.route, chapter.route), quote=True)}">'
                f"{escape(chapter.title)}</a>"
            )
        lines.append("</div></details>")
    lines.append("</nav>")
    return "\n".join(lines)


def _page_link(current: AdvancedItem, target: AdvancedItem | None) -> str:
    if target is None:
        return ""
    return (
        f'<a href="{escape(relative_route_href(current.route, target.route), quote=True)}">'
        f"{escape(target.title)}</a>"
    )


def render_advanced_page(
    *,
    root: Path,
    manifest: AdvancedManifest,
    item: AdvancedItem,
    template: str,
) -> str:
    content, toc = render_advanced_markdown(
        root / "content" / "advanced" / item.content_path,
        item.route,
    )
    previous, following = page_neighbors(manifest, item.id)
    chapter = chapter_for_item(manifest, item)
    chapter_items = chapter_pages(manifest, chapter.id) if chapter else ()
    asset_prefix = asset_prefix_for_route(item.route)
    context = {
        "id": item.id,
        "route": item.route,
        "kind": item.kind,
        "chapter": chapter.id if chapter else None,
        "chapterSections": [
            page.id for page in chapter_items if page.kind == "section"
        ],
        "allIds": [page.id for page in ordered_pages(manifest)],
        "previous": previous.id if previous else None,
        "next": following.id if following else None,
    }
    breadcrumb = (
        f'<a href="{asset_prefix}">全局星图</a><span>/</span>'
        f'<a href="{escape(relative_route_href(item.route, "advanced"), quote=True)}">'
        "进阶完整版</a>"
    )
    if chapter and chapter != item:
        breadcrumb += (
            f'<span>/</span><a href="'
            f'{escape(relative_route_href(item.route, chapter.route), quote=True)}">'
            f"{escape(chapter.title)}</a>"
        )
    footer = (
        '<nav class="advanced-page-footer" aria-label="相邻页面">'
        f'<div class="previous">{_page_link(item, previous)}</div>'
        f'<div class="next">{_page_link(item, following)}</div>'
        "</nav>"
    )
    replacements = {
        "{{PAGE_ID}}": escape(item.id, quote=True),
        "{{HTML_TITLE}}": escape(
            f"{item.title} · Agent 进阶完整版"
        ),
        "{{PAGE_TITLE}}": escape(item.title),
        "{{PAGE_DESCRIPTION}}": escape(item.description, quote=True),
        "{{PAGE_SUMMARY}}": escape(item.description),
        "{{PAGE_KIND}}": escape(item.kind),
        "{{SITE_ROOT}}": asset_prefix,
        "{{BRAND_HOME_HREF}}": asset_prefix,
        "{{MAP_HOME_HREF}}": asset_prefix,
        "{{ADVANCED_STYLE_HREF}}": asset_prefix + "assets/advanced.css",
        "{{ADVANCED_SCRIPT_HREF}}": asset_prefix + "assets/advanced.js",
        "{{BOOK_NAV}}": render_book_navigation(manifest, item),
        "{{BREADCRUMB}}": breadcrumb,
        "{{PAGE_CONTENT}}": content,
        "{{PAGE_TOC}}": toc,
        "{{PAGE_FOOTER}}": footer,
        "{{PAGE_CONTEXT}}": json.dumps(
            context,
            ensure_ascii=False,
            separators=(",", ":"),
        ).replace("</", "<\\/"),
    }
    html = template
    for placeholder, value in replacements.items():
        html = _replace_once(html, placeholder, value)
    if not html.startswith(GENERATED_COMMENT):
        html = GENERATED_COMMENT + "\n" + html
    return html
