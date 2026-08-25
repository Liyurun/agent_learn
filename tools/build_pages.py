#!/usr/bin/env python3
"""Build the GitHub Pages publish directory."""
from __future__ import annotations

import json
import os
import shutil
import tempfile
from html import escape
from pathlib import Path

try:
    from .advanced_content import (
        load_advanced_manifest,
        render_advanced_page,
    )
    from .build import OUTPUT_PATH, ROOT, build, render_document
    from .handbook_build import (
        TOC_PLACEHOLDER,
        PageSpec,
        build_anchor_route_index,
        build_page_context,
        build_page_specs,
        load_manifest,
        normalize_standalone_fragment,
        render_manifest_items,
        render_toc,
        replace_single_placeholder,
        resolve_site_href,
        rewrite_internal_links,
    )
    from .knowledge_graph import (
        build_combined_graph,
        graph_to_dict,
        load_relations,
        load_track_mapping,
        with_relations,
    )
    from .search_index import build_search_documents
except ImportError:  # Direct script execution: python3 tools/build_pages.py
    from advanced_content import (
        load_advanced_manifest,
        render_advanced_page,
    )
    from build import OUTPUT_PATH, ROOT, build, render_document
    from handbook_build import (
        TOC_PLACEHOLDER,
        PageSpec,
        build_anchor_route_index,
        build_page_context,
        build_page_specs,
        load_manifest,
        normalize_standalone_fragment,
        render_manifest_items,
        render_toc,
        replace_single_placeholder,
        resolve_site_href,
        rewrite_internal_links,
    )
    from knowledge_graph import (
        build_combined_graph,
        graph_to_dict,
        load_relations,
        load_track_mapping,
        with_relations,
    )
    from search_index import build_search_documents


DIST_PATH = ROOT / "dist"
PDF_PATH = ROOT / "Agent学习与面试宝典.pdf"
MANIFEST_PATH = ROOT / "content" / "book.json"
ADVANCED_MANIFEST_PATH = ROOT / "content" / "advanced" / "manifest.json"
ADVANCED_RELATIONS_PATH = ROOT / "content" / "advanced" / "relations.json"
TRACK_MAPPING_PATH = ROOT / "content" / "track-mapping.json"
HANDBOOK_TEMPLATE_PATH = ROOT / "templates" / "handbook.html"
ADVANCED_TEMPLATE_PATH = ROOT / "templates" / "advanced.html"
LEARNING_MAP_TEMPLATE_PATH = ROOT / "templates" / "learning-map.html"
GROUP_SUBTITLES = (
    "Foundations",
    "Capabilities",
    "Build",
    "Interview",
    "Frontier",
    "Labs",
)


def copy_tree(source: Path, target: Path) -> None:
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)


def render_page_content(
    spec: PageSpec,
    manifest: dict,
    rendered_items: dict[str, str],
    anchor_routes: dict[str, str],
) -> str:
    content = "".join(
        normalize_standalone_fragment(rendered_items[item_id])
        for item_id in spec.item_ids
    )
    if TOC_PLACEHOLDER in content:
        content = replace_single_placeholder(content, TOC_PLACEHOLDER, render_toc(manifest))
    return rewrite_internal_links(content, spec.route, anchor_routes)


def build_starmap_data(
    manifest: dict,
    anchor_routes: dict[str, str],
    rendered_items: dict[str, str],
    advanced_manifest,
    track_mapping: dict[str, tuple[str, ...]],
) -> dict:
    grouped: list[tuple[str, list[dict]]] = []
    lookup: dict[str, list[dict]] = {}
    for item in manifest["items"]:
        if item["kind"] not in {"chapter", "lab"}:
            continue
        group_name = item.get("toc_group", "目录")
        if group_name not in lookup:
            lookup[group_name] = []
            grouped.append((group_name, lookup[group_name]))
        lookup[group_name].append(item)

    part_titles = [
        item["title"]
        for item in manifest["items"]
        if item["kind"] == "part"
    ]
    groups = []
    for index, ((group_name, items), subtitle) in enumerate(
        zip(grouped, GROUP_SUBTITLES),
        start=1,
    ):
        title = part_titles[index - 1] if index <= len(part_titles) else group_name
        groups.append({
            "id": f"part{index}",
            "title": title,
            "subtitle": subtitle,
            "entries": [
                {
                    "id": item["id"],
                    "number": str(item.get("number", "")),
                    "title": item["title"],
                    "href": f"./{item['id']}/",
                }
                for item in items
            ],
        })
    combined = build_combined_graph(
        root=ROOT,
        concise_manifest=manifest,
        rendered_items=rendered_items,
        advanced_manifest=advanced_manifest,
        mapping=track_mapping,
    )
    concise_graph = combined.concise
    advanced_graph = with_relations(
        combined.advanced,
        load_relations(ADVANCED_RELATIONS_PATH),
    )
    return {
        "groups": groups,
        "anchorRoutes": anchor_routes,
        "defaultTrack": "concise",
        "crossEdges": [
            {
                "source": edge.source,
                "target": edge.target,
                "type": edge.type,
            }
            for edge in combined.cross_edges
        ],
        "tracks": {
            "concise": {
                **graph_to_dict(concise_graph),
                "progressTotal": len([
                    node for node in concise_graph.nodes
                    if node.kind == "chapter"
                ]),
            },
            "advanced": {
                **graph_to_dict(advanced_graph),
                "progressTotal": len([
                    node for node in advanced_graph.nodes
                    if node.kind in {"chapter", "section"}
                ]),
            },
        },
    }


