#!/usr/bin/env python3
"""Build agent-learning-handbook.html from the content manifest."""
from __future__ import annotations

import argparse
import os
import sys
import tempfile
from pathlib import Path

from handbook_build import (
    CONTENT_PLACEHOLDER,
    GENERATED_COMMENT,
    NAV_PLACEHOLDER,
    TOC_PLACEHOLDER,
    BuildError,
    extract_anchor_ids,
    load_manifest,
    normalize_for_compare,
    render_content_file,
    render_toc,
    render_top_navigation,
    replace_single_placeholder,
)


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "content" / "book.json"
TEMPLATE_PATH = ROOT / "templates" / "handbook.html"
OUTPUT_PATH = ROOT / "agent-learning-handbook.html"


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

    rendered = [
        render_content_file(ROOT / "content" / item["path"], item)
        for item in manifest["items"]
    ]
    content = "".join(rendered)
    content = replace_single_placeholder(content, TOC_PLACEHOLDER, render_toc(manifest))
    html = replace_single_placeholder(template, NAV_PLACEHOLDER, render_top_navigation(manifest))
    html = replace_single_placeholder(html, CONTENT_PLACEHOLDER, content)
    if not html.startswith(GENERATED_COMMENT):
        html = GENERATED_COMMENT + "\n" + html

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
