#!/usr/bin/env python3
"""Import and normalize the advanced handbook archive."""
from __future__ import annotations

import argparse
import json
import os
import posixpath
import re
import shutil
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Callable
from urllib.parse import unquote, urlsplit
from zipfile import ZipFile

import yaml


ROOT = Path(__file__).resolve().parents[1]
CONTENT_MARKER = "/site/src/content/chapters/"
EXAMPLE_MARKER = "/examples/context-engineering-agent/"
REQUIRED_FIELDS = {
    "title",
    "slug",
    "section",
    "volume",
    "order",
    "sourcePath",
    "description",
}
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
IMAGE_PROMPT_RE = re.compile(r"^#{1,6}\s+图片生成描述")
HEADING_RE = re.compile(r"^(#{1,6})\s+")
TRAE_REF_RE = re.compile(r"\[\$TRAE_REF\]\(([^)]+)\)")
FENCE_RE = re.compile(r"^\s*(```|~~~)")
CHAPTER_SLUG_RE = re.compile(r"^chapter-(\d+)$")
CHAPTER_ID_RE = re.compile(r"^chapter-(\d+)")
MARKDOWN_FILE_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
EXAMPLE_ALLOWED_ROOTS = {
    "README.md",
    "pyproject.toml",
    ".env.example",
    "src",
    "tests",
    "sample_data",
}
EXAMPLE_EXCLUDED_PARTS = {
    "__pycache__",
    ".pytest_cache",
    ".env",
}


class AdvancedImportError(ValueError):
    """Raised when the advanced source archive is not safe or well formed."""


@dataclass(frozen=True)
class SourceMember:
    archive_name: str
    relative_path: str


def _safe_relative_path(value: str) -> PurePosixPath:
    path = PurePosixPath(value)
    if path.is_absolute() or not path.parts or ".." in path.parts:
        raise AdvancedImportError(f"unsafe archive path: {value}")
    return path


def discover_content_members(archive: Path) -> list[SourceMember]:
    with ZipFile(archive) as source:
        names = source.namelist()

    roots = {
        name.split(CONTENT_MARKER, 1)[0]
        for name in names
        if CONTENT_MARKER in name
    }
    if len(roots) != 1:
        raise AdvancedImportError(
            "archive must contain exactly one advanced content root"
        )

    members = []
    for name in names:
        if CONTENT_MARKER not in name or not name.endswith(".md"):
            continue
        relative = name.split(CONTENT_MARKER, 1)[1]
        path = _safe_relative_path(relative)
        members.append(SourceMember(name, path.as_posix()))
    if not members:
        raise AdvancedImportError("advanced archive contains no Markdown pages")
    return sorted(members, key=lambda member: member.relative_path)


def split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    normalized = text.replace("\r\n", "\n")
    if not normalized.startswith("---\n"):
        raise AdvancedImportError("advanced page is missing YAML frontmatter")
    end = normalized.find("\n---\n", 4)
    if end < 0:
        raise AdvancedImportError("advanced page has unterminated YAML frontmatter")
    metadata = yaml.safe_load(normalized[4:end]) or {}
    if not isinstance(metadata, dict):
        raise AdvancedImportError("advanced page frontmatter must be a mapping")
    missing = sorted(REQUIRED_FIELDS - metadata.keys())
    if missing:
        raise AdvancedImportError(
            "advanced page frontmatter missing fields: " + ", ".join(missing)
        )
    return metadata, normalized[end + 5:]


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
    cleaned = "\n".join(output).strip()
    return cleaned + ("\n" if cleaned else "")


def clean_prose(text: str) -> str:
    text = remove_image_prompt_sections(text)
    text = TRAE_REF_RE.sub(r"[来源](\1)", text)
    return text.replace("/chapters/", "/advanced/")


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


def build_source_route_map(items: list[dict[str, Any]]) -> dict[str, str]:
    routes = {"SUMMARY.md": "advanced"}
    for item in items:
        source_path = PurePosixPath(item["sourcePath"]).as_posix()
        routes[source_path] = item["route"]
        if source_path.endswith("/README.md"):
            routes[source_path[:-len("/README.md")] + ".md"] = item["route"]
    return routes


