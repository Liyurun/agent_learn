from __future__ import annotations

import json
import re
import tempfile
import unittest
from pathlib import Path

from tools.handbook_build import (
    BuildError,
    build_anchor_route_index,
    build_page_context,
    build_page_specs,
    load_manifest,
    normalize_standalone_fragment,
    render_manifest_items,
    render_top_navigation,
    resolve_site_href,
)
from tools.build_pages import build_site
from tools.verify_handbook import verify_site


ROOT = Path(__file__).resolve().parents[1]


class PageModelTests(unittest.TestCase):
    def setUp(self) -> None:
        self.manifest = load_manifest(ROOT / "content" / "book.json")

    def test_page_specs_cover_all_public_content(self) -> None:
        specs = build_page_specs(self.manifest)
        routes = {spec.route for spec in specs}

        self.assertTrue(
            {"", "guide", "quiz", "insights", "labs", "resources"} <= routes
        )
        self.assertTrue({f"ch{i}" for i in range(1, 25)} <= routes)
        self.assertTrue({f"lab{i}" for i in range(1, 5)} <= routes)
        self.assertEqual(len(routes), len(specs))
        self.assertEqual(len(specs), 34)

    def test_anchor_route_index_maps_parts_and_citations(self) -> None:
        rendered = render_manifest_items(ROOT, self.manifest)
        index = build_anchor_route_index(self.manifest, rendered)

        self.assertEqual(index["part1"], "ch1")
        self.assertEqual(index["part6"], "labs")
        self.assertEqual(index["cite-1"], "resources")
        self.assertEqual(index["ch7-section-01"], "ch7")

    def test_resolve_site_href_handles_local_cross_page_and_aliases(self) -> None:
        index = {
            "ch7": "ch7",
            "ch7-section-01": "ch7",
            "cite-1": "resources",
            "part1": "ch1",
        }

        self.assertEqual(
            resolve_site_href("#ch7-section-01", "ch7", index),
            "#ch7-section-01",
        )
        self.assertEqual(
            resolve_site_href("#cite-1", "ch7", index),
            "../resources/#cite-1",
        )
        self.assertEqual(resolve_site_href("#part1", "guide", index), "../ch1/")
        self.assertEqual(
            resolve_site_href("https://example.com", "ch7", index),
            "https://example.com",
        )

    def test_resolve_site_href_rejects_unknown_internal_target(self) -> None:
        with self.assertRaisesRegex(BuildError, "内部链接目标不存在"):
            resolve_site_href("#missing", "ch7", {})

    def test_standalone_fragment_removes_only_migration_page_boundary(self) -> None:
        source = (
            '<section id="ch3"><div>正文</div></section>\n'
            "</div><!-- /page -->\n"
        )

        self.assertEqual(
            normalize_standalone_fragment(source),
            '<section id="ch3"><div>正文</div></section>\n',
        )
        balanced = '<section id="ch2"><div>正文</div></section>\n'
        self.assertEqual(normalize_standalone_fragment(balanced), balanced)


class TemplateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.manifest = load_manifest(ROOT / "content" / "book.json")

    def test_handbook_template_exposes_page_placeholders(self) -> None:
        template = (ROOT / "templates" / "handbook.html").read_text(encoding="utf-8")

        for placeholder in (
            "{{PAGE_TITLE}}",
            "{{PAGE_DESCRIPTION}}",
            "{{BODY_CLASS}}",
            "{{HOME_HREF}}",
            "{{BOOK_COVER}}",
            "{{BOOK_PAGE_CONTEXT}}",
            "{{CONTENT_OPEN}}",
            "{{CONTENT_CLOSE}}",
        ):
            self.assertEqual(template.count(placeholder), 1, placeholder)
        self.assertGreater(template.count("{{ASSET_PREFIX}}"), 1)

    def test_navigation_uses_site_routes_when_resolver_is_provided(self) -> None:
        rendered = render_manifest_items(ROOT, self.manifest)
        anchor_routes = build_anchor_route_index(self.manifest, rendered)
        navigation = render_top_navigation(
            self.manifest,
            href_for=lambda href: resolve_site_href(href, "ch7", anchor_routes),
            home_href="../",
        )

        self.assertIn('href="#ch7"', navigation)
        self.assertIn('href="../resources/#references"', navigation)
        self.assertIn('href="../ch1/"', navigation)


