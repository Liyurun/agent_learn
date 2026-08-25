import os
from typing import Protocol

from .models import Message


class Provider(Protocol):
    def complete(self, messages: list[Message]) -> str: ...


class MockProvider:
    def complete(self, messages: list[Message]) -> str:
        facts = next((m.content for m in messages if "不可压缩事实" in m.content), "")
        return f"MOCK_OK：已依据 {len(messages)} 条消息制定只读修复计划；固定事实已保留={bool(facts)}"


class AnthropicProvider:
    def __init__(self) -> None:
        try:
            from anthropic import Anthropic
        except ImportError as error:
            raise RuntimeError(
                '未安装可选依赖。请运行 python -m pip install -e ".[anthropic]"'
            ) from error
        if not os.getenv("ANTHROPIC_API_KEY"):
            raise RuntimeError("缺少 ANTHROPIC_API_KEY；请复制 .env.example 后自行安全配置")
        self.client = Anthropic()

    def complete(self, messages: list[Message]) -> str:
        system = "\n\n".join(item.content for item in messages if item.role == "system")
        turns = [
            {"role": item.role if item.role in {"user", "assistant"} else "user", "content": item.content}
            for item in messages
            if item.role != "system"
        ]
        response = self.client.messages.create(
            model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
            max_tokens=600,
            system=system,
            messages=turns,
        )
        return "".join(block.text for block in response.content if getattr(block, "type", "") == "text")
