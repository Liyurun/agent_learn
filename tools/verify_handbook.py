#!/usr/bin/env python3
"""Validate handbook sources and the generated HTML."""
from __future__ import annotations

import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

try:
    from .handbook_build import (
        GENERATED_COMMENT,
        BuildError,
        build_page_specs,
        load_manifest,
    )
except ImportError:  # Direct script execution: python3 tools/verify_handbook.py
    from handbook_build import (
        GENERATED_COMMENT,
        BuildError,
        build_page_specs,
        load_manifest,
    )


SCRIPT_PATH = Path(__file__).resolve()
PROJECT_ROOT = SCRIPT_PATH.parents[1]
HTML_PATH = PROJECT_ROOT / "agent-learning-handbook.html"
MANIFEST_PATH = PROJECT_ROOT / "content" / "book.json"
DIST_PATH = PROJECT_ROOT / "dist"
BALANCED_TAGS = ("section", "div", "pre", "code", "table", "ul", "ol", "li")
LEGACY_STAGES = {
    "shell": ["learningModes", "moduleAtlas", "modeHub", "moduleAtlasGrid"],
    "content": ["tutorialMap", "patternLibrary", "engineeringDiagnostics"],
    "cases": ["caseLibrary", "scenarioBuilder"],
    "advanced": ["part5", *[f"ch{i}" for i in range(16, 25)], "postTrainingPanel", "benchmarkQuiz"],
}
REQUIRED_MOUNTS = [
    "learningModes", "moduleAtlas", "moduleQuizHub", "tutorialMap", "patternLibrary",
    "engineeringDiagnostics", "evalFrameworkPanel", "guardrailPanel", "debugPlaybook",
    "caseLibrary", "scenarioBuilder", "postTrainingPanel", "finetuneDecision",
    "codingAgentTrace", "benchmarkPanel", "multimodalPanel", "costLatencyPanel",
    "productionPrinciples", "postTrainingQuiz", "benchmarkQuiz",
]


class DocumentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.internal_links: list[str] = []
        self.resources: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(values["id"] or "")
        href = values.get("href")
        if href and href.startswith("#") and len(href) > 1:
            self.internal_links.append(unquote(href[1:]))
        for key in ("src", "href"):
            value = values.get(key)
            if value:
                self.resources.append(value)


def verify_source(root: Path = PROJECT_ROOT) -> list[str]:
    errors: list[str] = []
    try:
        manifest = load_manifest(root / "content" / "book.json")
    except BuildError as exc:
        return [str(exc)]
    missing = [
        item["path"]
        for item in manifest["items"]
        if not (root / "content" / item["path"]).is_file()
    ]
    errors.extend(f"清单内容文件不存在: {path}" for path in missing)
    chapter_ids = {item["id"] for item in manifest["items"] if item["kind"] == "chapter"}
    lab_ids = {item["id"] for item in manifest["items"] if item["kind"] == "lab"}
    expected_chapters = {f"ch{i}" for i in range(1, 25)}
    expected_labs = {f"lab{i}" for i in range(1, 5)}
    if not expected_chapters.issubset(chapter_ids):
        errors.append(f"章节清单不完整: 缺少 {sorted(expected_chapters - chapter_ids)}")
    if not expected_labs.issubset(lab_ids):
        errors.append(f"Lab 清单不完整: 缺少 {sorted(expected_labs - lab_ids)}")
    return errors


def is_local_resource(value: str) -> bool:
    parsed = urlsplit(value)
    return not parsed.scheme and not parsed.netloc and not value.startswith(("#", "data:", "javascript:", "mailto:"))


def verify_html(html: str, root: Path = PROJECT_ROOT) -> list[str]:
    errors: list[str] = []
    parser = DocumentParser()
    parser.feed(html)
    counts = Counter(parser.ids)
    duplicates = sorted(item_id for item_id, count in counts.items() if count > 1)
    errors.extend(f"重复 HTML id: {item_id}" for item_id in duplicates)

    try:
        manifest = load_manifest(root / "content" / "book.json")
    except BuildError as exc:
        return [str(exc)]
    for item in manifest["items"]:
        count = counts[item["id"]]
        if count != 1:
            errors.append(f"清单锚点 {item['id']} 在 HTML 中应出现 1 次，实际 {count} 次")
    for mount in REQUIRED_MOUNTS:
        if counts[mount] != 1:
            errors.append(f"交互挂载点缺失或重复: {mount}（{counts[mount]} 次）")
    for target in sorted(set(parser.internal_links)):
        if target not in counts:
            errors.append(f"内部链接指向不存在锚点: #{target}")

    for tag in BALANCED_TAGS:
        opens = len(re.findall(rf"<{tag}\b", html, re.I))
        closes = len(re.findall(rf"</{tag}\s*>", html, re.I))
        if opens != closes:
            errors.append(f"标签不平衡: <{tag}> {opens} / </{tag}> {closes}")

    candidates = parser.resources + re.findall(r"url\(\s*['\"]?([^)'\"\s]+)", html, re.I)
    for value in sorted(set(candidates)):
        if not is_local_resource(value):
            continue
        path_part = unquote(urlsplit(value).path)
        if path_part and not (root / path_part).resolve().is_file():
            errors.append(f"本地资源不存在: {value}")
    if GENERATED_COMMENT not in html:
        errors.append("生成 HTML 缺少“请勿直接编辑”标记")
    return errors