class PageBuildTests(unittest.TestCase):
    def test_build_site_writes_isolated_routes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(
                output_dir=output,
                site_url="https://example.test/book/",
            )

            self.assertTrue((output / "index.html").is_file())
            self.assertTrue((output / "ch1" / "index.html").is_file())
            self.assertTrue((output / "lab4" / "index.html").is_file())
            self.assertTrue((output / "resources" / "index.html").is_file())

            chapter = (output / "ch7" / "index.html").read_text(encoding="utf-8")
            self.assertIn('id="ch7"', chapter)
            self.assertNotIn('<section class="chapter" id="ch8">', chapter)
            self.assertIn("../assets/handbook-interactions.js", chapter)
            self.assertIn('"route":"ch7"', chapter)

    def test_migrated_page_boundaries_are_balanced_in_isolated_pages(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output_dir=output)

            for route in ("ch3", "ch7", "ch12", "ch15", "ch24", "lab4", "insights"):
                html = (output / route / "index.html").read_text(encoding="utf-8")
                self.assertEqual(
                    len(re.findall(r"<div\\b", html, re.IGNORECASE)),
                    len(re.findall(r"</div\\s*>", html, re.IGNORECASE)),
                    route,
                )


class StarmapTests(unittest.TestCase):
    def test_homepage_contains_starmap_without_chapter_bodies(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output_dir=output)
            home = (output / "index.html").read_text(encoding="utf-8")

            self.assertIn('id="learningStarmap"', home)
            self.assertIn('id="constellationTrack"', home)
            self.assertIn('class="constellation-fallback"', home)
            self.assertIn("./assets/learning-map.css", home)
            self.assertIn("./assets/learning-map.js", home)
            self.assertNotIn('id="ch1"', home)
            self.assertNotIn("八周", home)
            self.assertNotIn("今日任务", home)

    def test_homepage_data_has_six_groups_and_28_entries(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output_dir=output)
            home = (output / "index.html").read_text(encoding="utf-8")
            match = re.search(
                r'<script id="starmapData" type="application/json">(.*?)</script>',
                home,
                re.DOTALL,
            )

            self.assertIsNotNone(match)
            data = json.loads(match.group(1))
            self.assertEqual(len(data["groups"]), 6)
            self.assertEqual(
                sum(len(group["entries"]) for group in data["groups"]),
                28,
            )


class ClientContractTests(unittest.TestCase):
    def test_client_scripts_support_page_context(self) -> None:
        interactions = (ROOT / "assets" / "handbook-interactions.js").read_text(
            encoding="utf-8"
        )
        learner_guide = (ROOT / "assets" / "learner-guide.js").read_text(
            encoding="utf-8"
        )

        self.assertIn("window.HANDBOOK_PAGE", interactions)
        self.assertIn("resolveInternalHref", interactions)
        self.assertIn("'ah-last-chapter'", learner_guide)
        self.assertIn("page.previous", learner_guide)
        self.assertIn("page.next", learner_guide)

    def test_chapter_page_context_uses_global_order(self) -> None:
        manifest = load_manifest(ROOT / "content" / "book.json")
        rendered = render_manifest_items(ROOT, manifest)
        routes = build_anchor_route_index(manifest, rendered)
        ch7 = next(spec for spec in build_page_specs(manifest) if spec.route == "ch7")

        context = build_page_context(ch7, manifest, routes)

        self.assertEqual(len(context["entries"]), 28)
        self.assertEqual(context["entries"][6]["id"], "ch7")
        self.assertEqual(context["previous"]["href"], "../ch6/")
        self.assertEqual(context["next"]["href"], "../ch8/")


class SiteVerifyTests(unittest.TestCase):
    def test_generated_site_and_sitemap_are_valid(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(
                output_dir=output,
                site_url="https://example.test/book/",
            )

            self.assertEqual(verify_site(output), [])
            sitemap = (output / "sitemap.xml").read_text(encoding="utf-8")
            self.assertIn("https://example.test/book/", sitemap)
            self.assertIn("https://example.test/book/ch24/", sitemap)
            self.assertIn("https://example.test/book/lab4/", sitemap)

    def test_site_verifier_reports_missing_route(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output_dir=output)
            (output / "ch24" / "index.html").unlink()

            errors = verify_site(output)

            self.assertTrue(any("缺少页面路由: ch24" in error for error in errors))

    def test_site_verifier_reports_broken_cross_page_target(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output_dir=output)
            chapter = output / "ch7" / "index.html"
            chapter.write_text(
                '<!-- GENERATED FILE: test --><a href="../missing/#x">broken</a>',
                encoding="utf-8",
            )

            errors = verify_site(output)

            self.assertTrue(any("目标页面不存在" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
