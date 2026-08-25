"""Build and validate concise and advanced handbook knowledge graphs."""
from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import asdict, dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Literal

try:
    from .advanced_content import AdvancedManifest, chapter_pages
    from .handbook_build import BuildError
except ImportError:  # Direct script execution.
    from advanced_content import AdvancedManifest, chapter_pages
    from handbook_build import BuildError


Track = Literal["concise", "advanced"]
NodeKind = Literal["chapter", "section", "appendix", "guide"]
EdgeType = Literal[
    "sequence",
    "prerequisite",
    "deep-dive",
    "related",
    "practice",
    "interview",
]
VALID_EDGE_TYPES = {
    "sequence",
    "prerequisite",
    "deep-dive",
    "related",
    "practice",
    "interview",
}
ADVANCED_MAIN_PATH = (
    1, 2, 3,
    4, 5, 6, 7,
    8, 9, 10, 11,
    12, 13, 14, 15,
    16, 17, 18,
    19, 20,
    26, 27, 28, 29, 30,
    21, 22, 23, 24, 25, 31,
)


@dataclass(frozen=True)
class GraphDomain:
    id: str
    title: str
    order: int
    chapter_ids: tuple[str, ...]


@dataclass(frozen=True)
class GraphNode:
    id: str
    track: Track
    kind: NodeKind
    title: str
    route: str
    parent: str | None
    order: int
    fragment: str | None = None


@dataclass(frozen=True)
class GraphEdge:
    source: str
    target: str
    type: EdgeType


@dataclass(frozen=True)
class KnowledgeGraph:
    track: Track
    domains: tuple[GraphDomain, ...]
    nodes: tuple[GraphNode, ...]
    edges: tuple[GraphEdge, ...]

    @property
    def node_ids(self) -> frozenset[str]:
        return frozenset(node.id for node in self.nodes)


@dataclass(frozen=True)
class CombinedKnowledgeGraph:
    concise: KnowledgeGraph
    advanced: KnowledgeGraph
    cross_edges: tuple[GraphEdge, ...]

    @property
    def node_ids(self) -> frozenset[str]:
        return self.concise.node_ids | self.advanced.node_ids


class HeadingParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.headings: list[tuple[str, str]] = []
        self._heading_id: str | None = None
        self._parts: list[str] = []

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        if tag.lower() != "h3":
            return
        heading_id = dict(attrs).get("id")
        if heading_id:
            self._heading_id = heading_id
            self._parts = []

    def handle_data(self, data: str) -> None:
        if self._heading_id is not None:
            self._parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "h3" or self._heading_id is None:
            return
        title = " ".join("".join(self._parts).split())
        if title:
            self.headings.append((self._heading_id, title))
        self._heading_id = None
        self._parts = []


def extract_heading_nodes(
    item_id: str,
    rendered_html: str,
    *,
    title: str,
    route: str,
) -> tuple[GraphNode, ...]:
    parser = HeadingParser()
    parser.feed(rendered_html)
    headings = parser.headings or [(f"{item_id}-overview", title)]
    return tuple(
        GraphNode(
            id=heading_id,
            track="concise",
            kind="section",
            title=heading_title,
            route=route,
            parent=item_id,
            order=index,
            fragment=heading_id,
        )
        for index, (heading_id, heading_title) in enumerate(headings, start=1)
    )


def _sequence_edges(node_ids: list[str]) -> list[GraphEdge]:
    return [
        GraphEdge(source, target, "sequence")
        for source, target in zip(node_ids, node_ids[1:])
    ]


def _validate_graph(graph: KnowledgeGraph) -> KnowledgeGraph:
    node_ids = [node.id for node in graph.nodes]
    if len(node_ids) != len(set(node_ids)):
        raise BuildError(f"{graph.track} graph contains duplicate node ids")
    domain_ids = {domain.id for domain in graph.domains}
    for node in graph.nodes:
        if node.kind == "chapter" and node.parent not in domain_ids:
            raise BuildError(f"{node.id}: graph chapter has unknown domain")
        if node.kind == "section" and node.parent not in set(node_ids):
            raise BuildError(f"{node.id}: graph section has unknown chapter")
    validate_relations(graph, [
        {"from": edge.source, "to": edge.target, "type": edge.type}
        for edge in graph.edges
    ])
    return graph


