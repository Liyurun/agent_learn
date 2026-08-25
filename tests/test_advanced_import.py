from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from tools.import_advanced_handbook import (
    AdvancedImportError,
    build_item,
    build_manifest,
    clean_markdown,
    discover_content_members,
    import_archive,
    split_frontmatter,
)


REQUIRED_FRONTMATTER = """---
title: "第 1 章 · 认识 Agent"
slug: "chapter-01"
section: "第一部分 · 系统学习教材"
volume: "卷一 · 认识 Agent"
order: 2
sourcePath: "第一部分/第1章.md"
description: "建立 Agent 基础概念。"
isChapterLanding: true
---
"""

SAMPLE_LANDING = REQUIRED_FRONTMATTER + "# 第 1 章\n"
SAMPLE_SECTION = """---
title: "Agent 的定义"
slug: "chapter-01/definition"
section: "第一部分 · 系统学习教材"
volume: "卷一 · 认识 Agent"
order: 2
sourcePath: "第一部分/第1章/01-Agent的定义.md"
description: "Agent 的基础定义。"
chapterSlug: "chapter-01"
sectionSlug: "definition"
sectionOrder: 2
---
## Agent 的定义
"""


def make_archive(root: Path, members: dict[str, str]) -> Path:
    archive = root / "fixture.zip"
    with ZipFile(archive, "w") as target:
        for name, content in members.items():
            target.writestr(name, content)
    return archive


class ArchiveDiscoveryTests(unittest.TestCase):
    def test_discovers_only_normalized_site_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            archive = make_archive(Path(tmp), {
                "Book/site/src/content/chapters/chapter-01.md": SAMPLE_LANDING,
                "Book/site/src/content/chapters/chapter-01/s01.md": SAMPLE_SECTION,
                "Book/site/dist/index.html": "<html></html>",
                "Book/site/pagefind/pagefind.js": "generated",
            })

            members = discover_content_members(archive)

        self.assertEqual(
            [member.relative_path for member in members],
            ["chapter-01.md", "chapter-01/s01.md"],
        )

    def test_rejects_multiple_content_roots(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            archive = make_archive(Path(tmp), {
                "BookA/site/src/content/chapters/chapter-01.md": SAMPLE_LANDING,
                "BookB/site/src/content/chapters/chapter-02.md": SAMPLE_LANDING,
            })

            with self.assertRaisesRegex(
                AdvancedImportError,
                "exactly one advanced content root",
            ):
                discover_content_members(archive)

    def test_split_frontmatter_requires_all_metadata(self) -> None:
        with self.assertRaisesRegex(AdvancedImportError, "missing fields: title"):
            split_frontmatter(
                "---\nslug: chapter-01\nsection: x\nvolume: x\n"
                "order: 1\nsourcePath: x\ndescription: x\n---\nbody\n"
            )


class MarkdownCleanerTests(unittest.TestCase):
    def test_converts_refs_and_hides_author_prompts(self) -> None:
        source = """正文 [$TRAE_REF](https://example.com/source)

## 图片生成描述：架构图

> **用途**：作者提示，不应展示。

## 生产踩坑

保留这一节。
"""

        cleaned = clean_markdown(source)

        self.assertIn("[来源](https://example.com/source)", cleaned)
        self.assertNotIn("TRAE_REF", cleaned)
        self.assertNotIn("图片生成描述", cleaned)
        self.assertNotIn("作者提示", cleaned)
        self.assertIn("## 生产踩坑", cleaned)

    def test_rewrites_advanced_routes(self) -> None:
        source = "[预算](/chapters/chapter-27/context-budget/)"
        self.assertEqual(
            clean_markdown(source).strip(),
            "[预算](/advanced/chapter-27/context-budget/)",
        )

    def test_does_not_rewrite_fenced_code(self) -> None:
        source = """```markdown
[$TRAE_REF](https://example.com/source)
[预算](/chapters/chapter-27/context-budget/)
```
"""
        self.assertEqual(clean_markdown(source), source)


class ManifestGenerationTests(unittest.TestCase):
    def test_build_item_normalizes_identity_and_parent(self) -> None:
        item = build_item({
            "title": "上下文预算与动态组装",
            "slug": "chapter-27/context-budget",
            "section": "第一部分 · 系统学习教材",
            "volume": "卷七 · 进阶专题",
            "order": 23,
            "sourcePath": "source.md",
            "description": "预算说明",
            "chapterSlug": "chapter-27",
            "sectionSlug": "context-budget",
            "sectionOrder": 3,
            "isChapterLanding": False,
        })

        self.assertEqual(item["id"], "advanced-ch27-context-budget")
        self.assertEqual(item["route"], "advanced/chapter-27/context-budget")
        self.assertEqual(item["kind"], "section")
        self.assertEqual(item["parent"], "advanced-ch27")

    def test_chapter_slug_is_a_landing_fallback(self) -> None:
        item = build_item({
            "title": "第 31 章 · 分类面试题库",
            "slug": "chapter-31",
            "section": "第二部分 · 面试冲刺",
            "volume": "第二部分 · 面试冲刺",
            "order": 32,
            "sourcePath": "第二部分/第31章.md",
            "description": "面试题库。",
        })

        self.assertEqual(item["kind"], "chapter")
        self.assertEqual(item["id"], "advanced-ch31")

    def test_guide_uses_advanced_root_route(self) -> None:
        item = build_item({
            "title": "封面与导读",
            "slug": "guide",
            "section": "导读",
            "volume": "开始阅读",
            "order": 1,
            "sourcePath": "README.md",
            "description": "导读。",
        })

        self.assertEqual(item["id"], "advanced-guide")
        self.assertEqual(item["kind"], "guide")
        self.assertEqual(item["route"], "advanced")

    def test_manifest_rejects_duplicate_routes(self) -> None:
        first = build_item({
            "title": "封面与导读",
            "slug": "guide",
            "section": "导读",
            "volume": "开始阅读",
            "order": 1,
            "sourcePath": "README.md",
            "description": "导读。",
        })
        second = dict(first, id="another-id", slug="another-guide")

        with self.assertRaisesRegex(AdvancedImportError, "duplicate route"):
            build_manifest([first, second])

    def test_import_archive_is_deterministic(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            archive = make_archive(root, {
                "Book/site/src/content/chapters/chapter-01.md": SAMPLE_LANDING,
                "Book/site/src/content/chapters/chapter-01/definition.md":
                    SAMPLE_SECTION,
            })
            output = root / "advanced"

            first = import_archive(archive, output)
            first_json = (output / "manifest.json").read_text(encoding="utf-8")
            second = import_archive(archive, output)
            second_json = (output / "manifest.json").read_text(encoding="utf-8")

        self.assertEqual(first, second)
        self.assertEqual(first_json, second_json)
        self.assertEqual(len(json.loads(first_json)["items"]), 2)


if __name__ == "__main__":
    unittest.main()
