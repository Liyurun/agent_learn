from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tools.handbook_build import (
    GENERATED_COMMENT,
    NAV_PLACEHOLDER,
    BuildError,
    extract_anchor_ids,
    inject_heading_ids,
    is_raw_section,
    load_manifest,
    normalize_for_compare,
    render_content_file,
    render_top_navigation,
    replace_single_placeholder,
)
from tools.split_html import atomic_write_text, split
from tools.verify_handbook import verify_html, verify_source


ITEM = {"path": "chapter.md", "id": "demo", "kind": "chapter", "title": "演示", "toc": True}
ROOT = Path(__file__).resolve().parents[1]


class BuildCoreTests(unittest.TestCase):
    def test_load_manifest_validates_duplicates_and_fields(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "book.json"
            path.write_text(json.dumps({"items": [ITEM, ITEM]}), encoding="utf-8")
            with self.assertRaisesRegex(BuildError, "重复内容路径"):
                load_manifest(path)
            path.write_text(json.dumps({"items": [{"path": "x"}]}), encoding="utf-8")
            with self.assertRaisesRegex(BuildError, "缺少字段"):
                load_manifest(path)

    def test_render_raw_html_without_changes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "raw.md"
            raw = '<section class="chapter" id="demo"><h2>原样</h2></section>\n'
            path.write_text(raw, encoding="utf-8")
            self.assertEqual(render_content_file(path, ITEM), raw)

    def test_raw_html_requires_only_native_blocks(self) -> None:
        self.assertTrue(is_raw_section("<!-- migrated -->\n<section><p>x</p></section>\n"))
        self.assertTrue(is_raw_section("<div>part</div>\n<div class=\"page\">\n"))
        self.assertFalse(is_raw_section("<span>inline only</span>"))
        self.assertFalse(is_raw_section("<section><div>x</section></div>"))
        self.assertFalse(is_raw_section("<section><p>x</p></section>\n\n# Markdown"))
        self.assertFalse(is_raw_section("<div>callout</div>\n\n**Markdown**"))

    def test_render_markdown_with_tables_code_and_attributes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "chapter.md"
            path.write_text("# 小节\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```py\nprint(1)\n```\n", encoding="utf-8")
            rendered = render_content_file(path, ITEM)
            self.assertIn('<section class="chapter" id="demo">', rendered)
            self.assertIn("<table>", rendered)
            self.assertIn('<code class="language-py">', rendered)

    def test_render_mixed_markdown_after_native_html(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "mixed.md"
            path.write_text(
                '<div class="callout">原生提示</div>\n\n'
                '# Markdown 标题\n\n'
                '<div markdown="1">\n\n**容器内加粗**\n\n</div>\n',
                encoding="utf-8",
            )
            rendered = render_content_file(path, ITEM)
            self.assertIn('<div class="callout">原生提示</div>', rendered)
            self.assertIn("<h1>Markdown 标题</h1>", rendered)
            self.assertIn("<strong>容器内加粗</strong>", rendered)

    def test_replace_requires_exactly_one_placeholder(self) -> None:
        self.assertEqual(replace_single_placeholder("a{{X}}b", "{{X}}", "ok"), "aokb")
        for value in ("none", "{{X}}{{X}}"):
            with self.assertRaisesRegex(BuildError, "恰好包含一个"):
                replace_single_placeholder(value, "{{X}}", "ok")

    def test_extract_ids_and_normalize(self) -> None:
        self.assertEqual(extract_anchor_ids('<div id="a"><span id="b"></span></div>'), ["a", "b"])
        before = "<div> \n <span>x</span> </div>"
        after = GENERATED_COMMENT + "\n<div>\n<span>x</span>\n</div>"
        self.assertEqual(normalize_for_compare(before), normalize_for_compare(after))

    def test_top_navigation_groups_all_toc_items_and_resources(self) -> None:
        manifest = load_manifest(ROOT / "content" / "book.json")
        navigation = render_top_navigation(manifest)
        self.assertEqual(navigation.count('class="nav-group"'), 6)
        for item in manifest["items"]:
            if item["toc"]:
                self.assertIn(f'href="#{item["id"]}"', navigation)
        for part in range(1, 7):
            self.assertIn(f'href="#part{part}"', navigation)
        self.assertIn('href="#resources"', navigation)
        self.assertIn('aria-haspopup="true"', navigation)
        self.assertIn('aria-expanded="false"', navigation)

    def test_top_navigation_automatically_includes_new_chapter(self) -> None:
        manifest = load_manifest(ROOT / "content" / "book.json")
        manifest["items"].append({
            "path": "chapters/new.md", "id": "new-chapter", "kind": "chapter",
            "title": "新增章节", "toc": True, "toc_group": "第一篇 · 原理", "number": "99",
        })
        navigation = render_top_navigation(manifest)
        self.assertIn('href="#new-chapter"', navigation)
        self.assertIn("99", navigation)
        self.assertIn("新增章节", navigation)

    def test_heading_ids_are_stable_unique_and_preserve_existing_ids(self) -> None:
        source = '<section class="chapter"><h3>一</h3><div><h3 id="kept">二</h3></div><h3>三</h3></section>'
        once = inject_heading_ids(source, "ch10")
        twice = inject_heading_ids(once, "ch10")
        self.assertEqual(once, twice)
        self.assertIn('<h3 id="ch10-section-01">', once)
        self.assertIn('<h3 id="kept">', once)
        self.assertIn('<h3 id="ch10-section-03">', once)
        ids = extract_anchor_ids(once)
        self.assertEqual(len(ids), len(set(ids)))

    def test_render_content_injects_ids_for_raw_and_markdown_chapter_h3(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            raw_path = Path(tmp) / "raw.md"
            raw_path.write_text('<section class="chapter" id="demo"><h3>原生</h3></section>', encoding="utf-8")
            self.assertIn('id="demo-section-01"', render_content_file(raw_path, ITEM))
            markdown_path = Path(tmp) / "markdown.md"
            markdown_path.write_text("### Markdown 小节\n", encoding="utf-8")
            self.assertIn('id="demo-section-01"', render_content_file(markdown_path, ITEM))

    def test_template_contains_navigation_placeholder_and_interactions(self) -> None:
        template = (ROOT / "templates" / "handbook.html").read_text(encoding="utf-8")
        self.assertEqual(template.count(NAV_PLACEHOLDER), 1)
        for marker in (
            ":hover > .nav-dropdown", ":focus-within > .nav-dropdown",
            "IntersectionObserver", "event.key === 'Escape'",
            "mobileBookNav", "mobileOutline", "chapterOutline",
            "document.addEventListener('click'",
        ):
            self.assertIn(marker, template)


class VerifyTests(unittest.TestCase):
    def make_project(self, root: Path) -> None:
        (root / "content").mkdir()
        items = []
        for number in range(1, 25):
            item = {"path": f"ch{number}.md", "id": f"ch{number}", "kind": "chapter", "title": str(number), "toc": True}
            items.append(item)
            (root / "content" / item["path"]).write_text(f'<section id="ch{number}"></section>', encoding="utf-8")
        for number in range(1, 5):
            item = {"path": f"lab{number}.md", "id": f"lab{number}", "kind": "lab", "title": str(number), "toc": True}
            items.append(item)
            (root / "content" / item["path"]).write_text(f'<section id="lab{number}"></section>', encoding="utf-8")
        (root / "content" / "book.json").write_text(json.dumps({"items": items}), encoding="utf-8")

    def test_source_reports_missing_manifest_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.make_project(root)
            (root / "content" / "ch7.md").unlink()
            self.assertTrue(any("ch7.md" in error for error in verify_source(root)))

    def test_source_allows_additional_chapters(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.make_project(root)
            manifest_path = root / "content" / "book.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["items"].append(
                {"path": "ch25.md", "id": "ch25", "kind": "chapter", "title": "25", "toc": True}
            )
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            (root / "content" / "ch25.md").write_text('<section id="ch25"></section>', encoding="utf-8")
            self.assertEqual(verify_source(root), [])

    def test_html_reports_duplicate_and_dangling_anchor(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.make_project(root)
            anchors = "".join(f'<section id="ch{i}"></section>' for i in range(1, 25))
            anchors += "".join(f'<section id="lab{i}"></section>' for i in range(1, 5))
            html = GENERATED_COMMENT + anchors + '<div id="dup"></div><div id="dup"></div><a href="#missing">x</a>'
            errors = verify_html(html, root)
            self.assertTrue(any("重复 HTML id: dup" in error for error in errors))
            self.assertTrue(any("#missing" in error for error in errors))


class SplitTests(unittest.TestCase):
    def test_atomic_write_preserves_existing_file_when_replace_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "target.md"
            target.write_text("old", encoding="utf-8")
            with mock.patch("tools.split_html.os.replace", side_effect=OSError("replace failed")):
                with self.assertRaisesRegex(OSError, "replace failed"):
                    atomic_write_text(target, "new")
            self.assertEqual(target.read_text(encoding="utf-8"), "old")
            self.assertEqual(list(Path(tmp).glob(".target.md.*.tmp")), [])

    def test_split_preflights_all_conflicts_before_writing(self) -> None:
        source = Path(__file__).resolve().parents[1] / "agent-learning-handbook.html"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            conflict = root / "content" / "frontmatter" / "learning-modes.md"
            conflict.parent.mkdir(parents=True)
            conflict.write_text("keep", encoding="utf-8")
            with self.assertRaisesRegex(BuildError, "目标已存在"):
                split(source, root=root)
            self.assertEqual(conflict.read_text(encoding="utf-8"), "keep")
            self.assertFalse((root / "content" / "book.json").exists())
            self.assertFalse((root / "templates" / "handbook.html").exists())


class ThemeMenuTests(unittest.TestCase):
    def test_template_contains_four_theme_menu_options_and_aria(self) -> None:
        template = (ROOT / "templates" / "handbook.html").read_text(encoding="utf-8")
        self.assertIn('id="themeMenu"', template)
        self.assertIn('role="menu"', template)
        self.assertIn('aria-expanded="false"', template)
        self.assertEqual(template.count('role="menuitemradio"'), 4)
        for theme in ("paper", "warm", "mist", "dark"):
            self.assertIn(f'data-theme-value="{theme}"', template)
        self.assertIn("'ah-theme'", template)
        self.assertNotIn("切换深色 / 浅色模式", template)

    def test_learner_guide_keeps_chapter_markers_without_top_counter(self) -> None:
        guide = (ROOT / "assets" / "learner-guide.js").read_text(encoding="utf-8")
        self.assertNotIn("lg-counter", guide)
        self.assertNotIn("refreshCounter", guide)
        self.assertNotIn("📖 已学 ", guide)
        self.assertIn("lg-read-btn", guide)
        self.assertIn("ah-read-chapters", guide)

    def test_theme_script_covers_migration_and_close_behaviors(self) -> None:
        template = (ROOT / "templates" / "handbook.html").read_text(encoding="utf-8")
        self.assertIn("saved === 'light' ? 'paper'", template)
        self.assertIn("localStorage.setItem('ah-theme'", template)
        self.assertIn("event.key === 'Escape'", template)
        self.assertIn("menu.contains(event.target)", template)
        self.assertIn("__ah_recolorCharts(theme === 'dark')", template)


if __name__ == "__main__":
    unittest.main()