def build_concise_graph(
    root: Path,
    manifest: dict[str, Any],
    rendered_items: dict[str, str],
) -> KnowledgeGraph:
    del root  # Rendered content is the only source needed for graph headings.
    groups: list[tuple[str, list[dict[str, Any]]]] = []
    lookup: dict[str, list[dict[str, Any]]] = {}
    for item in manifest["items"]:
        if item["kind"] not in {"chapter", "lab"}:
            continue
        group_name = item.get("toc_group", "目录")
        if group_name not in lookup:
            lookup[group_name] = []
            groups.append((group_name, lookup[group_name]))
        lookup[group_name].append(item)

    domains: list[GraphDomain] = []
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    chapter_ids: list[str] = []
    for domain_order, (group_name, items) in enumerate(groups, start=1):
        domain_id = f"concise-domain-{domain_order}"
        domain_chapters = tuple(item["id"] for item in items)
        domains.append(GraphDomain(
            id=domain_id,
            title=group_name,
            order=domain_order,
            chapter_ids=domain_chapters,
        ))
        for chapter_order, item in enumerate(items, start=1):
            chapter_id = item["id"]
            chapter_ids.append(chapter_id)
            nodes.append(GraphNode(
                id=chapter_id,
                track="concise",
                kind="chapter",
                title=item["title"],
                route=chapter_id,
                parent=domain_id,
                order=chapter_order,
            ))
            sections = extract_heading_nodes(
                chapter_id,
                rendered_items[chapter_id],
                title=item["title"],
                route=chapter_id,
            )
            nodes.extend(sections)
            section_ids = [section.id for section in sections]
            edges.append(GraphEdge(chapter_id, section_ids[0], "sequence"))
            edges.extend(_sequence_edges(section_ids))
    edges.extend(_sequence_edges(chapter_ids))
    return _validate_graph(KnowledgeGraph(
        track="concise",
        domains=tuple(domains),
        nodes=tuple(nodes),
        edges=tuple(edges),
    ))


def build_advanced_graph(manifest: AdvancedManifest) -> KnowledgeGraph:
    item_lookup = {item.id: item for item in manifest.items}
    path_ids = tuple(f"advanced-ch{number:02d}" for number in ADVANCED_MAIN_PATH)
    if any(chapter_id not in item_lookup for chapter_id in path_ids):
        missing = sorted(set(path_ids) - item_lookup.keys())
        raise BuildError(
            "advanced main path references missing chapters: " + ", ".join(missing)
        )
    path_order = {chapter_id: index for index, chapter_id in enumerate(path_ids)}

    domains = tuple(
        GraphDomain(
            id=domain.id,
            title=domain.title,
            order=domain.order,
            chapter_ids=tuple(
                sorted(
                    domain.chapter_ids,
                    key=lambda chapter_id: path_order[chapter_id],
                )
            ),
        )
        for domain in manifest.domains
        if domain.chapter_ids
    )
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    for chapter_id in path_ids:
        chapter = item_lookup[chapter_id]
        nodes.append(GraphNode(
            id=chapter.id,
            track="advanced",
            kind="chapter",
            title=chapter.title,
            route=chapter.route,
            parent=chapter.domain,
            order=path_order[chapter.id] + 1,
        ))
        sections = chapter_pages(manifest, chapter.id)[1:]
        nodes.extend(
            GraphNode(
                id=section.id,
                track="advanced",
                kind="section",
                title=section.title,
                route=section.route,
                parent=chapter.id,
                order=section.section_order or 0,
            )
            for section in sections
        )
        section_ids = [section.id for section in sections]
        if section_ids:
            edges.append(GraphEdge(chapter.id, section_ids[0], "sequence"))
            edges.extend(_sequence_edges(section_ids))
    nodes.extend(
        GraphNode(
            id=item.id,
            track="advanced",
            kind=item.kind,
            title=item.title,
            route=item.route,
            parent=item.domain,
            order=item.order,
        )
        for item in manifest.items
        if item.kind in {"appendix", "guide"}
    )
    edges.extend(_sequence_edges(list(path_ids)))
    return _validate_graph(KnowledgeGraph(
        track="advanced",
        domains=domains,
        nodes=tuple(nodes),
        edges=tuple(edges),
    ))


