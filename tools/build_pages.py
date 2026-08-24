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
except ImportError:  # Direct script execution: python3 tools/build_pages.py
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


DIST_PATH = ROOT / "dist"
PDF_PATH = ROOT / "Agent学习与面试宝典.pdf"
MANIFEST_PATH = ROOT / "content" / "book.json"
HANDBOOK_TEMPLATE_PATH = ROOT / "templates" / "handbook.html"
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
    return {"groups": groups, "anchorRoutes": anchor_routes}


def render_starmap_fallback(starmap_data: dict) -> str:
    lines = []
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
    return "\n".join(lines)


def write_learning_map(
    target: Path,
    manifest: dict,
    anchor_routes: dict[str, str],
    site_url: str | None,
) -> None:
    template = LEARNING_MAP_TEMPLATE_PATH.read_text(encoding="utf-8")
    data = build_starmap_data(manifest, anchor_routes)
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


def build_site(
    output_dir: Path = DIST_PATH,
    site_url: str | None = None,
) -> dict[str, Path]:
    manifest = load_manifest(MANIFEST_PATH)
    rendered_items = render_manifest_items(ROOT, manifest)
    specs = build_page_specs(manifest)
    anchor_routes = build_anchor_route_index(manifest, rendered_items)
    template = HANDBOOK_TEMPLATE_PATH.read_text(encoding="utf-8")
    outputs: dict[str, Path] = {}

    output_dir.mkdir(parents=True, exist_ok=True)
    home_path = output_dir / "index.html"
    write_learning_map(home_path, manifest, anchor_routes, site_url)
    outputs[""] = home_path

    for spec in specs:
        if not spec.route:
            continue
        content = render_page_content(spec, manifest, rendered_items, anchor_routes)
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