def _site_page_for_resource(page_path: Path, value: str) -> Path:
    parsed = urlsplit(value)
    if not parsed.path:
        return page_path
    target = (page_path.parent / unquote(parsed.path)).resolve()
    if parsed.path.endswith("/") or target.is_dir():
        target = target / "index.html"
    return target


def verify_site(
    dist: Path,
    expected_routes: set[str] | None = None,
) -> list[str]:
    errors: list[str] = []
    if expected_routes is None:
        try:
            manifest = load_manifest(MANIFEST_PATH)
            expected_routes = {spec.route for spec in build_page_specs(manifest)}
        except BuildError as exc:
            return [str(exc)]

    expected_pages = {
        route: dist / "index.html" if not route else dist / route / "index.html"
        for route in expected_routes
    }
    for route, page_path in expected_pages.items():
        if not page_path.is_file():
            errors.append(f"缺少页面路由: {route or '/'}")

    pages = sorted(dist.rglob("index.html")) if dist.is_dir() else []
    parsed_pages: dict[Path, DocumentParser] = {}
    for page_path in pages:
        try:
            html = page_path.read_text(encoding="utf-8")
        except OSError as exc:
            errors.append(f"页面无法读取: {page_path}: {exc}")
            continue
        parser = DocumentParser()
        parser.feed(html)
        parsed_pages[page_path.resolve()] = parser
        counts = Counter(parser.ids)
        for item_id, count in counts.items():
            if count > 1:
                errors.append(f"{page_path}: 重复 HTML id: {item_id}")
        if GENERATED_COMMENT not in html:
            errors.append(f"{page_path}: 缺少生成文件标记")

    for page_path, parser in parsed_pages.items():
        for value in sorted(set(parser.resources)):
            if not is_local_resource(value):
                continue
            parsed = urlsplit(value)
            target = _site_page_for_resource(page_path, value)
            if not target.is_file():
                errors.append(f"{page_path}: 目标页面不存在: {value}")
                continue
            if not parsed.fragment or target.suffix.lower() != ".html":
                continue
            target_parser = parsed_pages.get(target.resolve())
            if target_parser is None:
                target_parser = DocumentParser()
                target_parser.feed(target.read_text(encoding="utf-8"))
                parsed_pages[target.resolve()] = target_parser
            fragment = unquote(parsed.fragment)
            if fragment not in set(target_parser.ids):
                errors.append(f"{page_path}: 页面锚点不存在: {value}")

        html = page_path.read_text(encoding="utf-8")
        for value in re.findall(r"url\(\s*['\"]?([^)'\"\s]+)", html, re.I):
            if not is_local_resource(value):
                continue
            target = _site_page_for_resource(page_path, value)
            if not target.is_file():
                errors.append(f"{page_path}: 本地资源不存在: {value}")

    for css_path in sorted(dist.rglob("*.css")):
        css = css_path.read_text(encoding="utf-8")
        for value in re.findall(r"url\(\s*['\"]?([^)'\"\s]+)", css, re.I):
            if not is_local_resource(value):
                continue
            target = _site_page_for_resource(css_path, value)
            if not target.is_file():
                errors.append(f"{css_path}: 本地资源不存在: {value}")
    return errors


def main(argv: list[str]) -> int:
    stage = argv[1].lower() if len(argv) > 1 else "final"
    valid = {"source", "built", "final", "pages", *LEGACY_STAGES}
    if stage not in valid:
        print(f"[FAIL] invalid_stage={stage}; valid={','.join(sorted(valid))}")
        return 2
    errors = verify_source()
    if stage not in {"source", "pages"}:
        try:
            html = HTML_PATH.read_text(encoding="utf-8")
        except FileNotFoundError:
            errors.append(f"生成 HTML 不存在: {HTML_PATH}")
            html = ""
        if html:
            if stage in LEGACY_STAGES:
                parser = DocumentParser()
                parser.feed(html)
                present = Counter(parser.ids)
                errors.extend(f"阶段挂载点缺失: {item}" for item in LEGACY_STAGES[stage] if not present[item])
            else:
                errors.extend(verify_html(html))
    if stage == "pages":
        if not DIST_PATH.is_dir():
            errors.append(f"Pages 发布目录不存在: {DIST_PATH}")
        else:
            errors.extend(verify_site(DIST_PATH))
    elif stage == "final" and DIST_PATH.is_dir():
        errors.extend(verify_site(DIST_PATH))
    if errors:
        print(f"[FAIL] stage={stage}; errors={len(errors)}")
        for error in errors:
            print(f" - {error}")
        return 1
    print(f"[PASS] stage={stage}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