def render_starmap_fallback(starmap_data: dict) -> str:
    lines = ['      <div class="fallback-track" data-track="concise">']
    for group in starmap_data["groups"]:
        lines.extend([
            '      <section class="fallback-group">',
            f'        <h2>{escape(group["title"])}</h2>',
        ])
        for entry in group["entries"]:
            lines.append(
                f'        <a href="{escape(entry["href"], quote=True)}">'
                f'{escape(entry["number"])} {escape(entry["title"])}</a>'
            )
        lines.append("      </section>")
    lines.append("      </div>")
    lines.append('      <div class="fallback-track" data-track="advanced">')
    advanced = starmap_data["tracks"]["advanced"]
    node_lookup = {node["id"]: node for node in advanced["nodes"]}
    for domain in advanced["domains"]:
        lines.extend([
            '      <section class="fallback-group">',
            f'        <h2>{escape(domain["title"])}</h2>',
        ])
        for chapter_id in domain["chapterIds"]:
            chapter = node_lookup[chapter_id]
            lines.append(
                f'        <a href="./{escape(chapter["route"], quote=True)}/">'
                f'{escape(chapter["title"])}</a>'
            )
        lines.append("      </section>")
    lines.append("      </div>")
    return "\n".join(lines)


def write_learning_map(
    target: Path,
    manifest: dict,
    anchor_routes: dict[str, str],
    rendered_items: dict[str, str],
    advanced_manifest,
    track_mapping: dict[str, tuple[str, ...]],
    site_url: str | None,
) -> None:
    template = LEARNING_MAP_TEMPLATE_PATH.read_text(encoding="utf-8")
    data = build_starmap_data(
        manifest,
        anchor_routes,
        rendered_items,
        advanced_manifest,
        track_mapping,
    )
    base_url = (site_url or "http://localhost/").rstrip("/") + "/"
    html = replace_single_placeholder(template, "{{SITE_URL}}", escape(base_url, quote=True))
    html = replace_single_placeholder(
        html,
        "{{STAR_MAP_FALLBACK}}",
        render_starmap_fallback(data),
    )
    html = replace_single_placeholder(
        html,
        "{{STAR_MAP_DATA}}",
        json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"),
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html, encoding="utf-8", newline="")


def write_sitemap(output_dir: Path, routes: list[str], site_url: str | None) -> None:
    base_url = (site_url or "http://localhost/").rstrip("/") + "/"
    locations = [
        base_url if not route else f"{base_url}{route}/"
        for route in routes
    ]
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        *(f"  <url><loc>{escape(location)}</loc></url>" for location in locations),
        "</urlset>",
        "",
    ]
    (output_dir / "sitemap.xml").write_text(
        "\n".join(lines),
        encoding="utf-8",
        newline="",
    )


def write_advanced_pages(
    output_dir: Path,
    outputs: dict[str, Path],
    manifest,
    track_mapping: dict[str, tuple[str, ...]],
    concise_manifest: dict,
) -> None:
    template = ADVANCED_TEMPLATE_PATH.read_text(encoding="utf-8")
    concise_lookup = {
        item["id"]: item
        for item in concise_manifest["items"]
        if item["kind"] in {"chapter", "lab"}
    }
    reverse_mapping: dict[str, list[str]] = {}
    for concise_id, advanced_ids in track_mapping.items():
        for advanced_id in advanced_ids:
            reverse_mapping.setdefault(advanced_id, []).append(concise_id)
    for item in manifest.items:
        concise_links = tuple(
            (
                concise_lookup[concise_id]["id"],
                concise_lookup[concise_id]["title"],
            )
            for concise_id in reverse_mapping.get(item.id, ())
        )
        html = render_advanced_page(
            root=ROOT,
            manifest=manifest,
            item=item,
            template=template,
            concise_links=concise_links,
        )
        target = output_dir / item.route / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html, encoding="utf-8", newline="")
        outputs[item.route] = target


