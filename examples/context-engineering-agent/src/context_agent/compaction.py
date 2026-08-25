import re

from .models import Message


def clean_tool_result(text: str, max_lines: int = 8) -> str:
    """保留错误根因附近内容，清除重复和大段成功日志。"""
    lines = text.splitlines()
    important = [
        line for line in lines
        if re.search(r"FAILED|ERROR|Exception|exit code|root cause", line, re.I)
    ]
    selected = important[:max_lines] or lines[:max_lines]
    omitted = max(0, len(lines) - len(selected))
    suffix = f"\n[…已清理 {omitted} 行；原文保存在检查点旁的输入文件]" if omitted else ""
    return "\n".join(selected) + suffix


def compact_history(history: list[Message], keep_recent: int = 4) -> tuple[str, list[Message], int]:
    """每次根据传入的原始历史生成摘要，不递归摘要旧摘要。"""
    if len(history) <= keep_recent:
        return "无早期历史需要压缩", list(history), 0
    old, recent = history[:-keep_recent], history[-keep_recent:]
    events = [f"{message.role}:{message.content[:40]}" for message in old]
    summary = f"覆盖原始消息 1-{len(old)}；" + " | ".join(events)
    return summary, recent, len(old)