def rewrite_source_markdown_links(
    text: str,
    *,
    current_source_path: str,
    source_routes: dict[str, str],
) -> str:
    current_parent = PurePosixPath(current_source_path).parent.as_posix()

    def rewrite(match: re.Match[str]) -> str:
        label, href = match.groups()
        parsed = urlsplit(href)
        if parsed.scheme or parsed.netloc or not parsed.path.endswith(".md"):
            return match.group(0)
        path = unquote(parsed.path)
        if path.startswith("/"):
            resolved = posixpath.normpath(path.lstrip("/"))
        else:
            resolved = posixpath.normpath(posixpath.join(current_parent, path))
        route = source_routes.get(resolved) or source_routes.get(path)
        if route is None:
            return label
        fragment = f"#{parsed.fragment}" if parsed.fragment else ""
        return f"[{label}](/{route}/{fragment})"

    return transform_outside_fences(
        text,
        lambda prose: MARKDOWN_FILE_LINK_RE.sub(rewrite, prose),
    )


def validate_clean_markdown(text: str, source_path: str) -> None:
    errors = []
    if "TRAE_REF" in text:
        errors.append("residual TRAE_REF")
    if re.search(r"^#{1,6}\s+图片生成描述", text, re.MULTILINE):
        errors.append("visible image-generation prompt")
    if errors:
        raise AdvancedImportError(f"{source_path}: {', '.join(errors)}")


def make_advanced_id(slug: str) -> str:
    normalized = CHAPTER_ID_RE.sub(
        lambda match: "ch" + match.group(1),
        slug.strip("/"),
    )
    return "advanced-" + normalized.replace("/", "-")


def build_item(metadata: dict[str, Any]) -> dict[str, Any]:
    missing = sorted(REQUIRED_FIELDS - metadata.keys())
    if missing:
        raise AdvancedImportError("missing fields: " + ", ".join(missing))

    slug = str(metadata["slug"]).strip("/")
    if metadata.get("isChapterLanding") is True or CHAPTER_SLUG_RE.fullmatch(slug):
        kind = "chapter"
    elif metadata.get("sectionSlug"):
        kind = "section"
    elif slug.startswith("appendix-"):
        kind = "appendix"
    elif slug == "guide":
        kind = "guide"
    else:
        raise AdvancedImportError(f"cannot classify advanced page: {slug}")

    volume = str(metadata["volume"])
    try:
        domain_id, _ = DOMAIN_BY_VOLUME[volume]
    except KeyError as exc:
        raise AdvancedImportError(f"unknown advanced volume: {volume}") from exc

    chapter_slug = metadata.get("chapterSlug")
    if kind == "section" and not chapter_slug:
        raise AdvancedImportError(f"section is missing chapterSlug: {slug}")
    section_order = metadata.get("sectionOrder")
    if kind == "section" and section_order is None:
        raise AdvancedImportError(f"section is missing sectionOrder: {slug}")

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
        "sectionOrder": int(section_order) if section_order is not None else None,
    }


def build_manifest(items: list[dict[str, Any]]) -> dict[str, Any]:
    items = sorted(
        items,
        key=lambda item: (
            item["order"],
            item["sectionOrder"] if item["sectionOrder"] is not None else 0,
            item["slug"],
        ),
    )
    seen_ids: set[str] = set()
    seen_slugs: set[str] = set()
    seen_routes: set[str] = set()
    seen_section_orders: set[tuple[str, int]] = set()
    for item in items:
        for label, value, seen in (
            ("id", item["id"], seen_ids),
            ("slug", item["slug"], seen_slugs),
            ("route", item["route"], seen_routes),
        ):
            if value in seen:
                raise AdvancedImportError(f"duplicate {label}: {value}")
            seen.add(value)
        if item["kind"] == "section":
            key = (item["parent"], item["sectionOrder"])
            if key in seen_section_orders:
                raise AdvancedImportError(
                    f"duplicate section order: {key[0]} #{key[1]}"
                )
            seen_section_orders.add(key)

    chapter_ids = {
        item["id"] for item in items if item["kind"] == "chapter"
    }
    for item in items:
        if item["kind"] == "section" and item["parent"] not in chapter_ids:
            raise AdvancedImportError(
                f"section parent does not exist: {item['id']} -> {item['parent']}"
            )

    domains = []
    for volume, (domain_id, domain_order) in DOMAIN_BY_VOLUME.items():
        domain_chapters = [
            item["id"]
            for item in items
            if item["domain"] == domain_id and item["kind"] == "chapter"
        ]
        domains.append({
            "id": domain_id,
            "title": volume,
            "order": domain_order,
            "chapterIds": domain_chapters,
        })
    return {
        "version": 1,
        "track": "advanced",
        "source": "AI-Agent-学习实践面试宝典-完整内容.zip",
        "domains": domains,
        "items": items,
    }