def build_site(
    output_dir: Path = DIST_PATH,
    site_url: str | None = None,
) -> dict[str, Path]:
    manifest = load_manifest(MANIFEST_PATH)
    advanced_manifest = load_advanced_manifest(ADVANCED_MANIFEST_PATH)
    track_mapping = load_track_mapping(TRACK_MAPPING_PATH)
    rendered_items = render_manifest_items(ROOT, manifest)
    specs = build_page_specs(manifest)
    anchor_routes = build_anchor_route_index(manifest, rendered_items)
    template = HANDBOOK_TEMPLATE_PATH.read_text(encoding="utf-8")
    outputs: dict[str, Path] = {}

    output_dir.mkdir(parents=True, exist_ok=True)
    home_path = output_dir / "index.html"
    write_learning_map(
        home_path,
        manifest,
        anchor_routes,
        rendered_items,
        advanced_manifest,
        track_mapping,
        site_url,
    )
    outputs[""] = home_path

    for spec in specs:
        if not spec.route:
            continue
        content = render_page_content(spec, manifest, rendered_items, anchor_routes)
        advanced_lookup = {
            item.id: item
            for item in advanced_manifest.items
        }
        mapped = track_mapping.get(spec.route, ())
        if mapped:
            links = "".join(
                f'<a href="../{escape(advanced_lookup[item_id].route, quote=True)}/">'
                f"{escape(advanced_lookup[item_id].title)}</a>"
                for item_id in mapped
            )
            content += (
                '<aside class="deep-dive-links" '
                'aria-label="进阶完整版对应阅读">'
                "<h2>进阶完整版对应阅读</h2>"
                f'<div class="deep-dive-link-list">{links}</div>'
                "</aside>"
            )
        context = build_page_context(spec, manifest, anchor_routes)
        html = render_document(
            template=template,
            manifest=manifest,
            content=content,
            title=f"{spec.title} · Agent 学习与面试宝典",
            description=f"Agent 学习与面试宝典：{spec.title}",
            body_class="content-page",
            asset_prefix="..",
            home_href="../",
            cover_html="",
            page_context=context,
            content_open="" if spec.route == "resources" else '  <div class="page">\n',
            content_close="" if spec.route == "resources" else "  </div>\n",
            href_for=lambda href, route=spec.route: resolve_site_href(
                href,
                route,
                anchor_routes,
            ),
        )
        target = output_dir / spec.route / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html, encoding="utf-8", newline="")
        outputs[spec.route] = target

    write_advanced_pages(
        output_dir,
        outputs,
        advanced_manifest,
        track_mapping,
        manifest,
    )
    search_index = {
        "version": 1,
        "documents": build_search_documents(
            ROOT,
            manifest,
            rendered_items,
            advanced_manifest,
        ),
    }
    (output_dir / "search-index.json").write_text(
        json.dumps(search_index, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
        newline="",
    )
    write_sitemap(output_dir, list(outputs), site_url)
    copy_tree(ROOT / "assets", output_dir / "assets")
    copy_tree(ROOT / "_shared", output_dir / "_shared")
    if PDF_PATH.is_file():
        shutil.copy2(PDF_PATH, output_dir / PDF_PATH.name)
    return outputs


def main() -> int:
    html = build()
    fd, temp_name = tempfile.mkstemp(prefix=".pages-", suffix="", dir=ROOT)
    os.close(fd)
    temp_dir = Path(temp_name)
    temp_dir.unlink()
    temp_dir.mkdir(parents=True)
    try:
        outputs = build_site(temp_dir, os.environ.get("SITE_URL"))
        if DIST_PATH.exists():
            shutil.rmtree(DIST_PATH)
        os.replace(temp_dir, DIST_PATH)
    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    print(f"[PASS] 已生成 GitHub Pages 发布目录: {DIST_PATH}")
    print(f"[PASS] 页面入口: {DIST_PATH / 'index.html'}")
    print(f"[INFO] 页面数量: {len(outputs)}")
    print(f"[INFO] 完整 HTML 字节数: {len(html.encode('utf-8'))}")
    print(f"[INFO] 源 HTML 同步: {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
