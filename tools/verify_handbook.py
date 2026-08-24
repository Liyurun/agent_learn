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
    from .handbook_build import GENERATED_COMMENT, BuildError, load_manifest
except ImportError:  # Direct script execution: python3 tools/verify_handbook.py
    from handbook_build import GENERATED_COMMENT, BuildError, load_manifest


SCRIPT_PATH = Path(__file__).resolve()
PROJECT_ROOT = SCRIPT_PATH.parents[1]
HTML_PATH = PROJECT_ROOT / "agent-learning-handbook.html"
MANIFEST_PATH = PROJECT_ROOT / "content" / "book.json"
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


def main(argv: list[str]) -> int:
    stage = argv[1].lower() if len(argv) > 1 else "final"
    valid = {"source", "built", "final", *LEGACY_STAGES}
    if stage not in valid:
        print(f"[FAIL] invalid_stage={stage}; valid={','.join(sorted(valid))}")
        return 2
    errors = verify_source()
    if stage != "source":
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
    if errors:
        print(f"[FAIL] stage={stage}; errors={len(errors)}")
        for error in errors:
            print(f" - {error}")
        return 1
    print(f"[PASS] stage={stage}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