def validate_relations(
    graph: KnowledgeGraph,
    relations: list[dict[str, Any]],
) -> tuple[GraphEdge, ...]:
    edges = []
    for index, relation in enumerate(relations, start=1):
        if not isinstance(relation, dict):
            raise BuildError(f"relation #{index} must be an object")
        source = relation.get("from")
        target = relation.get("to")
        edge_type = relation.get("type")
        if source not in graph.node_ids:
            raise BuildError(f"unknown relation source: {source}")
        if target not in graph.node_ids:
            raise BuildError(f"unknown relation target: {target}")
        if edge_type not in VALID_EDGE_TYPES:
            raise BuildError(f"invalid relation type: {edge_type}")
        edges.append(GraphEdge(source, target, edge_type))
    return tuple(edges)


def load_relations(path: Path) -> list[dict[str, Any]]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise BuildError(f"knowledge graph relations do not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise BuildError(f"knowledge graph relations are invalid JSON: {exc}") from exc
    if not isinstance(raw, list):
        raise BuildError("knowledge graph relations must be an array")
    return raw


def load_track_mapping(path: Path) -> dict[str, tuple[str, ...]]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise BuildError(f"track mapping does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise BuildError(f"track mapping is invalid JSON: {exc}") from exc
    if not isinstance(raw, dict):
        raise BuildError("track mapping must be an object")
    mapping: dict[str, tuple[str, ...]] = {}
    for concise_id, targets in raw.items():
        if not isinstance(concise_id, str) or not isinstance(targets, list):
            raise BuildError(f"invalid track mapping entry: {concise_id}")
        if not targets or not all(isinstance(target, str) for target in targets):
            raise BuildError(f"invalid track mapping targets: {concise_id}")
        mapping[concise_id] = tuple(targets)
    return mapping


def build_combined_graph(
    *,
    root: Path,
    concise_manifest: dict[str, Any],
    rendered_items: dict[str, str],
    advanced_manifest: AdvancedManifest,
    mapping: dict[str, tuple[str, ...]],
) -> CombinedKnowledgeGraph:
    concise = build_concise_graph(root, concise_manifest, rendered_items)
    advanced = build_advanced_graph(advanced_manifest)
    cross_edges: list[GraphEdge] = []
    for source, targets in mapping.items():
        if source not in concise.node_ids:
            raise BuildError(f"track mapping has unknown concise source: {source}")
        for target in targets:
            if target not in advanced.node_ids:
                raise BuildError(
                    f"track mapping has unknown advanced target: {target}"
                )
            cross_edges.append(GraphEdge(source, target, "deep-dive"))
    return CombinedKnowledgeGraph(
        concise=concise,
        advanced=advanced,
        cross_edges=tuple(cross_edges),
    )


def with_relations(
    graph: KnowledgeGraph,
    relations: list[dict[str, Any]],
) -> KnowledgeGraph:
    extra = validate_relations(graph, relations)
    return KnowledgeGraph(
        track=graph.track,
        domains=graph.domains,
        nodes=graph.nodes,
        edges=(*graph.edges, *extra),
    )


def traverse(graph: KnowledgeGraph, start: str) -> set[str]:
    if start not in graph.node_ids:
        raise BuildError(f"cannot traverse from unknown graph node: {start}")
    adjacency: dict[str, set[str]] = defaultdict(set)
    for edge in graph.edges:
        adjacency[edge.source].add(edge.target)
        adjacency[edge.target].add(edge.source)
    visited: set[str] = set()
    pending = [start]
    while pending:
        node = pending.pop()
        if node in visited:
            continue
        visited.add(node)
        pending.extend(adjacency[node] - visited)
    return visited


def graph_to_dict(graph: KnowledgeGraph) -> dict[str, Any]:
    return {
        "track": graph.track,
        "domains": [
            {
                "id": domain.id,
                "title": domain.title,
                "order": domain.order,
                "chapterIds": list(domain.chapter_ids),
            }
            for domain in graph.domains
        ],
        "nodes": [
            {
                key: value
                for key, value in asdict(node).items()
                if value is not None
            }
            for node in graph.nodes
        ],
        "edges": [asdict(edge) for edge in graph.edges],
    }
