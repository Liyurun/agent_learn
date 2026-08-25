"""Generate a compact lazy-loaded search index for both learning tracks."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Literal

import markdown

try:
    from .advanced_content import AdvancedManifest
    from .handbook_build import build_page_specs
except ImportError:  # Direct script execution.
    from advanced_content import AdvancedManifest
    from handbook_build import build_page_specs


Track = Literal["concise", "advanced"]
MAX_SEARCH_TEXT = 16_000


@dataclass(frozen=True)
class SearchDocument:
    id: str
    track: Track
    kind: str
    title: str
    description: str
    route: str
    chapter: str
    domain: str
    tags: tuple[str, ...]
    text: str


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._hidden_depth = 0

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        del attrs
        if tag.lower() in {"script", "style"}:
            self._hidden_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"script", "style"} and self._hidden_depth:
            self._hidden_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self._hidden_depth:
            self.parts.append(data)


def normalize_search_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().lower()


def html_text(value: str) -> str:
    parser = TextExtractor()
    parser.feed(value)
    return normalize_search_text(" ".join(parser.parts))[:MAX_SEARCH_TEXT]


def _concise_documents(
    manifest: dict,
    rendered_items: dict[str, str],
) -> list[SearchDocument]:
    item_lookup = {item["id"]: item for item in manifest["items"]}
    documents = []
    for spec in build_page_specs(manifest):
        if not spec.route:
            continue
        items = [item_lookup[item_id] for item_id in spec.item_ids]
        source = "\n".join(rendered_items[item_id] for item_id in spec.item_ids)
        kinds = {item["kind"] for item in items}
        domain = next(
            (str(item.get("toc_group", "")) for item in items if item.get("toc_group")),
            "",
        )
        tags = set(kinds)
        raw_source = "\n".join(
            rendered_items[item_id] for item_id in spec.item_ids
        )
        if "<pre" in raw_source or "<code" in raw_source:
            tags.add("code")
        if "面试" in domain or spec.route == "quiz":
            tags.add("interview")
        documents.append(SearchDocument(
            id="concise-" + spec.route,
            track="concise",
            kind=next(iter(kinds), "page"),
            title=spec.title,
            description=f"精炼版 · {domain}" if domain else "精炼版",
            route=spec.route,
            chapter=spec.title,
            domain=domain,
            tags=tuple(sorted(tags)),
            text=html_text(source),
        ))
    return documents


def _advanced_documents(
    root: Path,
    manifest: AdvancedManifest,
) -> list[SearchDocument]:
    lookup = {item.id: item for item in manifest.items}
    documents = []
    for item in manifest.items:
        source = (
            root / "content" / "advanced" / item.content_path
        ).read_text(encoding="utf-8")
        rendered = markdown.markdown(
            source,
            extensions=["fenced_code", "tables", "md_in_html"],
        )
        tags = {item.kind}
        if re.search(r"^\s*(```|~~~)", source, re.MULTILINE):
            tags.add("code")
        if item.domain == "advanced-interview":
            tags.add("interview")
        chapter = (
            lookup[item.parent].title
            if item.parent and item.parent in lookup
            else item.title
        )
        documents.append(SearchDocument(
            id=item.id,
            track="advanced",
            kind=item.kind,
            title=item.title,
            description=item.description,
            route=item.route,
            chapter=chapter,
            domain=item.domain,
            tags=tuple(sorted(tags)),
            text=html_text(rendered),
        ))
    return documents


def build_search_documents(
    root: Path,
    concise_manifest: dict,
    rendered_items: dict[str, str],
    advanced_manifest: AdvancedManifest,
) -> list[dict]:
    documents = [
        *_concise_documents(concise_manifest, rendered_items),
        *_advanced_documents(root, advanced_manifest),
    ]
    return [asdict(document) for document in documents]
