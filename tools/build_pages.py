#!/usr/bin/env python3
"""Build the GitHub Pages publish directory."""
from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

from build import OUTPUT_PATH, ROOT, build


DIST_PATH = ROOT / "dist"
PDF_PATH = ROOT / "Agent学习与面试宝典.pdf"


def copy_tree(source: Path, target: Path) -> None:
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)


def main() -> int:
    html = build()
    fd, temp_name = tempfile.mkstemp(prefix=".pages-", suffix="", dir=ROOT)
    os.close(fd)
    temp_dir = Path(temp_name)
    temp_dir.unlink()
    temp_dir.mkdir(parents=True)
    try:
        (temp_dir / "index.html").write_text(html, encoding="utf-8", newline="")
        copy_tree(ROOT / "assets", temp_dir / "assets")
        copy_tree(ROOT / "_shared", temp_dir / "_shared")
        if PDF_PATH.is_file():
            shutil.copy2(PDF_PATH, temp_dir / PDF_PATH.name)
        os.replace(temp_dir, DIST_PATH)
    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    print(f"[PASS] 已生成 GitHub Pages 发布目录: {DIST_PATH}")
    print(f"[PASS] 页面入口: {DIST_PATH / 'index.html'}")
    print(f"[INFO] HTML 字节数: {len(html.encode('utf-8'))}")
    print(f"[INFO] 源 HTML 同步: {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
