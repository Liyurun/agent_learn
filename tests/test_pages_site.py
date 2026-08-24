from __future__ import annotations

import unittest
from pathlib import Path

from tools.handbook_build import (
    BuildError,
    build_anchor_route_index,
    build_page_specs,
    load_manifest,
    normalize_standalone_fragment,
    render_manifest_items,
    resolve_site_href,
)


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


if __name__ == "__main__":
    unittest.main()
