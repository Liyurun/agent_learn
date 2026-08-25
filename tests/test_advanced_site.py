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
from tools.handbook_build import load_manifest, render_manifest_items
from tools.knowledge_graph import (
    build_advanced_graph,
    build_combined_graph,
    build_concise_graph,
    load_track_mapping,
    traverse,
    validate_relations,
)


ROOT = Path(__file__).resolve().parents[1]


def read_json_script(path: Path, element_id: str) -> dict:
    html = path.read_text(encoding="utf-8")
    match = re.search(
        rf'<script id="{re.escape(element_id)}" type="application/json">'
        r"(.*?)</script>",
        html,
        re.DOTALL,
    )
    if match is None:
        raise AssertionError(f"missing JSON script: {element_id}")
    return json.loads(match.group(1))


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


class KnowledgeGraphTests(unittest.TestCase):
    def setUp(self) -> None:
        self.advanced = load_advanced_manifest(
            ROOT / "content" / "advanced" / "manifest.json"
        )

    def test_advanced_graph_has_one_cluster_per_chapter(self) -> None:
        graph = build_advanced_graph(self.advanced)
        chapters = [node for node in graph.nodes if node.kind == "chapter"]
        sections = [node for node in graph.nodes if node.kind == "section"]

        self.assertEqual(len(chapters), 31)
        self.assertEqual(len(sections), 220)
        for chapter in chapters:
            expected = len(chapter_pages(self.advanced, chapter.id)) - 1
            actual = sum(
                1 for node in sections if node.parent == chapter.id
            )
            self.assertEqual(actual, expected, chapter.id)

    def test_every_advanced_chapter_is_connected_to_global_path(self) -> None:
        graph = build_advanced_graph(self.advanced)
        reachable = traverse(graph, "advanced-ch01")
        chapter_ids = {
            node.id for node in graph.nodes if node.kind == "chapter"
        }

        self.assertTrue(chapter_ids <= reachable)

    def test_concise_chapters_and_labs_have_section_subgraphs(self) -> None:
        manifest = load_manifest(ROOT / "content" / "book.json")
        rendered = render_manifest_items(ROOT, manifest)
        graph = build_concise_graph(ROOT, manifest, rendered)
        chapters = [node for node in graph.nodes if node.kind == "chapter"]
        sections = [node for node in graph.nodes if node.kind == "section"]

        self.assertEqual(len(chapters), 28)
        self.assertGreater(len(sections), 28)
        for chapter in chapters:
            self.assertTrue(
                any(node.parent == chapter.id for node in sections),
                chapter.id,
            )

    def test_invalid_relation_target_fails(self) -> None:
        graph = build_advanced_graph(self.advanced)
        with self.assertRaisesRegex(BuildError, "unknown relation target"):
            validate_relations(
                graph,
                [{"from": "advanced-ch01", "to": "missing", "type": "related"}],
            )


class DualTrackGraphPageTests(unittest.TestCase):
    def test_homepage_contains_both_track_graphs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output_dir=output)
            data = read_json_script(output / "index.html", "starmapData")

        self.assertEqual(set(data["tracks"]), {"concise", "advanced"})
        self.assertEqual(
            len([
                node for node in data["tracks"]["advanced"]["nodes"]
                if node["kind"] == "chapter"
            ]),
            31,
        )
        self.assertEqual(
            len([
                node for node in data["tracks"]["advanced"]["nodes"]
                if node["kind"] == "section"
            ]),
            220,
        )

    def test_homepage_has_track_switch_and_subgraph_panel(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output_dir=output)
            html = (output / "index.html").read_text(encoding="utf-8")

        self.assertIn('id="trackSwitcher"', html)
        self.assertIn('id="globalKnowledgeGraph"', html)
        self.assertIn('id="chapterSubgraph"', html)
        self.assertIn('id="chapterSectionList"', html)

    def test_mobile_graph_contract_is_present(self) -> None:
        script = (ROOT / "assets" / "learning-map.js").read_text(
            encoding="utf-8"
        )
        css = (ROOT / "assets" / "learning-map.css").read_text(
            encoding="utf-8"
        )

        self.assertIn("renderMobileDomains", script)
        self.assertIn("renderMobileChapterGraph", script)
        self.assertIn("@media (max-width: 768px)", css)
        self.assertIn("min-height: 44px", css)


class UnifiedSearchTests(unittest.TestCase):
    def test_index_contains_both_tracks(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output_dir=output)
            index = json.loads(
                (output / "search-index.json").read_text(encoding="utf-8")
            )

        tracks = {document["track"] for document in index["documents"]}
        self.assertEqual(tracks, {"concise", "advanced"})
        self.assertTrue(any(
            document["route"] == "ch4"
            for document in index["documents"]
        ))
        self.assertTrue(any(
            document["route"] == "advanced/chapter-27/context-budget"
            for document in index["documents"]
        ))

    def test_search_script_is_lazy_and_has_all_filters(self) -> None:
        script = (ROOT / "assets" / "unified-search.js").read_text(
            encoding="utf-8"
        )

        self.assertIn("search-index.json", script)
        self.assertIn('filter === "code"', script)
        self.assertIn('filter === "interview"', script)
        self.assertIn("dialog.addEventListener(\"toggle\"", script)

    def test_every_page_family_exposes_the_shared_search_dialog(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output_dir=output)
            pages = (
                output / "index.html",
                output / "ch4" / "index.html",
                output / "advanced/chapter-27/context-budget/index.html",
            )

            for page in pages:
                html = page.read_text(encoding="utf-8")
                self.assertIn('id="unifiedSearch"', html, page)
                self.assertIn("data-site-root=", html, page)
                self.assertIn("assets/unified-search.js", html, page)


class TrackMappingTests(unittest.TestCase):
    def test_mapping_targets_exist_and_progress_stays_separate(self) -> None:
        concise_manifest = load_manifest(ROOT / "content" / "book.json")
        rendered = render_manifest_items(ROOT, concise_manifest)
        advanced_manifest = load_advanced_manifest(
            ROOT / "content" / "advanced" / "manifest.json"
        )
        mapping = load_track_mapping(ROOT / "content" / "track-mapping.json")
        graph = build_combined_graph(
            root=ROOT,
            concise_manifest=concise_manifest,
            rendered_items=rendered,
            advanced_manifest=advanced_manifest,
            mapping=mapping,
        )

        self.assertTrue(all(
            target in graph.node_ids
            for targets in mapping.values()
            for target in targets
        ))
        concise = (ROOT / "assets" / "learner-guide.js").read_text(
            encoding="utf-8"
        )
        advanced = (ROOT / "assets" / "advanced.js").read_text(
            encoding="utf-8"
        )
        self.assertNotIn("ah-advanced-learning-state", concise)
        self.assertNotIn("ah-read-chapters", advanced)
        self.assertTrue(graph.cross_edges)
        self.assertTrue(all(
            edge.type == "deep-dive"
            for edge in graph.cross_edges
        ))

    def test_corresponding_reading_links_are_rendered(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            build_site(output_dir=output)
            concise = (output / "ch4" / "index.html").read_text(encoding="utf-8")
            advanced = (
                output / "advanced/chapter-27/index.html"
            ).read_text(encoding="utf-8")

        self.assertIn("../advanced/chapter-27/", concise)
        self.assertIn("../../ch4/", advanced)


if __name__ == "__main__":
    unittest.main()