def replace_tree(staged: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
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


def _write_provenance(target: Path) -> None:
    target.write_text(
        """# Advanced handbook content

Source archive: `AI-Agent-学习实践面试宝典-完整内容.zip`

This directory contains normalized source content only. The bundled Astro site,
generated HTML, Pagefind output, caches, logs, and build metadata are excluded.

Regenerate with:

```bash
python3 tools/import_advanced_handbook.py --archive "$ADVANCED_SOURCE_ZIP"
```
""",
        encoding="utf-8",
    )


def import_archive(archive: Path, output_root: Path) -> dict[str, Any]:
    members = discover_content_members(archive)
    output_root.parent.mkdir(parents=True, exist_ok=True)
    staged = Path(tempfile.mkdtemp(
        prefix=".advanced-import-",
        dir=output_root.parent,
    ))
    try:
        pages = staged / "pages"
        records: list[tuple[dict[str, Any], str]] = []
        with ZipFile(archive) as source:
            for member in members:
                metadata, body = split_frontmatter(
                    source.read(member.archive_name).decode("utf-8")
                )
                item = build_item(metadata)
                records.append((item, body))

            source_routes = build_source_route_map(
                [item for item, _ in records]
            )
            items = []
            for item, body in records:
                cleaned = clean_markdown(body)
                cleaned = rewrite_source_markdown_links(
                    cleaned,
                    current_source_path=item["sourcePath"],
                    source_routes=source_routes,
                )
                validate_clean_markdown(cleaned, item["sourcePath"])
                target = pages / (item["slug"] + ".md")
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(cleaned, encoding="utf-8")
                item["contentPath"] = target.relative_to(staged).as_posix()
                items.append(item)
        manifest = build_manifest(items)
        (staged / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        _write_provenance(staged / "README.md")
        replace_tree(staged, output_root)
        return manifest
    except Exception:
        shutil.rmtree(staged, ignore_errors=True)
        raise


def _is_allowed_example_path(path: PurePosixPath) -> bool:
    if path.parts[0] not in EXAMPLE_ALLOWED_ROOTS:
        return False
    if any(part in EXAMPLE_EXCLUDED_PARTS for part in path.parts):
        return False
    if any(part.endswith(".egg-info") for part in path.parts):
        return False
    if path.name.endswith((".pyc", ".pyo")):
        return False
    return True


def import_example(archive: Path, output_root: Path) -> int:
    output_root.parent.mkdir(parents=True, exist_ok=True)
    staged = Path(tempfile.mkdtemp(
        prefix=".advanced-example-",
        dir=output_root.parent,
    ))
    count = 0
    try:
        with ZipFile(archive) as source:
            roots = {
                name.split(EXAMPLE_MARKER, 1)[0]
                for name in source.namelist()
                if EXAMPLE_MARKER in name
            }
            if len(roots) != 1:
                raise AdvancedImportError(
                    "archive must contain exactly one context example root"
                )
            for name in source.namelist():
                if EXAMPLE_MARKER not in name or name.endswith("/"):
                    continue
                relative = _safe_relative_path(
                    name.split(EXAMPLE_MARKER, 1)[1]
                )
                if not _is_allowed_example_path(relative):
                    continue
                target = staged.joinpath(*relative.parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source.read(name))
                count += 1
        if count == 0:
            raise AdvancedImportError("context example contains no files")
        replace_tree(staged, output_root)
        return count
    except Exception:
        shutil.rmtree(staged, ignore_errors=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "content" / "advanced",
    )
    parser.add_argument(
        "--example-output",
        type=Path,
        default=ROOT / "examples" / "context-engineering-agent",
    )
    args = parser.parse_args()
    archive = args.archive.expanduser().resolve()
    if not archive.is_file():
        raise AdvancedImportError(f"archive does not exist: {archive}")

    manifest = import_archive(archive, args.output.resolve())
    example_files = import_example(archive, args.example_output.resolve())
    counts = Counter(item["kind"] for item in manifest["items"])
    print(
        "[PASS] advanced import: "
        f"chapters={counts['chapter']} sections={counts['section']} "
        f"appendices={counts['appendix']} guides={counts['guide']}"
    )
    print(f"[PASS] context example: files={example_files}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
