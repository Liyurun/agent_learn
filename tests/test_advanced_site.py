from __future__ import annotations

import json
import re
import tempfile
import unittest
from collections import Counter
from pathlib import Path

from tools.advanced_content import (
    AdvancedDomain,
    AdvancedItem,
    AdvancedManifest,
    chapter_pages,
    load_advanced_manifest,
    page_neighbors,
    validate_advanced_manifest,
)
from tools.build_pages import build_site
from tools.handbook_build import BuildError


ROOT = Path(__file__).resolve().parents[1]


class AdvancedManifestTests(unittest.TestCase):
    def test_real_manifest_has_expected_shape(self) -> None:
        manifest = load_advanced_manifest(
            ROOT / "content" / "advanced" / "manifest.json"
        )
        kinds = Counter(item.kind for item in manifest.items)

        self.assertEqual(kinds["chapter"], 31)
        self.assertEqual(kinds["section"], 220)
        self.assertEqual(kinds["appendix"], 4)
        self.assertEqual(kinds["guide"], 1)
        self.assertEqual(len({item.route for item in manifest.items}), 256)

    def test_section_requires_existing_parent(self) -> None:
        orphan = AdvancedItem(
            id="advanced-ch27-context-budget",
            slug="chapter-27/context-budget",
            route="advanced/chapter-27/context-budget",
            kind="section",
            title="上下文预算与动态组装",
            description="预算说明",
            domain="advanced-frontier",
            order=23,
            source_path="source.md",
            content_path="pages/chapter-27/context-budget.md",
            parent="advanced-missing",
            section_order=3,
        )
        domain = AdvancedDomain(
            id="advanced-frontier",
            title="卷七 · 进阶专题",
            order=7,
            chapter_ids=(),
        )
        manifest = AdvancedManifest(
            version=1,
            track="advanced",
            source="fixture.zip",
            domains=(domain,),
            items=(orphan,),
        )

        with self.assertRaisesRegex(BuildError, "missing parent"):
            validate_advanced_manifest(manifest)

    def test_chapter_pages_and_global_neighbors_are_stable(self) -> None:
        manifest = load_advanced_manifest(
            ROOT / "content" / "advanced" / "manifest.json"
        )
        ch27 = chapter_pages(manifest, "advanced-ch27")
        previous, following = page_neighbors(manifest, "advanced-ch27")

        self.assertEqual(len(ch27), 11)
        self.assertEqual(ch27[1].id, "advanced-ch27-context-problem")
        self.assertEqual(previous.id, "advanced-ch26-s07")
        self.assertEqual(following.id, "advanced-ch27-context-problem")


class AdvancedPageBuildTests(unittest.TestCase):
    def test_build_writes_chapter_section_and_appendix_routes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output_dir=output)

            self.assertTrue((output / "advanced" / "index.html").is_file())
            self.assertTrue(
                (output / "advanced/chapter-27/index.html").is_file()
            )
            self.assertTrue(
                (
                    output
                    / "advanced/chapter-27/context-budget/index.html"
                ).is_file()
            )
            self.assertTrue(
                (output / "advanced/chapter-31/index.html").is_file()
            )
            self.assertTrue(
                (output / "advanced/appendix-b/index.html").is_file()
            )

    def test_advanced_page_contains_only_selected_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output_dir=output)
            page = (
                output
                / "advanced/chapter-27/context-problem/index.html"
            ).read_text(encoding="utf-8")

            self.assertIn("上下文工程解决什么问题", page)
            self.assertNotIn("裁判的三大系统性偏差", page)
            self.assertIn('data-page-id="advanced-ch27-context-problem"', page)
            self.assertIn("../../../assets/advanced.css", page)
            self.assertIn("../../../assets/advanced.js", page)

    def test_advanced_internal_links_are_project_relative(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output_dir=output)
            pages = list((output / "advanced").rglob("index.html"))

            self.assertEqual(len(pages), 256)
            self.assertFalse(any(
                re.search(r'href="/advanced/', page.read_text(encoding="utf-8"))
                for page in pages
            ))


class AdvancedClientContractTests(unittest.TestCase):
    def test_advanced_state_is_separate_from_concise_state(self) -> None:
        script = (ROOT / "assets" / "advanced.js").read_text(encoding="utf-8")

        self.assertIn('"ah-advanced-learning-state"', script)
        self.assertIn('"ah-advanced-last-page"', script)
        self.assertNotIn('"ah-read-chapters"', script)
        self.assertIn("completedSections", script)
        self.assertIn("completedChapters", script)


if __name__ == "__main__":
    unittest.main()
