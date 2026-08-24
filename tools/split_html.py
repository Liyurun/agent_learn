#!/usr/bin/env python3
"""One-time, lossless splitter for the monolithic handbook HTML."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path

try:
    from .handbook_build import CONTENT_PLACEHOLDER, TOC_PLACEHOLDER, BuildError
except ImportError:  # Direct script execution: python3 tools/split_html.py
    from handbook_build import CONTENT_PLACEHOLDER, TOC_PLACEHOLDER, BuildError


ROOT = Path(__file__).resolve().parents[1]

ITEMS = [
    ("frontmatter/learning-modes.md", "learningModes", "frontmatter", "学习模式入口", False, None, None),
    ("frontmatter/module-atlas.md", "moduleAtlas", "frontmatter", "全书知识地图", False, None, None),
    ("frontmatter/module-quiz-hub.md", "moduleQuizHub", "frontmatter", "模块复盘站", False, None, None),
    ("frontmatter/intro.md", "intro", "frontmatter", "导读：如何使用这份宝典", False, None, None),
    ("frontmatter/insights.md", "insights", "frontmatter", "大牛观点导览", True, "第一篇 · 原理", "00"),
    ("parts/part1.md", "part1", "part", "原理篇", False, None, None),
    ("chapters/ch01.md", "ch1", "chapter", "什么是 Agent", True, "第一篇 · 原理", "01"),
    ("chapters/ch02.md", "ch2", "chapter", "Agent 的四大核心组件", True, "第一篇 · 原理", "02"),
    ("chapters/ch03.md", "ch3", "chapter", "六大核心设计模式", True, "第一篇 · 原理", "03"),
    ("parts/part2.md", "part2", "part", "技术篇", False, None, None),
    ("chapters/ch04.md", "ch4", "chapter", "上下文工程", True, "第二篇 · 技术", "04"),
    ("chapters/ch05.md", "ch5", "chapter", "记忆系统", True, "第二篇 · 技术", "05"),
    ("chapters/ch06.md", "ch6", "chapter", "MCP 模型上下文协议", True, "第二篇 · 技术", "06"),
    ("chapters/ch07.md", "ch7", "chapter", "框架全景与选型", True, "第二篇 · 技术", "07"),
    ("parts/part3.md", "part3", "part", "实践篇", False, None, None),
    ("chapters/ch08.md", "ch8", "chapter", "快速上手 smolagents", True, "第三篇 · 实践", "08"),
    ("chapters/ch09.md", "ch9", "chapter", "工程化 PydanticAI", True, "第三篇 · 实践", "09"),
    ("chapters/ch10.md", "ch10", "chapter", "Agentic RAG 实战", True, "第三篇 · 实践", "10"),
    ("chapters/ch11.md", "ch11", "chapter", "评估与可观测性", True, "第三篇 · 实践", "11"),
    ("chapters/ch12.md", "ch12", "chapter", "生产部署与避坑", True, "第三篇 · 实践", "12"),
    ("parts/part4.md", "part4", "part", "面试篇", False, None, None),
    ("chapters/ch13.md", "ch13", "chapter", "面试高频题库", True, "第四篇 · 面试", "13"),
    ("chapters/ch14.md", "ch14", "chapter", "答题框架与项目准备", True, "第四篇 · 面试", "14"),
    ("chapters/ch15.md", "ch15", "chapter", "学习资源与路线图", True, "第四篇 · 面试", "15"),
    ("parts/part5.md", "part5", "part", "进阶篇", False, None, None),
    ("chapters/ch16.md", "ch16", "chapter", "模型后训练 SFT/RLHF/DPO/GRPO", True, "第五篇 · 进阶", "16"),
    ("chapters/ch17.md", "ch17", "chapter", "Coding Agent 架构剖析", True, "第五篇 · 进阶", "17"),
    ("chapters/ch18.md", "ch18", "chapter", "评估基准全景", True, "第五篇 · 进阶", "18"),
    ("chapters/ch19.md", "ch19", "chapter", "多模态与 Computer Use", True, "第五篇 · 进阶", "19"),
    ("chapters/ch20.md", "ch20", "chapter", "成本延迟优化与安全对齐", True, "第五篇 · 进阶", "20"),
    ("chapters/ch21.md", "ch21", "chapter", "系统化提示工程", True, "第五篇 · 进阶", "21"),
    ("chapters/ch22.md", "ch22", "chapter", "高级推理与搜索式规划", True, "第五篇 · 进阶", "22"),
    ("chapters/ch23.md", "ch23", "chapter", "语音与实时交互 Agent", True, "第五篇 · 进阶", "23"),
    ("chapters/ch24.md", "ch24", "chapter", "云原生部署与数据飞轮", True, "第五篇 · 进阶", "24"),
    ("parts/part6.md", "part6", "part", "实战工坊", False, None, None),
    ("labs/intro.md", "labs-intro", "lab-intro", "实战工坊导读", False, None, None),
    ("labs/lab01.md", "lab1", "lab", "裸写一个 Agent", True, "第六篇 · 实战工坊", "L1"),
    ("labs/lab02.md", "lab2", "lab", "端到端 RAG 问答", True, "第六篇 · 实战工坊", "L2"),
    ("labs/lab03.md", "lab3", "lab", "带工具的客服 Agent", True, "第六篇 · 实战工坊", "L3"),
    ("labs/lab04.md", "lab4", "lab", "多 Agent 研究助手", True, "第六篇 · 实战工坊", "L4"),
    ("appendices/references.md", "references", "appendix", "参考来源", False, None, None),
    ("appendices/footer.md", "footer-note", "appendix", "页脚说明", False, None, None),
]


def find_matching_div(html: str, start: int) -> int:
    depth = 0
    for match in re.finditer(r"</?div\b[^>]*>", html[start:], re.I):
        tag = match.group(0)
        depth += -1 if tag.startswith("</") else 1
        if depth == 0:
            return start + match.end()
    raise BuildError("目录 div 未闭合")


def marker_position(html: str, item_id: str) -> int:
    if item_id.startswith("part"):
        match = re.search(rf"^  <!-- =+ PART {int(item_id[4:])}\b.*$", html, re.M)
    elif item_id == "references":
        match = re.search(r'^  <footer\b[^>]*\bid=["\']references["\'][^>]*>\s*$', html, re.M)
    elif item_id == "footer-note":
        match = re.search(r'^    <div\b[^>]*\bid=["\']footer-note["\'][^>]*>', html, re.M)
    else:
        match = re.search(rf'^    <section class="chapter" id="{re.escape(item_id)}"[^>]*>', html, re.M)
    if not match:
        raise BuildError(f"找不到内容边界: {item_id}")
    return match.start()


def atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def split(source: Path, force: bool = False, root: Path = ROOT) -> None:
    html = source.read_text(encoding="utf-8")
    starts = [marker_position(html, item[1]) for item in ITEMS]
    if starts != sorted(starts) or len(starts) != len(set(starts)):
        raise BuildError("检测到内容边界顺序异常或重复")
    footer_close = html.find("  </footer>", starts[-1])
    if footer_close < 0:
        raise BuildError("找不到 footer 结束标签")
    content_end = footer_close + len("  </footer>")
    chunks = [html[start:end] for start, end in zip(starts, starts[1:] + [content_end])]

    toc_start = chunks[3].find('      <div class="toc">')
    if toc_start < 0:
        raise BuildError("导读中找不到目录")
    toc_end = find_matching_div(chunks[3], toc_start)
    chunks[3] = chunks[3][:toc_start] + TOC_PLACEHOLDER + chunks[3][toc_end:]

    manifest_items = []
    outputs: dict[Path, str] = {}
    for spec, chunk in zip(ITEMS, chunks):
        rel_path, item_id, kind, title, toc, group, number = spec
        outputs[root / "content" / rel_path] = chunk
        record = {"path": rel_path, "id": item_id, "kind": kind, "title": title, "toc": toc}
        if group:
            record["toc_group"] = group
        if number:
            record["number"] = number
        manifest_items.append(record)

    manifest = {"version": 1, "items": manifest_items}
    outputs[root / "content" / "book.json"] = json.dumps(
        manifest, ensure_ascii=False, indent=2
    ) + "\n"
    template = html[:starts[0]] + CONTENT_PLACEHOLDER + html[content_end:]
    outputs[root / "templates" / "handbook.html"] = template

    conflicts = sorted(path for path in outputs if path.exists())
    if conflicts and not force:
        formatted = "\n".join(f" - {path}" for path in conflicts)
        raise BuildError(f"目标已存在（使用 --force 覆盖）:\n{formatted}")

    for path, text in outputs.items():
        atomic_write_text(path, text)
    print(f"[PASS] 拆分 {len(chunks)} 个内容单元，生成 {root / 'content/book.json'}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "agent-learning-handbook.html")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    try:
        split(args.source.resolve(), args.force)
    except (BuildError, OSError) as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
