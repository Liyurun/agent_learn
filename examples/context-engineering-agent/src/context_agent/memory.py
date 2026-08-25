import json
from pathlib import Path

from .models import ContextInput, Message


class CheckpointStore:
    def __init__(self, path: Path):
        self.path = path

    def save(self, context: ContextInput, completed: list[str]) -> None:
        payload = {
            "version": 1,
            "task": context.task,
            "rules": context.rules,
            "pinned_facts": context.pinned_facts,
            "history": [{"role": item.role, "content": item.content} for item in context.history],
            "tool_result": context.tool_result,
            "completed": completed,
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        temporary.replace(self.path)

    def load(self) -> tuple[ContextInput, list[str]]:
        data = json.loads(self.path.read_text(encoding="utf-8"))
        if data.get("version") != 1:
            raise ValueError(f"不支持的检查点版本：{data.get('version')}")
        context = ContextInput(
            task=data["task"],
            rules=data["rules"],
            pinned_facts=data["pinned_facts"],
            history=[Message(**item) for item in data["history"]],
            tool_result=data.get("tool_result", ""),
        )
        return context, data["completed"]
