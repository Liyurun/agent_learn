#!/usr/bin/env python3
"""Build agent-learning-handbook.html from the content manifest."""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from html import escape
from pathlib import Path
from typing import Any, Callable

from handbook_build import (
    CONTENT_PLACEHOLDER,
    GENERATED_COMMENT,
    NAV_PLACEHOLDER,
    TOC_PLACEHOLDER,
    BuildError,
    extract_anchor_ids,
    load_manifest,
    normalize_for_compare,
    render_manifest_items,
    render_toc,
    render_top_navigation,
    replace_single_placeholder,
)


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "content" / "book.json"
TEMPLATE_PATH = ROOT / "templates" / "handbook.html"
OUTPUT_PATH = ROOT / "agent-learning-handbook.html"
FULL_BOOK_COVER = """  <!-- ===== COVER ===== -->
  <header class="cover">
    <div class="cover-inner">
      <div class="eyebrow">The Definitive Agent Handbook</div>
      <h1>AI Agent<br>学习与<em>面试宝典</em></h1>
      <p class="sub cjk">从原理到实战，从代码到 offer。一份面向中文开发者的系统性 Agent 学习地图——覆盖核心概念、设计模式、上下文工程、框架选型、动手实践、评估部署与面试冲刺全流程。</p>
      <div class="cover-meta">
        <div><b>6</b>大篇章 · 24 章</div>
        <div><b>60+</b>面试高频题</div>
        <div><b>2026.08</b>数据更新</div>
        <div><b>轻量优先</b>smolagents + PydanticAI 主线</div>
      </div>
    </div>
  </header>"""


def replace_required_placeholder(template: str, placeholder: str, value: str) -> str:
    if placeholder not in template:
        raise BuildError(f"模板缺少 {placeholder}")
    return template.replace(placeholder, value)


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
    content_open: str,
    content_close: str,
    href_for: Callable[[str], str] | None = None,
) -> str:
    html = replace_single_placeholder(
        template,
        NAV_PLACEHOLDER,
        render_top_navigation(manifest, href_for=href_for, home_href=home_href),
    )
    replacements = {
        "{{PAGE_TITLE}}": escape(title),
        "{{PAGE_DESCRIPTION}}": escape(description, quote=True),
        "{{BODY_CLASS}}": escape(body_class, quote=True),
        "{{HOME_HREF}}": escape(home_href, quote=True),
        "{{BOOK_COVER}}": cover_html,
        "{{BOOK_PAGE_CONTEXT}}": json.dumps(
            page_context, ensure_ascii=False, separators=(",", ":")
        ).replace("</", "<\\/"),
        "{{CONTENT_OPEN}}": content_open,
        "{{CONTENT_CLOSE}}": content_close,
        CONTENT_PLACEHOLDER: content,
    }
    for placeholder, value in replacements.items():
        html = replace_single_placeholder(html, placeholder, value)
    html = replace_required_placeholder(html, "{{ASSET_PREFIX}}", asset_prefix)
    if not html.startswith(GENERATED_COMMENT):
        html = GENERATED_COMMENT + "\n" + html
    return html


def build(compare_path: Path | None = None) -> str:
    manifest = load_manifest(MANIFEST_PATH)
    missing = [
        ROOT / "content" / item["path"]
        for item in manifest["items"]
        if not (ROOT / "content" / item["path"]).is_file()
    ]
    if missing:
        raise BuildError("缺少内容文件:\n" + "\n".join(f" - {path}" for path in missing))
    try:
        template = TEMPLATE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise BuildError(f"模板不存在: {TEMPLATE_PATH}") from exc

    rendered = render_manifest_items(ROOT, manifest)
    content = "".join(rendered[item["id"]] for item in manifest["items"])
    content = replace_single_placeholder(content, TOC_PLACEHOLDER, render_toc(manifest))
    html = render_document(
        template=template,
        manifest=manifest,
        content=content,
        title="Agent 学习与面试宝典 · 2026",
        description="面向中文开发者的系统性 Agent 学习与面试宝典。",
        body_class="full-book",
        asset_prefix=".",
        home_href="#",
        cover_html=FULL_BOOK_COVER,
        page_context={},
        content_open='  <div class="page">\n',
        content_close="",
    )

    if compare_path:
        try:
            baseline = compare_path.read_text(encoding="utf-8")
        except FileNotFoundError as exc:
            raise BuildError(f"对比基线不存在: {compare_path}") from exc
        if normalize_for_compare(baseline) != normalize_for_compare(html):
            before_ids = extract_anchor_ids(baseline)
            after_ids = extract_anchor_ids(html)
            detail = ""
            if before_ids != after_ids:
                detail = f"；锚点序列不同（原 {len(before_ids)}，新 {len(after_ids)}）"
            raise BuildError(f"构建结果与迁移基线不一致{detail}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=".handbook-", suffix=".html", dir=OUTPUT_PATH.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            handle.write(html)
        os.replace(temp_name, OUTPUT_PATH)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise
    return html


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compare", type=Path, help="与迁移前 HTML 做规范化无损对比")
    args = parser.parse_args()
    try:
        html = build(args.compare.resolve() if args.compare else None)
    except (BuildError, OSError) as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1
    print(f"[PASS] 已构建 {OUTPUT_PATH}（{len(html.encode('utf-8')):,} bytes）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
